import { syncCloudPlanToLocal } from '@/plans/cloud'
import { startStudyTask } from '@/plans/repository'
import { idDictionaryMap } from '@/resources/dictionary'
import {
  currentChapterAtom,
  currentDictIdAtom,
  reviewModeInfoAtom,
  wordDictationConfigAtom,
} from '@/store'
import { supabase } from '@/supabase/client'
import { db } from '@/utils/db'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const DEVICE_ID_KEY = 'wenyanDeviceId'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonObject = Record<string, unknown>

type Command = {
  id: string
  type: 'open_today' | 'open_dictionary' | 'open_chapter' | 'start_task'
  args: JsonObject
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function parseCommand(value: unknown): Command | undefined {
  const row = asObject(value)
  const id = asText(row?.id)
  const type = row?.type
  const args = asObject(row?.args) ?? {}
  if (!id || !UUID_PATTERN.test(id)) return undefined
  if (type !== 'open_today' && type !== 'open_dictionary' && type !== 'open_chapter' && type !== 'start_task') return undefined
  return { id, type, args }
}

function getDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY)
  if (existing && UUID_PATTERN.test(existing)) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_ID_KEY, created)
  return created
}

function getDeviceName() {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'Wenyan Web · Windows'
  if (/Macintosh|Mac OS/i.test(ua)) return 'Wenyan Web · macOS'
  if (/Linux/i.test(ua)) return 'Wenyan Web · Linux'
  return 'Wenyan Web'
}

function getEnglishDictionary(dictId: string) {
  const dict = Object.prototype.hasOwnProperty.call(idDictionaryMap, dictId) ? idDictionaryMap[dictId] : undefined
  if (!dict || dict.language !== 'en') throw new Error('invalid_dictionary')
  return dict
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const known = [
    'invalid_dictionary',
    'invalid_chapter',
    'invalid_command_args',
    'plan_sync_failed',
    'plan_not_available',
    'task_not_found',
  ].find((code) => message.includes(code))
  return known ?? 'execution_failed'
}

/**
 * Global browser-side executor for the personal Wenyan control plane.
 * A command completion means the requested website action executed; it never
 * creates a learning completion fact. Real study completion still comes only
 * from the existing taskRun -> learning-event path.
 */
