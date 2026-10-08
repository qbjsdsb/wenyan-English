import { type PreparedSmartSession, assertPreparedVocabularyBlockStartable, prepareSmartVocabularySession, startPreparedVocabularyBlock } from '@/smart-session/adapter'
import { type ResolvedSmartSessionIntent, bindResolvedSessionIntent, resolveSmartSessionLearningIntent } from '@/smart-session/learningIntent'
import {
  acknowledgeSmartBreak,
  createSmartSessionId,
  getCurrentSmartSessionId,
  getRecoverableSmartSessionFocusDictionary,
} from '@/smart-session/runtime'
import { currentChapterAtom, currentDictIdAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function retryLabel(retryAt: number | undefined) {
  if (retryAt === undefined) return ''
  const minutes = Math.ceil((retryAt - Date.now()) / 60_000)
  if (minutes <= 0) return '现在可以重新检查'
  return `约 ${minutes} 分钟后可再检查`
}

function purposeLabel(prepared: PreparedSmartSession | undefined) {
  if (!prepared) return '正在根据最近记录安排…'
  if (prepared.kind === 'resume') return `继续刚才的 ${prepared.record.words.length} 个词`
  if (prepared.draft.disposition === 'break') return '已经学了一阵，适合稍微休息一下。'
  const block = prepared.draft.blocks[0]
  if (!block) {
    if (prepared.draft.reason === 'review_only_waiting_for_correction_cooldown' || prepared.draft.reason === 'waiting_for_correction_cooldown') {
      return '刚练过的错词正在冷却。'
    }
    if (prepared.draft.reason === 'new_word_ceiling_no_review' || prepared.draft.reason === 'nothing_due_yet') {
      return '当前没有到期复习内容。'
    }
    if (prepared.draft.reason === 'budget_reached') return '这次学习已经到达计划时长。'
    return '当前没有需要自动安排的内容。'
  }
  const count = block.activity.items.length
  if (block.purpose === 'weak') return `先巩固 ${count} 个近期反复拼错的词`
  if (block.purpose === 'correction') return `先纠正 ${count} 个刚才拼错的词`
  if (block.purpose === 'review') return `先复习 ${count} 个现在更值得回看的词`
  if (block.purpose === 'new') return `继续推进 ${count} 个新词`
  return `下一段约 ${Math.max(1, Math.round(block.estimatedSeconds / 60))} 分钟`
}

function intentNote(intent: ResolvedSmartSessionIntent | undefined, prepared: PreparedSmartSession | undefined) {
  if (prepared?.kind === 'draft') {
    const { reason, retryAt } = prepared.draft
    if (reason === 'review_only_waiting_for_correction_cooldown' || reason === 'waiting_for_correction_cooldown') {
      const retry = retryLabel(retryAt)
      return `今天仍按复习优先。刚练过的错词先留一点间隔${retry ? `，${retry}` : '，稍后再检查'}；到点后页面会自动重新计算。`
    }
    if (reason === 'new_word_ceiling_no_review') {
      if (intent?.constraints.newWordCeiling === 0) {
        return '今天的新词上限是 0，当前也没有到期复习。这不是故障；可以稍后回来，也可以明确选择手动继续当前章节。'
      }
      return '今天的新词额度已经用完，当前也没有到期复习。稍后再检查即可。'
    }
    if (reason === 'nothing_due_yet') return '当前没有到期复习内容；系统不会为了凑时长强行重复刚学过的词。'
    if (reason === 'budget_reached') return '已经达到这次学习的计划时长，系统不会再自动开启新的学习段。'
  }
  if (intent?.warnings.includes('unbound_cached_session_intent_ignored')) return '云端暂时不可用；未绑定的本次学习安排不会离线抢占别的设备。'
  if (intent?.source === 'cached-cloud') return '云端暂时不可用，已沿用这个账号最近一次仍有效的学习安排。'
  if (intent?.warnings.includes('cloud_intent_unavailable')) return '云端安排暂时不可用，已按本机记录继续。'
  if (intent?.source === 'cloud') return '已按你最近的学习安排自动调整；本次安排会在真正开始时绑定到这个学习会话。'
  if (prepared?.kind === 'draft' && prepared.draft.warnings.length > 0) {
    return '只依据当前可见学习记录安排；缺失记录不会被当成不会。'
  }
  return '随时可以停，下次会重新计算，不会累积成欠任务。'
}

function blockMeta(prepared: PreparedSmartSession | undefined, intent: ResolvedSmartSessionIntent | undefined) {
  if (prepared?.kind === 'resume') return ['未完成的一段会原样继续']
  const block = prepared?.kind === 'draft' ? prepared.draft.blocks[0] : undefined
  const items = block?.activity.items.length ?? 0
  const minutes = block ? Math.max(1, Math.ceil(block.estimatedSeconds / 60)) : 0
  const meta = block ? [`约 ${minutes} 分钟`, `${items} 个词`] : []
  if (prepared?.kind === 'draft' && !block) {
    const retry = retryLabel(prepared.draft.retryAt)
    if (retry) meta.push(retry)
    if (intent?.constraints.newWordCeiling === 0) meta.push('今日新词上限 0')
  }
  if (intent?.source === 'cloud') meta.push('最近安排已应用')
  if (intent?.source === 'cached-cloud') meta.push('沿用最近有效安排')
  if (prepared?.runtime.hardStopMinutes !== undefined || prepared?.runtime.hardStopAt !== undefined) meta.push('到点按单词边界停止')
  return meta
}

function userFacingError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : ''
  if (message.includes('smart_session_hard_stop')) return '本次学习已经到达时间上限，不再开启新的学习段。'
  if (message.includes('session_intent_bound_elsewhere')) return '这条“本次学习”安排已经被另一个学习会话使用，正在重新计算。'
  if (message.includes('session_intent_binding_requires_live_cloud')) return '本次学习安排需要联网确认后才能首次启动。'
  return message || '暂时无法开始这一段学习。'
}

