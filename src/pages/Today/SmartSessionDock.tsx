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
import { useNavigate } from 'react-router-dom'

function purposeLabel(prepared: PreparedSmartSession | undefined) {
  if (!prepared) return '正在安排下一段…'
  if (prepared.kind === 'resume') return `继续刚才的 ${prepared.record.words.length} 个词`
  if (prepared.draft.disposition === 'break') return '先休息一下'
  const block = prepared.draft.blocks[0]
  if (!block) return '今天没有必须补的内容'
  const count = block.activity.items.length
  if (block.purpose === 'weak') return `先巩固 ${count} 个近期反复拼错的词`
  if (block.purpose === 'review') return `先复习 ${count} 个现在更值得回看的词`
  if (block.purpose === 'new') return `继续推进 ${count} 个新词`
  return `下一段约 ${Math.max(1, Math.round(block.estimatedSeconds / 60))} 分钟`
}

function intentNote(intent: ResolvedSmartSessionIntent | undefined, prepared: PreparedSmartSession | undefined) {
  if (intent?.warnings.includes('unbound_cached_session_intent_ignored')) return '当前安排需要联网确认'
  if (intent?.source === 'cached-cloud') return '沿用最近一次有效安排'
  if (intent?.warnings.includes('cloud_intent_unavailable')) return '云端不可用，按本机记录继续'
  if (intent?.source === 'cloud') return '已应用最近的学习安排'
  if (prepared?.kind === 'draft' && prepared.draft.warnings.length > 0) return '基于当前可见记录'
  return ''
}

function blockMeta(prepared: PreparedSmartSession | undefined) {
  if (prepared?.kind === 'resume') return '继续未完成内容'
  const block = prepared?.kind === 'draft' ? prepared.draft.blocks[0] : undefined
  if (!block) return ''
  const items = block.activity.items.length
  const minutes = Math.max(1, Math.ceil(block.estimatedSeconds / 60))
  return `约 ${minutes} 分钟 · ${items} 个词`
}

function userFacingError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : ''
  if (message.includes('smart_session_hard_stop')) return '本次学习已到时间上限'
  if (message.includes('session_intent_bound_elsewhere')) return '安排已在另一学习会话使用，正在重新计算'
  if (message.includes('session_intent_binding_requires_live_cloud')) return '这次安排需要联网确认后再开始'
  return message || '暂时无法开始这一段学习'
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
      setError(cause instanceof Error ? cause.message : '暂时无法生成下一段学习')
    } finally {
      setBusy(false)
    }
  }, [dict.id, supported])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const label = useMemo(
    () => error && !prepared ? '暂时无法安排下一段学习' : purposeLabel(prepared),
    [error, prepared],
  )
  const note = useMemo(() => intentNote(intent, prepared), [intent, prepared])
  const meta = useMemo(() => blockMeta(prepared), [prepared])

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

  return (
    <section
      aria-label="智能学习"
      data-intent-source={intent?.source ?? 'loading'}
      className="mb-10 border-y border-black/[0.08] py-8 dark:border-white/[0.09]"
    >
      <div className="flex items-end justify-between gap-10">
        <div className="min-w-0">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-500">继续学习</p>
          <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-gray-950 dark:text-gray-100">
            {label}
          </h2>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
            {meta && <span>{meta}</span>}
            {meta && note && <span aria-hidden="true">·</span>}
            {note && <span>{note}</span>}
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {error && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="rounded-lg border border-black/[0.1] px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/[0.12] dark:text-gray-400 dark:hover:bg-white/[0.05]"
            >
              重试
            </button>
          )}
          <button
            type="button"
            disabled={busy || (!hasBlock && !isBreak)}
            onClick={() => void start()}
            className="rounded-lg bg-[#1d1d1b] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#eeeeea] dark:text-[#111210] dark:hover:bg-white"
          >
            {busy ? '准备中…' : isBreak ? '继续' : prepared?.kind === 'resume' ? '继续这一段' : '开始学习'}
          </button>
        </div>
      </div>
    </section>
  )
}