export default function WenyanControlRuntime() {
  const navigate = useNavigate()
  const location = useLocation()
  const [chapter, setChapter] = useAtom(currentChapterAtom)
  const dictId = useAtomValue(currentDictIdAtom)
  const setDictId = useSetAtom(currentDictIdAtom)
  const [reviewInfo, setReviewInfo] = useAtom(reviewModeInfoAtom)
  const dictation = useAtomValue(wordDictationConfigAtom)
  const [userId, setUserId] = useState<string | null>(null)
  const deviceId = useMemo(getDeviceId, [])
  const deviceName = useMemo(getDeviceName, [])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const subscribedRef = useRef(false)
  const inFlightRef = useRef(new Set<string>())
  const executeRef = useRef<(commandId: string) => Promise<void>>(async () => undefined)

  const enabled = location.pathname !== '/oauth/consent' && location.pathname !== '/mobile'
  const activeTaskRunId = useMemo(() => new URLSearchParams(location.search).get('taskRun'), [location.search])
  const practiceMode = reviewInfo.isReviewMode ? 'review' : dictation.isOpen ? 'dictation' : 'learn'

  const deviceState = useMemo(
    () => ({
      deviceId,
      deviceName,
      platform: navigator.userAgent.slice(0, 240),
      currentPath: `${location.pathname}${location.search}`.slice(0, 500),
      currentDictId: dictId,
      currentChapter: chapter,
      practiceMode,
      activeTaskRunId,
    }),
    [activeTaskRunId, chapter, deviceId, deviceName, dictId, location.pathname, location.search, practiceMode]
  )

  const heartbeat = useCallback(async () => {
    if (!userId || !enabled) return false
    const { error } = await supabase.rpc('upsert_wenyan_device', {
      p_device_id: deviceState.deviceId,
      p_device_name: deviceState.deviceName,
      p_platform: deviceState.platform,
      p_current_path: deviceState.currentPath,
      p_current_dict_id: deviceState.currentDictId,
      p_current_chapter: deviceState.currentChapter,
      p_practice_mode: deviceState.practiceMode,
      p_active_task_run_id: deviceState.activeTaskRunId,
    })
    return !error
  }, [deviceState, enabled, userId])

  const finishCommand = useCallback(
    async (commandId: string, success: boolean, result: JsonObject, failureCode?: string) => {
      await supabase.rpc('finish_website_command', {
        p_command_id: commandId,
        p_device_id: deviceId,
        p_success: success,
        p_result: result,
        p_error_code: failureCode ?? null,
      })
    },
    [deviceId]
  )

  const executeCommand = useCallback(
    async (commandId: string) => {
      if (!enabled || !userId || inFlightRef.current.has(commandId)) return
      inFlightRef.current.add(commandId)

      try {
        const { data, error } = await supabase.rpc('claim_website_command', {
          p_command_id: commandId,
          p_device_id: deviceId,
        })
        if (error) return
        const command = parseCommand(data)
        if (!command) {
          await finishCommand(commandId, false, {}, 'invalid_command_payload')
          return
        }

        try {
          if (command.type === 'open_today') {
            navigate('/today')
            await finishCommand(command.id, true, { path: '/today' })
            return
          }

          if (command.type === 'open_dictionary') {
            const requestedDictId = asText(command.args.dictId)
            if (!requestedDictId) throw new Error('invalid_command_args')
            getEnglishDictionary(requestedDictId)
            setReviewInfo({ isReviewMode: false, reviewRecord: undefined })
            setDictId(requestedDictId)
            setChapter(0)
            navigate('/today')
            await finishCommand(command.id, true, { path: '/today', dictId: requestedDictId, chapterIndex: 0 })
            return
          }

          if (command.type === 'open_chapter') {
            const requestedDictId = asText(command.args.dictId)
            const requestedChapter = asInteger(command.args.chapterIndex)
            if (!requestedDictId || requestedChapter == null) throw new Error('invalid_command_args')
            const dict = getEnglishDictionary(requestedDictId)
            if (requestedChapter < 0 || requestedChapter >= dict.chapterCount) throw new Error('invalid_chapter')
            setReviewInfo({ isReviewMode: false, reviewRecord: undefined })
            setDictId(requestedDictId)
            setChapter(requestedChapter)
            navigate('/')
            await finishCommand(command.id, true, { path: '/', dictId: requestedDictId, chapterIndex: requestedChapter })
            return
          }

          const planId = asText(command.args.planId)
          const taskId = asText(command.args.taskId)
          if (!planId || !taskId || !UUID_PATTERN.test(planId) || !UUID_PATTERN.test(taskId)) throw new Error('invalid_command_args')
          const sync = await syncCloudPlanToLocal(planId)
          if (sync.status !== 'synced' || sync.planId !== planId) throw new Error('plan_sync_failed')
          const plan = await db.studyPlans.get(planId)
          if (!plan || plan.cloudStatus !== 'active') throw new Error('plan_not_available')
          const task = plan.tasks.find((candidate) => candidate.id === taskId)
          if (!task) throw new Error('task_not_found')
          const run = await startStudyTask(planId, taskId)
          setReviewInfo({ isReviewMode: false, reviewRecord: undefined })
          setDictId(task.dictId)
          setChapter(task.chapterIndex)
          const path = `/?taskRun=${encodeURIComponent(run.id)}`
          navigate(path)
          await finishCommand(command.id, true, {
            path,
            planId,
            taskId,
            taskRunId: run.id,
            dictId: task.dictId,
            chapterIndex: task.chapterIndex,
          })
        } catch (actionError) {
          const code = errorCode(actionError)
          await finishCommand(command.id, false, {}, code)
        }
      } finally {
        inFlightRef.current.delete(commandId)
      }
    },
    [deviceId, enabled, finishCommand, navigate, setChapter, setDictId, setReviewInfo, userId]
  )

  executeRef.current = executeCommand

  const fetchPending = useCallback(async () => {
    if (!userId || !enabled) return
    const { data, error } = await supabase.rpc('get_pending_website_commands', { p_device_id: deviceId })
    if (error || !Array.isArray(data)) return
    for (const value of data) {
      const command = parseCommand(value)
      if (command) void executeRef.current(command.id)
    }
  }, [deviceId, enabled, userId])

  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setUserId(data.session?.user.id ?? null)
      if (data.session) void supabase.realtime.setAuth(data.session.access_token)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      if (session) void supabase.realtime.setAuth(session.access_token)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId || !enabled) return
    void heartbeat().then((registered) => {
      if (registered) void fetchPending()
    })
    const intervalId = window.setInterval(() => {
      void heartbeat().then((registered) => {
        if (registered) void fetchPending()
      })
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [enabled, fetchPending, heartbeat, userId])

  useEffect(() => {
    if (!userId || !enabled) return
    let disposed = false
    void supabase.realtime.setAuth()
    const topic = `wenyan:user:${userId}:control`
    const channel = supabase
      .channel(topic, { config: { private: true, presence: { key: deviceId } } })
      .on('broadcast', { event: 'command_created' }, (message) => {
        const root = asObject(message)
        const payload = asObject(root?.payload)
        const commandId = asText(payload?.commandId)
        const targetDeviceId = asText(payload?.targetDeviceId)
        if (commandId && targetDeviceId === deviceId) void executeRef.current(commandId)
      })
      .subscribe((status) => {
        subscribedRef.current = status === 'SUBSCRIBED'
        if (status === 'SUBSCRIBED' && !disposed) {
          void channel.track({
            deviceId,
            deviceName,
            path: deviceState.currentPath,
            dictId: deviceState.currentDictId,
            chapter: deviceState.currentChapter,
            practiceMode: deviceState.practiceMode,
            activeTaskRunId: deviceState.activeTaskRunId,
          })
          void fetchPending()
        }
      })

    channelRef.current = channel
    return () => {
      disposed = true
      subscribedRef.current = false
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [deviceId, deviceName, enabled, fetchPending, userId])

  useEffect(() => {
    const channel = channelRef.current
    if (!channel || !subscribedRef.current || !enabled) return
    void channel.track({
      deviceId,
      deviceName,
      path: deviceState.currentPath,
      dictId: deviceState.currentDictId,
      chapter: deviceState.currentChapter,
      practiceMode: deviceState.practiceMode,
      activeTaskRunId: deviceState.activeTaskRunId,
    })
  }, [deviceId, deviceName, deviceState, enabled])

  return null
}
