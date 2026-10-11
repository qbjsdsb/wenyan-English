import { semanticRunPath } from '@/semantic/practice'
import { type PreparedSmartSession, assertPreparedVocabularyBlockStartable, prepareSmartVocabularySession, startPreparedSemanticBlock, startPreparedVocabularyBlock } from '@/smart-session/adapter'
import { reportSmartSessionExecutionAvailability } from '@/smart-session/executionAvailability'
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
import { ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function retryLabel(retryAt: number | undefined) {
  if (retryAt === undefined) return ''
  const minutes = Math.ceil((retryAt - Date.now()) / 60_000)
  if (minutes <= 0) return '现在可以重新检查'
  return `约 ${minutes} 分钟后再看`
}

function purposeLabel(prepared: PreparedSmartSession | undefined) {
  if (!prepared) return '正在安排下一段…'
  if (prepared.kind === 'semantic-resume') return `继续刚才的${prepared.run.mode === 'discrimination' ? '选择词义' : '词义回想'}（剩余 ${(prepared.run.discriminationQuestions?.length ?? prepared.run.items.length) - prepared.run.index} 个）`
  if (prepared.kind === 'resume') return `继续刚才的 ${prepared.record.words.length} 个词`
  if (prepared.draft.disposition === 'break') return '先休息一下'
  const block = prepared.draft.blocks[0]
  if (!block) {
    if (prepared.draft.reason === 'review_only_waiting_for_correction_cooldown' || prepared.draft.reason === 'waiting_for_correction_cooldown') {
      return '刚练过的错词先放一会儿。'
    }
    if (prepared.draft.reason === 'new_word_ceiling_no_review' || prepared.draft.reason === 'nothing_due_yet') {
      return '现在没有到期内容。'
    }
    if (prepared.draft.reason === 'budget_reached') return '这次学习已经到计划时长。'
    return '现在没有需要自动安排的内容。'
  }
  const count = block.activity.items.length
  if (block.purpose === 'semantic_recall') return `回想 ${count} 个熟悉单词的词义`
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
      return retry ? `刚练过的错词先留一点间隔，${retry}。` : '刚练过的错词先留一点间隔，稍后再看。'
    }
    if (reason === 'new_word_ceiling_no_review') {
      if (intent?.constraints.newWordCeiling === 0) return '今天不再加新词，当前也没有到期复习。'
      return '今天的新词额度已经用完，稍后再看即可。'
    }
    if (reason === 'nothing_due_yet') return '当前没有到期复习，稍后再来即可。'
    if (reason === 'budget_reached') return '这次学习已经到计划时长。'
  }
  if (intent?.warnings.includes('unbound_cached_session_intent_ignored')) return '暂时离线，本次安排需要联网后再确认。'
  if (intent?.source === 'cached-cloud') return '云端安排暂时无法更新，沿用最近一次有效安排。'
  if (intent?.warnings.includes('cloud_intent_unavailable')) return '云端安排暂时不可用，先按本机记录继续。'
  if (prepared?.kind === 'draft' && prepared.draft.blocks[0]?.activity.kind === 'semantic_recall') return '先回想，再看释义并自评。'
  if (intent?.source === 'cloud') return '已按最近的学习安排调整。'
  if (prepared?.kind === 'draft' && prepared.draft.warnings.length > 0) return '暂时只按当前可见记录安排。'
  return ''
}

function blockMeta(prepared: PreparedSmartSession | undefined, intent: ResolvedSmartSessionIntent | undefined) {
  if (prepared?.kind === 'resume' || prepared?.kind === 'semantic-resume') return ['继续未完成内容']
  const block = prepared?.kind === 'draft' ? prepared.draft.blocks[0] : undefined
  const items = block?.activity.items.length ?? 0
  const minutes = block ? Math.max(1, Math.ceil(block.estimatedSeconds / 60)) : 0
  const meta = block ? [`约 ${minutes} 分钟`, `${items} 个词`] : []
  if (prepared?.kind === 'draft' && !block) {
    const retry = retryLabel(prepared.draft.retryAt)
    if (retry) meta.push(retry)
    if (intent?.constraints.newWordCeiling === 0) meta.push('今日不加新词')
  }
  if (intent?.source === 'cloud') meta.push('最近安排已应用')
  if (intent?.source === 'cached-cloud') meta.push('沿用最近安排')
  if (prepared?.runtime.hardStopMinutes !== undefined || prepared?.runtime.hardStopAt !== undefined) meta.push('到点停止')
  return meta
}

