import Header from '@/components/Header'
import PageHeading from '@/components/PageHeading'
import PracticeResume from '@/components/PracticeResume'
import { CHAPTER_LENGTH } from '@/constants'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { learningEventsForOwnerByTypes } from '@/learning/eventQueries'
import type { SemanticItem } from '@/semantic/core'
import { buildSemanticDiscriminationQuestions } from '@/semantic/discrimination'
import {
  createManualSemanticRun,
  preparePracticeItems,
  preparePracticeReferences,
  selectPracticeWords,
  semanticRunPath,
} from '@/semantic/practice'
import type { PracticeMode, PracticePool } from '@/semantic/practice'
import { readPracticeChoices, savePracticeChoices } from '@/semantic/practiceChoices'
import { currentChapterAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import { ReviewRecord } from '@/utils/db/record'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAtomValue, useSetAtom } from 'jotai'
import { ArrowRight, Keyboard, ListChecks, MessageCircle, Pencil } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useSWR from 'swr'

const modes = [
  { id: 'spelling', title: '拼写', hint: '练准词形', detail: '按熟悉的方式输入；需要时可以开启默写。', icon: Keyboard },
  { id: 'recall', title: '词义回想', hint: '主动想意思', detail: '先想意思，再看释义并自评。', icon: MessageCircle },
  { id: 'discrimination', title: '选择词义', hint: '辨认参考释义', detail: '从词书释义中选择，用来检查辨认。', icon: ListChecks },
  { id: 'production', title: '看义写词', hint: '从意思写出词', detail: '只看当前词书释义，输入对应英文词头。', icon: Pencil },
] as const

const pools = [
  { id: 'chapter', title: '当前章节', detail: '从眼前这章挑一小段。' },
  { id: 'learned', title: '已经练过', detail: '从当前词书已经练过的词里选。' },
  { id: 'errors', title: '拼写错词', detail: '最近 14 天仍未拼对的词。' },
  { id: 'uncertain', title: '词义模糊', detail: '最近仍想不全、选错或写错的词。' },
] as const

