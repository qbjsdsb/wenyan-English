import { supabase } from '@/supabase/client'
import { getReadyLearningEvents, markLearningEventsFailed, markLearningEventsSynced, toRemoteLearningEvent } from './learningQueue'
import { setLocalLearningOwnerId } from './localLearningOwner'
import { type LearningPullResult, pullLearningEvents } from './pullLearningEvents'

export type LearningSyncResult =
  | { status: 'signed-out'; synced: 0 }
  | { status: 'idle'; synced: 0 }
  | { status: 'synced'; synced: number }
  | { status: 'failed'; synced: 0; message: string }

export interface LearningDataSyncResult {
  upload: LearningSyncResult
  download: LearningPullResult
}

let activeSync: Promise<LearningSyncResult> | null = null
let activeDataSync: Promise<LearningDataSyncResult> | null = null

async function performSync(): Promise<LearningSyncResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    setLocalLearningOwnerId(null)
    return { status: 'signed-out', synced: 0 }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { status: 'failed', synced: 0, message: userError?.message ?? '无法确认当前登录账号。' }
  }

  setLocalLearningOwnerId(userData.user.id)

  const events = await getReadyLearningEvents(userData.user.id, 100)
  if (events.length === 0) {
    return { status: 'idle', synced: 0 }
  }

  const ids = events.map((event) => event.id)
  const payload = events.map(toRemoteLearningEvent)
  const { error } = await supabase.rpc('ingest_learning_events', { p_events: payload })

  if (error) {
    await markLearningEventsFailed(ids, error)
    return { status: 'failed', synced: 0, message: error.message }
  }

  await markLearningEventsSynced(ids)
  return { status: 'synced', synced: ids.length }
}

export function syncLearningEvents() {
  if (!activeSync) {
    activeSync = performSync()
      .catch((error) => ({
        status: 'failed',
        synced: 0,
        message: error instanceof Error ? error.message : String(error),
      }) as LearningSyncResult)
      .finally(() => {
        activeSync = null
      })
  }

  return activeSync
}

export function syncLearningData() {
  if (!activeDataSync) {
    activeDataSync = (async () => {
      const upload = await syncLearningEvents()
      const download = upload.status === 'signed-out' ? { status: 'signed-out', received: 0, inserted: 0 } as const : await pullLearningEvents()
      return { upload, download }
    })().finally(() => {
      activeDataSync = null
    })
  }

  return activeDataSync
}

export function startLearningSync() {
  let disposed = false

  const run = () => {
    if (!disposed) void syncLearningData()
  }

  const onOnline = () => run()
  window.addEventListener('online', onOnline)

  void supabase.auth.getSession().then(({ data }) => {
    setLocalLearningOwnerId(data.session?.user.id)
  })

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setLocalLearningOwnerId(session?.user.id)
    if (session) window.setTimeout(run, 0)
  })

  const intervalId = window.setInterval(run, 30_000)
  run()

  return () => {
    disposed = true
    window.removeEventListener('online', onOnline)
    window.clearInterval(intervalId)
    data.subscription.unsubscribe()
  }
}
