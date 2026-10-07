import { type PreparedSmartSession, prepareSmartVocabularySession, startPreparedVocabularyBlock } from '@/smart-session/adapter'
import { type ResolvedSmartSessionIntent, resolveSmartSessionLearningIntent } from '@/smart-session/learningIntent'
import { acknowledgeSmartBreak, getRecoverableSmartSessionFocusDictionary } from '@/smart-session/runtime'
import { currentChapterAtom, currentDictIdAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function purposeLabel(prepared: PreparedSmartSession | undefined) {
  if (!prepared) return '正在根据最近记录安排…'
  if (prepared.kind === 'resume') return `继续刚才的 ${prepared.record.words.length} 个词`
  if (prepared.draft.disposition === 'break') return '已经学了一阵，适合稍微休息一下。'
  const block = prepared.draft.blocks[0]
  if (!block) return '这一轮没有需要强行安排的内容。'
  const count = block.activity.items.length
  if (block.purpose === 'weak') return `先巩固 ${count} 个近期反复拼错的词`
  if (block.purpose === 'review') return `先复习 ${count} 个现在更值得回看的词`
  if (block.purpose === 'new') return `继续推进 ${count} 个新词`
  return `下一段约 ${Math.max(1, Math.round(block.estimatedSeconds / 60))} 分钟`
}

function intentNote(intent: ResolvedSmartSessionIntent | undefined, prepared: PreparedSmartSession | undefined) {
  if (intent?.warnings.includes('cloud_intent_unavailable')) return '云端安排暂时不可用，已按本机记录继续。'
  if (intent?.source === 'cloud') return '已按你最近的学习安排自动调整；随时可以停，不会累积欠任务。'
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
  if (intent?.source === 'cloud') meta.push('最近安排已应用')
  return meta
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
    try {
      const [recoverableFocus, resolvedIntent] = await Promise.all([
        getRecoverableSmartSessionFocusDictionary(),
        resolveSmartSessionLearningIntent(dict.id),
      ])
      const focusDictionary = recoverableFocus ?? resolvedIntent.constraints.focusDictionary ?? dict.id
      const effectiveIntent: ResolvedSmartSessionIntent = {
        ...resolvedIntent,
        constraints: { ...resolvedIntent.constraints, focusDictionary },
      }
      setIntent(effectiveIntent)
      setPrepared(await prepareSmartVocabularySession(focusDictionary, effectiveIntent.constraints))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法生成下一段学习。')
    } finally {
      setBusy(false)
    }
  }, [dict.id, supported])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const label = useMemo(() => purposeLabel(prepared), [prepared])
  const note = useMemo(() => intentNote(intent, prepared), [intent, prepared])
  const meta = useMemo(() => blockMeta(prepared, intent), [intent, prepared])

  const start = async () => {
    if (!prepared || !supported) return
    setBusy(true)
    setError('')
    try {
      if (prepared.kind === 'draft' && prepared.draft.disposition === 'break') {
        acknowledgeSmartBreak(prepared.runtime)
        await refresh()
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
      setError(cause instanceof Error ? cause.message : '暂时无法开始这一段学习。')
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
      className="relative mb-7 overflow-hidden rounded-3xl border border-indigo-100 bg-white px-7 py-8 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:px-10 lg:py-10"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-50 blur-3xl dark:bg-indigo-950/30" />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.18em] text-indigo-600 dark:text-indigo-300">今天 · 下一段</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white lg:text-3xl">{label}</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-gray-500 dark:text-gray-400">{note}</p>
          {meta.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2" aria-label="这一段概况">
              {meta.map((item) => (
                <span key={item} className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                  {item}
                </span>
              ))}
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-xs text-red-600 dark:text-red-300">{error}</p>}
        </div>
        <button
          type="button"
          disabled={busy || (!hasBlock && !isBreak)}
          onClick={() => void start()}
          className="w-full shrink-0 rounded-2xl bg-indigo-600 px-7 py-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
        >
          {busy ? '正在准备…' : isBreak ? '休息好了，继续' : prepared?.kind === 'resume' ? '继续这一段' : '开始学习'}
        </button>
      </div>
    </section>
  )
}