function userFacingError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : ''
  if (message.includes('smart_session_hard_stop')) return '本次学习已经到时间上限。'
  if (message.includes('session_intent_bound_elsewhere')) return '这条本次安排已在另一个学习会话使用，正在重新计算。'
  if (message.includes('session_intent_binding_requires_live_cloud')) return '这条本次安排需要联网确认后才能开始。'
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
  const generation = useRef(0)

  const supported = dict.language === 'en'

  const refresh = useCallback(async (quiet = false) => {
    const request = ++generation.current
    if (!supported) return
    setBusy(true)
    setError('')
    if (!quiet) { setPrepared(undefined); setIntent(undefined) }
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
      if (request !== generation.current) return
      setIntent(effectiveIntent)
      setPrepared(nextPrepared)
      void reportSmartSessionExecutionAvailability(nextPrepared)
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : '暂时无法生成下一段学习。')
    } finally {
      if (request === generation.current) setBusy(false)
    }
  }, [dict.id, supported])

  useEffect(() => {
    void refresh()
    const changed = () => { void refresh() }
    const foreground = () => { if (document.visibilityState === 'visible') void refresh(true) }
    window.addEventListener('wenyan-learning-owner-changed', changed)
    window.addEventListener('focus', foreground)
    return () => { generation.current++; window.removeEventListener('wenyan-learning-owner-changed', changed); window.removeEventListener('focus', foreground) }
  }, [refresh])

  useEffect(() => {
    if (busy) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(true) }, 60000)
    return () => window.clearInterval(timer)
  }, [busy, refresh])

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
      if (prepared.kind === 'semantic-resume' || (prepared.kind === 'draft' && prepared.draft.blocks[0]?.activity.kind === 'semantic_recall')) {
        const active = prepared.kind === 'semantic-resume' ? prepared : await startPreparedSemanticBlock(prepared)
        navigate(semanticRunPath(active.run))
        return
      }
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

  const hasBlock = prepared?.kind === 'semantic-resume' || prepared?.kind === 'resume' || (prepared?.kind === 'draft' && prepared.draft.blocks.length > 0)
  const isBreak = prepared?.kind === 'draft' && prepared.draft.disposition === 'break'
  const canSmartStart = Boolean(hasBlock || isBreak)
  const showNote = Boolean(note)
  const primaryLabel = busy
    ? '正在准备…'
    : isBreak
      ? '休息好了，继续'
      : prepared?.kind === 'resume' || prepared?.kind === 'semantic-resume'
        ? '继续这一段'
        : hasBlock
          ? '开始学习'
          : '重新检查'

  return (
    <section
      aria-label="智能学习"
      data-intent-source={intent?.source ?? 'loading'}
      className="wenyan-focus-surface wenyan-fade-in mb-9 px-7 py-7"
    >
      <div className="relative z-[1] flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.015em] text-[var(--wenyan-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--wenyan-accent)] shadow-[0_0_0_4px_var(--wenyan-accent-soft)]" />
            <span>{prepared?.kind === 'resume' || prepared?.kind === 'semantic-resume' ? '接着上次的位置' : isBreak ? '留一点间隔' : '现在适合做'}</span>
          </div>
          <h2 className="text-[25px] font-semibold leading-[1.4] sm:text-[28px] tracking-[-0.036em] text-[var(--wenyan-ink)]">{label}</h2>

          {meta.length > 0 && (
            <div className="wenyan-mono mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--wenyan-ink-secondary)]" aria-label="这一段概况">
              {meta.map((item, index) => (
                <span key={item} className="contents">
                  {index > 0 && <span aria-hidden="true" className="text-[var(--wenyan-ink-muted)] opacity-65">·</span>}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          )}

          {showNote && <p className="wenyan-muted mt-3 max-w-xl text-[13px] leading-[1.7]">{note}</p>}
          {error && <p role="alert" className="mt-3 text-xs leading-5 text-[var(--wenyan-danger)]">{error}</p>}
        </div>

        <div className="flex w-full shrink-0 flex-col items-start gap-2.5 sm:w-auto sm:items-end">
          {error && (
            <button
              type="button"
              aria-label="重新安排"
              onClick={() => void refresh()}
              className="wenyan-button-secondary"
            >
              重试
            </button>
          )}
          <button
            type="button"
            disabled={busy || (!prepared && !error) || Boolean(error)}
            onClick={() => void (canSmartStart ? start() : refresh())}
            className={`${canSmartStart ? 'wenyan-button-primary' : 'wenyan-button-secondary'} inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-6 sm:w-auto`}
          >
            <span>{primaryLabel}</span>
            {canSmartStart && !busy && <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />}
          </button>
          {!canSmartStart && prepared && !busy && (
            <Link
              to="/"
              aria-label="手动继续当前章节（不按这条智能安排）"
              className="wenyan-muted text-[11px] no-underline transition-colors hover:text-[var(--wenyan-ink-secondary)]"
            >
              手动继续
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}