export default function PracticePage() {
  const dict = useAtomValue(currentDictInfoAtom)
  const chapter = useAtomValue(currentChapterAtom)
  const owner = useLearningOwner()
  const setReview = useSetAtom(reviewModeInfoAtom)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const savedChoices = useMemo(() => readPracticeChoices(owner), [owner])
  const mode: PracticeMode = modes.some((item) => item.id === params.get('mode')) ? (params.get('mode') as PracticeMode) : savedChoices.mode
  const pool: PracticePool = pools.some((item) => item.id === params.get('pool')) ? (params.get('pool') as PracticePool) : savedChoices.pool
  const limit = params.get('limit') === '12' ? 12 : params.get('limit') === '6' ? 6 : savedChoices.limit

  useEffect(() => {
    savePracticeChoices({ mode, pool, limit }, owner)
  }, [mode, pool, limit, owner])

  const [prepared, setPrepared] = useState<{
    items: SemanticItem[]
    references: SemanticItem[]
    words: ReturnType<typeof selectPracticeWords>['candidates']
    count: number
  }>()
  const [preparing, setPreparing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const {
    data: words,
    error: contentError,
    mutate,
  } = useSWR(dict.language === 'en' ? dict.url : null, wordListFetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  const events = useLiveQuery(
    () =>
      learningEventsForOwnerByTypes(owner, [
        'word_attempted',
        'semantic_recall_attempted',
        'semantic_discrimination_attempted',
        'semantic_production_attempted',
      ]),
    [owner],
  )
  const selection = useMemo(
    () => (words && events ? selectPracticeWords(words, events, dict.id, chapter, pool, mode) : undefined),
    [chapter, dict.id, events, mode, pool, words],
  )

  useEffect(() => {
    let active = true
    setPrepared(undefined)
    setPreparing(true)
    setError('')
    if (!selection || !words)
      return () => {
        active = false
      }
    void (async () => {
      try {
        const items = await preparePracticeItems(selection.candidates, dict.id, limit, pool === 'uncertain' ? selection : undefined)
        const chapterWords = words.slice(chapter * CHAPTER_LENGTH, (chapter + 1) * CHAPTER_LENGTH)
        const references = mode === 'discrimination' ? await preparePracticeReferences(items, words, dict.id, chapter) : items
        const selectedWords = selection.candidates.filter((word) => items.some((item) => item.word === word.name))
        const count =
          mode === 'discrimination'
            ? buildSemanticDiscriminationQuestions(
                references,
                limit,
                items.map((item) => item.contentId),
              ).length
            : mode === 'spelling' && pool === 'chapter'
            ? chapterWords.length
            : selectedWords.length
        if (active) setPrepared({ items, references, words: selectedWords, count })
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '暂时无法准备这一组。')
      } finally {
        if (active) setPreparing(false)
      }
    })()
    return () => {
      active = false
    }
  }, [chapter, dict.id, limit, mode, pool, selection, words])

  const change = useCallback(
    (key: string, value: string) =>
      setParams(
        (old) => {
          const next = new URLSearchParams(old)
          next.set(key, value)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const start = useCallback(async () => {
    if (!prepared || !prepared.count || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (getLocalLearningOwnerId() !== owner) throw new Error('账号已经改变，请重新准备。')
      if (mode === 'spelling') {
        if (pool === 'chapter') {
          setReview({ isReviewMode: false, reviewRecord: undefined })
          navigate('/')
        } else {
          const record = new ReviewRecord(dict.id, prepared.words)
          record.origin = 'manual'
          record.ownerUserId = owner
          record.id = await db.reviewRecords.add(record)
          if (getLocalLearningOwnerId() !== owner) throw new Error('账号已经改变，请重新准备。')
          setReview({ isReviewMode: true, reviewRecord: record })
          navigate('/?practice=spelling')
        }
      } else {
        const run = await createManualSemanticRun(dict.id, mode, prepared.items, prepared.references, owner, { pool, limit })
        if (getLocalLearningOwnerId() !== owner) throw new Error('账号已经改变，请重新准备。')
        navigate(semanticRunPath(run))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法开始，原有记录仍然保留。')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [dict.id, limit, mode, navigate, owner, pool, prepared, setReview])

  const selectedMode = modes.find((item) => item.id === mode) ?? modes[1]
  const selectedPool = pools.find((item) => item.id === pool) ?? pools[0]
  const loading = preparing || !events || !words
  const previewWords = mode === 'production' ? [] : prepared?.items.slice(0, 8).map((item) => item.word) ?? []
  const statusText = contentError
    ? '词书加载失败。'
    : loading
    ? '正在准备…'
    : prepared?.count
    ? `本段 ${prepared.count} 个词${mode === 'spelling' && pool === 'chapter' ? ' · 继续当前章节' : ' · 较久没练的优先'}`
    : mode === 'production' && pool === 'chapter'
    ? '这一章暂时没有释义足够唯一的词，换个范围试试。'
    : pool === 'chapter' && mode === 'discrimination'
    ? '可用释义不足，试试词义回想。'
    : '这一组暂时没有可练内容。'

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a, input, textarea, select, summary, [contenteditable="true"]')) return
      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        change('mode', modes[Number(event.key) - 1].id)
        return
      }
      if (event.key === 'Enter' && !busy && !loading && !contentError && prepared?.count) {
        event.preventDefault()
        void start()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [busy, change, contentError, loading, prepared?.count, start])

  return (
    <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-14 pt-9">
        <PageHeading title="专项训练" description="选一种方式，专心练一组。">
          <Link to="/today" className="wenyan-link text-sm">
            按今天的安排学 <ArrowRight className="ml-1 inline" size={13} />
          </Link>
        </PageHeading>

        <PracticeResume dictionaryId={dict.id} />

        <section className="wenyan-practice-desk" aria-label="专项训练设置">
          <fieldset>
            <legend className="sr-only">训练方式</legend>
            <div className="wenyan-practice-tabs" role="radiogroup" aria-label="训练方式">
              {modes.map((item, index) => (
                <label key={item.id} className={`wenyan-practice-tab ${mode === item.id ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="practice-mode"
                    className="sr-only"
                    value={item.id}
                    aria-keyshortcuts={String(index + 1)}
                    checked={mode === item.id}
                    onChange={() => change('mode', item.id)}
                  />
                  <item.icon size={16} strokeWidth={1.65} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="wenyan-muted mt-1 block text-[11px]">{item.hint}</span>
                  </span>
                  <kbd aria-hidden="true" className="wenyan-practice-tab-key wenyan-mono">
                    {index + 1}
                  </kbd>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="wenyan-practice-context">
            <div>
              <p className="wenyan-muted text-[10px] font-medium tracking-[0.04em]">当前词书</p>
              <p className="mt-1 text-sm font-semibold">
                {dict.name} <span className="wenyan-muted font-normal">· 第 {chapter + 1} 章</span>
              </p>
            </div>
            <Link className="wenyan-link text-xs" to={`/gallery?from=practice&mode=${mode}&pool=${pool}&limit=${limit}`}>
              换词书 / 章节
            </Link>
          </div>

          {dict.language !== 'en' ? (
            <p className="wenyan-muted py-8">专项训练目前支持英语词书，请先选择英语词书。</p>
          ) : (
            <>
              <section className="wenyan-practice-section" aria-labelledby="practice-pool-title">
                <div className="wenyan-practice-section-heading">
                  <div>
                    <h2 id="practice-pool-title" className="text-sm font-semibold">
                      练这些词
                    </h2>
                    <p className="wenyan-muted mt-1 text-xs leading-5">{selectedPool.detail}</p>
                  </div>
                  {!(mode === 'spelling' && pool === 'chapter') && (
                    <fieldset className="wenyan-practice-count-group flex shrink-0 items-center gap-1.5">
                      <legend className="sr-only">每段词数</legend>
                      <span className="wenyan-muted mr-1 text-[10px]">每段</span>
                      {[6, 12].map((count) => (
                        <label key={count} className={`wenyan-practice-count ${limit === count ? 'is-selected' : ''}`}>
                          <input
                            className="sr-only"
                            type="radio"
                            name="practice-count"
                            aria-label={`最多 ${count} 个`}
                            checked={limit === count}
                            onChange={() => change('limit', String(count))}
                          />
                          {count}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
                <fieldset className="mt-4">
                  <legend className="sr-only">练习范围</legend>
                  <div className="flex flex-wrap gap-2">
                    {pools.map((item) => (
                      <label key={item.id} className={`wenyan-practice-pool ${pool === item.id ? 'is-selected' : ''}`}>
                        <input
                          type="radio"
                          className="sr-only"
                          name="practice-pool"
                          checked={pool === item.id}
                          onChange={() => change('pool', item.id)}
                        />
                        {item.title}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>

              <section className="wenyan-practice-launch" aria-live="polite">
                <div className="min-w-0">
                  <p className="wenyan-muted text-[10px] font-medium tracking-[0.05em]">{selectedMode.title}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6">{selectedMode.detail}</p>
                  <p className="wenyan-muted mt-3 text-xs leading-5">{statusText}</p>
                  {previewWords.length > 0 && (
                    <p
                      className="wenyan-practice-preview wenyan-mono mt-2 truncate text-xs"
                      title={prepared?.items.map((item) => item.word).join(' · ')}
                    >
                      {previewWords.join(' · ')}
                      {(prepared?.items.length ?? 0) > previewWords.length ? ' …' : ''}
                    </p>
                  )}
                  {error && (
                    <p role="alert" className="mt-3 text-sm text-[var(--wenyan-danger)]">
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="wenyan-muted wenyan-mono text-[9px]">1–4 切换 · Enter 开始</span>
                  <div className="flex items-center gap-3">
                    {contentError && (
                      <button className="wenyan-button-secondary" onClick={() => void mutate()}>
                        重试加载
                      </button>
                    )}
                    {!loading && !prepared?.count && pool !== 'chapter' && (
                      <button className="wenyan-link text-sm" onClick={() => change('pool', 'chapter')}>
                        练当前章节
                      </button>
                    )}
                    {!loading && !contentError && !prepared?.count && pool === 'chapter' && mode !== 'recall' && (
                      <button className="wenyan-link text-sm" onClick={() => change('mode', 'recall')}>
                        试试词义回想
                      </button>
                    )}
                    <button
                      className="wenyan-button-primary inline-flex items-center gap-2"
                      aria-keyshortcuts="Enter"
                      aria-label={mode === 'spelling' && pool !== 'chapter' ? '开始拼写训练' : undefined}
                      disabled={loading || busy || !prepared?.count || Boolean(contentError)}
                      onClick={() => void start()}
                    >
                      {busy
                        ? '正在准备…'
                        : mode === 'spelling' && pool === 'chapter'
                        ? '继续这一章'
                        : mode === 'spelling'
                        ? '开始拼写'
                        : `开始${selectedMode.title}`}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>

        <div className="mt-5 flex justify-end text-xs">
          <Link className="wenyan-link" to="/error-book">
            查看拼写错词
          </Link>
        </div>

        <details className="mt-6 border-t border-[var(--wenyan-line-soft)] pt-4">
          <summary className="wenyan-muted cursor-pointer text-xs">怎么选？</summary>
          <div className="wenyan-muted mt-3 space-y-2 text-xs leading-6">
            <p>词形不稳练拼写；看词想不起意思练词义回想；容易混淆释义练选择词义；想把意思主动变成英文词头时练看义写词。</p>
            <p>看义写词只考当前词书中释义足够唯一的词，避免把合理同义词误判为错。</p>
          </div>
        </details>
      </main>
    </div>
  )
}