export default function SmartSessionDock() {
  const dict = useAtomValue(currentDictInfoAtom)
  const setDict = useSetAtom(currentDictIdAtom)
  const setChapter = useSetAtom(currentChapterAtom)
  const setReview = useSetAtom(reviewModeInfoAtom)
  const navigate = useNavigate()
  const [prepared, setPrepared] = useState<PreparedSmartSession>()
  const [intent, setIntent] = useState<ResolvedSmartSessionIntent>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const supported = dict.language === 'en'

  const refresh = useCallback(async () => {
    if (!supported) return
    setBusy(true)
    setError('')
    setPrepared(undefined)
    setIntent(undefined)
    try {
      const ownerUserId = getLocalLearningOwnerId()
      const runtimeSessionId = getCurrentSmartSessionId(ownerUserId) ?? createSmartSessionId()
      const [recoverableFocus, resolvedIntent] = await Promise.all([
        getRecoverableSmartSessionFocusDictionary(ownerUserId),
        resolveSmartSessionLearningIntent(dict.id, runtimeSessionId),
      ])
      const focusDictionary = recoverableFocus ?? resolvedIntent.constraints.focusDictionary ?? dict.id
      const effectiveIntent: ResolvedSmartSessionIntent = {
        ...resolvedIntent,
        constraints: { ...resolvedIntent.constraints, focusDictionary },
      }
      const nextPrepared = await prepareSmartVocabularySession(
        focusDictionary,
        effectiveIntent.constraints,
        Date.now(),
        runtimeSessionId,
      )
      setIntent(effectiveIntent)
      setPrepared(nextPrepared)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法生成下一段学习。')
    } finally {
      setBusy(false)
    }
  }, [dict.id, supported])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (prepared?.kind !== 'draft' || prepared.draft.retryAt === undefined) return
    const delay = Math.max(250, prepared.draft.retryAt - Date.now() + 250)
    const id = window.setTimeout(() => void refresh(), delay)
    return () => window.clearTimeout(id)
  }, [prepared, refresh])

  const label = useMemo(
    () => error && !prepared ? '暂时无法安排下一段学习。' : purposeLabel(prepared),
    [error, prepared],
  )
  const note = useMemo(() => intentNote(intent, prepared), [intent, prepared])
  const meta = useMemo(() => blockMeta(prepared, intent), [intent, prepared])

  const start = async () => {
    if (!prepared || !intent || !supported) return
    setBusy(true)
    setError('')
    try {
      if (prepared.kind === 'draft' && prepared.draft.disposition === 'break') {
        acknowledgeSmartBreak(prepared.runtime)
        await refresh()
        return
      }

      if (prepared.kind === 'draft') assertPreparedVocabularyBlockStartable(prepared)
      await bindResolvedSessionIntent(intent, prepared.runtime.id)
      const active = prepared.kind === 'resume' ? prepared : await startPreparedVocabularyBlock(prepared)
      const record = active.record
      const runtime = active.runtime
      if (!runtime.currentBlock) throw new Error('smart_session_block_missing')

      setReview({ isReviewMode: true, reviewRecord: record })
      setDict(runtime.focusDictionary)
      setChapter(0)
      navigate(
        `/?smartSession=${encodeURIComponent(runtime.id)}&smartBlock=${encodeURIComponent(runtime.currentBlock.id)}`,
      )
    } catch (cause) {
      setError(userFacingError(cause))
      if (cause instanceof Error && cause.message.includes('session_intent_bound_elsewhere')) await refresh()
      setBusy(false)
    }
  }

  if (!supported) return null

  const hasBlock = prepared?.kind === 'resume' || (prepared?.kind === 'draft' && prepared.draft.blocks.length > 0)
  const isBreak = prepared?.kind === 'draft' && prepared.draft.disposition === 'break'
  const canSmartStart = Boolean(hasBlock || isBreak)
  const primaryLabel = busy
    ? '正在准备…'
    : isBreak
      ? '休息好了，继续'
      : prepared?.kind === 'resume'
        ? '继续这一段'
        : hasBlock
          ? '开始学习'
          : '重新检查'

  return (
    <section
      aria-label="智能学习"
      data-intent-source={intent?.source ?? 'loading'}
      className="relative mb-8 overflow-hidden rounded-[28px] border border-gray-200/70 bg-white/90 px-7 py-8 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-white/[0.055] lg:px-10 lg:py-10"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-400 via-indigo-500 to-violet-500" />
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-indigo-100/50 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-indigo-600 dark:text-indigo-300">NEXT SESSION</p>
            <span className="h-px w-8 bg-gray-200 dark:bg-white/10" />
            <p className="text-xs text-gray-400">今天只做下一小段</p>
          </div>

          <h2 className="mt-5 max-w-[680px] text-[28px] font-semibold leading-[1.2] tracking-[-0.035em] text-gray-950 dark:text-white lg:text-[34px]">
            {label}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-gray-500 dark:text-gray-400">{note}</p>

          {meta.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2" aria-label="这一段概况">
              {meta.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-gray-200/70 bg-gray-50/80 px-3 py-1.5 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
                >
                  {item}
                </span>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex min-w-[180px] flex-col gap-3">
          {error && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              重新安排
            </button>
          )}
          <button
            type="button"
            disabled={busy || (!prepared && !error) || Boolean(error)}
            onClick={() => void (canSmartStart ? start() : refresh())}
            className="w-full shrink-0 rounded-2xl bg-gray-950 px-7 py-4 text-sm font-medium text-white shadow-[0_10px_28px_-14px_rgba(15,23,42,0.8)] transition duration-200 hover:-translate-y-0.5 hover:bg-gray-800 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-45 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white lg:w-auto"
          >
            {primaryLabel}
          </button>
          {!canSmartStart && prepared && !busy && (
            <Link
              to="/"
              className="text-center text-xs leading-5 text-gray-400 underline-offset-4 transition-colors hover:text-indigo-600 hover:underline dark:hover:text-indigo-300"
            >
              手动继续当前章节（不按这条智能安排）
            </Link>
          )}
          <p className="text-center text-[11px] leading-5 text-gray-400">真实学习后才会写入完成记录</p>
        </div>
      </div>
    </section>
  )
}
