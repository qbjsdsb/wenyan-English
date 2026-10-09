import Header from '@/components/Header'
import { CHAPTER_LENGTH } from '@/constants'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { buildSemanticDiscriminationQuestions } from '@/semantic/discrimination'
import { createManualSemanticRun, preparePracticeItems, selectPracticeWords, semanticRunPath } from '@/semantic/practice'
import type { PracticeMode, PracticePool } from '@/semantic/practice'
import type { SemanticItem } from '@/semantic/core'
import { currentChapterAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import { ReviewRecord } from '@/utils/db/record'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAtomValue, useSetAtom } from 'jotai'
import { ArrowRight, Check, Keyboard, ListChecks, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useSWR from 'swr'

const modes = [
  { id: 'spelling', title: '拼写训练', hint: '把词拼准确', detail: '沿用熟悉的输入练习。想挑战回忆，可以在练习里开启默写。', icon: Keyboard },
  { id: 'recall', title: '词义回想', hint: '英文 → 中文 · 主动回想', detail: '先在心里说出词义，再揭示释义，如实自评。没有选项提示。', icon: MessageCircle },
  { id: 'discrimination', title: '选择词义', hint: '英文 → 中文 · 四选一', detail: '从真实词书释义中辨认。选对会记录为辨认正确，与主动回想分开。', icon: ListChecks },
] as const
const pools = [
  { id: 'chapter', title: '当前章节', detail: '从眼前这章挑一小段，适合刚学完后的巩固。' },
  { id: 'learned', title: '已经练过', detail: '只用当前词书里有真实拼写记录的词。优先较久没练这一模式的词。' },
  { id: 'errors', title: '拼写错词', detail: '最近 14 天，最近一次输入仍有错误的词。拼对后会退出这组。' },
  { id: 'uncertain', title: '词义模糊', detail: '最近 14 天仍未想全，或最近一次辨认选错的词。两类证据各自保留。' },
] as const

export default function PracticePage() {
  const dict = useAtomValue(currentDictInfoAtom)
  const chapter = useAtomValue(currentChapterAtom)
  const owner = useLearningOwner()
  const setReview = useSetAtom(reviewModeInfoAtom)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mode: PracticeMode = modes.some((item) => item.id === params.get('mode')) ? params.get('mode') as PracticeMode : 'recall'
  const pool: PracticePool = pools.some((item) => item.id === params.get('pool')) ? params.get('pool') as PracticePool : 'chapter'
  const [limit, setLimit] = useState(6)
  const [prepared, setPrepared] = useState<{ items: SemanticItem[]; references: SemanticItem[]; words: ReturnType<typeof selectPracticeWords>['candidates']; count: number }>()
  const [preparing, setPreparing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const { data: words, error: contentError, mutate } = useSWR(dict.language === 'en' ? dict.url : null, wordListFetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false })
  const events = useLiveQuery(async () => (await db.learningEvents.where('eventType')
    .anyOf('word_attempted', 'semantic_recall_attempted', 'semantic_discrimination_attempted').toArray())
    .filter((event) => event.ownerUserId === owner), [owner])
  const pending = useLiveQuery(() => db.semanticRuns.orderBy('startedAt').reverse()
    .filter((run) => run.origin === 'manual' && run.ownerUserId === owner && run.dictionaryId === dict.id
      && run.completedAt === undefined && run.endedAt === undefined).first(), [dict.id, owner])
  const pendingSpelling = useLiveQuery(() => db.reviewRecords.orderBy('createTime').reverse()
    .filter((record) => record.origin === 'manual' && record.ownerUserId === owner && record.dict === dict.id && !record.isFinished).first(), [dict.id, owner])
  const selection = useMemo(() => words && events ? selectPracticeWords(words, events, dict.id, chapter, pool, mode) : undefined,
    [chapter, dict.id, events, mode, pool, words])

  useEffect(() => {
    let active = true
    setPrepared(undefined)
    setPreparing(true)
    setError('')
    if (!selection || !words) return () => { active = false }
    void (async () => {
      try {
        const items = await preparePracticeItems(selection.candidates, dict.id, limit, pool === 'uncertain' ? selection : undefined)
        const chapterWords = words.slice(chapter * CHAPTER_LENGTH, (chapter + 1) * CHAPTER_LENGTH)
        const extra = mode === 'discrimination' ? await preparePracticeItems(chapterWords, dict.id, CHAPTER_LENGTH) : []
        const references = Array.from(new Map([...items, ...extra].map((item) => [item.contentId, item])).values())
        const selectedWords = selection.candidates.filter((word) => items.some((item) => item.word === word.name))
        const count = mode === 'discrimination' ? buildSemanticDiscriminationQuestions(references, limit, items.map((item) => item.contentId)).length
          : mode === 'spelling' && pool === 'chapter' ? chapterWords.length : selectedWords.length
        if (active) setPrepared({ items, references, words: selectedWords, count })
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : '暂时无法准备这一组。') }
      finally { if (active) setPreparing(false) }
    })()
    return () => { active = false }
  }, [chapter, dict.id, limit, mode, pool, selection, words])

  const start = async () => {
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
        const run = await createManualSemanticRun(dict.id, mode, prepared.items, prepared.references, owner)
        if (getLocalLearningOwnerId() !== owner) throw new Error('账号已经改变，请重新准备。')
        navigate(semanticRunPath(run))
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法开始，原有记录仍然保留。') }
    finally { lock.current = false; setBusy(false) }
  }
  const change = (key: string, value: string) => setParams((old) => { const next = new URLSearchParams(old); next.set(key, value); return next }, { replace: true })
  const selectedMode = modes.find((item) => item.id === mode) ?? modes[1]
  const selectedPool = pools.find((item) => item.id === pool) ?? pools[0]
  const loading = preparing || !events || !words

  return <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
    <Header />
    <main className="mx-auto max-w-5xl px-6 pb-14 pt-9">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div><h1 className="wenyan-page-title">专项训练</h1><p className="wenyan-muted mt-2 text-sm">想练哪一种，就从一小段开始。</p></div>
        <Link to="/today" className="wenyan-link text-sm">按今天的安排学 <ArrowRight className="ml-1 inline" size={13} /></Link>
      </div>
      {pending && <section className="wenyan-practice-resume mb-7 flex items-center justify-between gap-5 px-5 py-4" aria-label="未完成的专项训练">
        <div><p className="text-sm font-medium">接着上次的{pending.mode === 'discrimination' ? '选择词义' : '词义回想'}</p>
          <p className="wenyan-muted mt-1 text-xs">已保存 {pending.index} / {pending.mode === 'discrimination' ? pending.discriminationQuestions?.length : pending.items.length}，可以从刚才的位置继续。</p></div>
        <Link className="wenyan-button-secondary shrink-0" to={semanticRunPath(pending)}>继续这一段</Link>
      </section>}
      {pendingSpelling && <section className="wenyan-practice-resume mb-7 flex items-center justify-between gap-5 px-5 py-4" aria-label="未完成的专项拼写">
        <div><p className="text-sm font-medium">接着上次的专项拼写</p><p className="wenyan-muted mt-1 text-xs">已保存 {pendingSpelling.index} / {pendingSpelling.words.length} 个词。</p></div>
        <button className="wenyan-button-secondary shrink-0" onClick={() => { if (pendingSpelling.ownerUserId !== getLocalLearningOwnerId()) return; setReview({ isReviewMode: true, reviewRecord: pendingSpelling }); navigate('/?practice=spelling') }}>继续拼写</button>
      </section>}
      <fieldset><legend className="wenyan-kicker mb-3">01 · 练什么</legend>
        <div className="grid gap-3 sm:grid-cols-3">{modes.map((item) => <label key={item.id} className={`wenyan-practice-mode ${mode === item.id ? 'is-selected' : ''}`}>
          <input type="radio" name="practice-mode" className="sr-only" value={item.id} checked={mode === item.id} onChange={() => change('mode', item.id)} />
          <div className="mb-5 flex items-center justify-between"><item.icon size={20} strokeWidth={1.5} aria-hidden="true" />{mode === item.id && <Check size={15} aria-hidden="true" />}</div>
          <span className="block text-base font-semibold">{item.title}</span><span className="wenyan-muted mt-2 block text-xs">{item.hint}</span>
        </label>)}</div>
      </fieldset>
      <section className="wenyan-focus-surface mt-6 px-6 py-6 sm:px-8 sm:py-7" aria-label="准备训练">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">{dict.name} · 第 {chapter + 1} 章</p><Link className="wenyan-link text-xs" to="/gallery">换词书 / 章节</Link></div>
        {dict.language !== 'en' ? <p className="wenyan-muted mt-7">专项训练目前支持英语词书，请先选择英语词书。</p> : <>
          <fieldset className="mt-7"><legend className="wenyan-kicker mb-3">02 · 练哪些词</legend><div className="flex flex-wrap gap-2">{pools.map((item) => <label key={item.id} className={`wenyan-practice-pool ${pool === item.id ? 'is-selected' : ''}`}>
            <input type="radio" className="sr-only" name="practice-pool" checked={pool === item.id} onChange={() => change('pool', item.id)} />{item.title}
          </label>)}</div></fieldset>
          <p className="wenyan-muted mt-3 min-h-[40px] text-xs leading-5">{selectedPool.detail}</p>
          {!(mode === 'spelling' && pool === 'chapter') && <fieldset className="mt-3 flex items-center gap-3"><legend className="sr-only">每段词数</legend><span className="wenyan-muted text-xs">这一段</span>{[6, 12].map((count) => <label key={count} className={`wenyan-practice-pool ${limit === count ? 'is-selected' : ''}`}><input className="sr-only" type="radio" name="practice-count" checked={limit === count} onChange={() => setLimit(count)} />最多 {count} 个</label>)}</fieldset>}
          <div className="mt-6 border-t border-[var(--wenyan-line-soft)] pt-5">
            <p className="text-sm">{selectedMode.detail}</p>
            <p className="wenyan-muted mt-3 text-xs leading-6" aria-live="polite">{contentError ? '词书暂时加载失败。已保存的学习记录不受影响。' : loading ? '正在整理这一小段…' : prepared?.count ? `本段 ${prepared.count} 个${mode === 'discrimination' ? '可辨认的词' : '词'}${mode === 'spelling' && pool === 'chapter' ? ' · 继续章节原有进度' : ' · 较久没练的优先'}` : pool === 'chapter' && mode === 'discrimination' ? '当前章节没有足够的不同释义组成题目，试试词义回想。' : '这一组暂时没有可练的词。没有记录不代表不会，先选当前章节即可。'}</p>
            {prepared?.count ? <p className="wenyan-muted mt-1 truncate text-xs" title={prepared.items.map((item) => item.word).join(' · ')}>{prepared.items.slice(0, 6).map((item) => item.word).join(' · ')}{prepared.items.length > 6 ? ' …' : ''}</p> : null}
            {error && <p role="alert" className="mt-3 text-sm text-[var(--wenyan-danger)]">{error}</p>}
            <div className="mt-5 flex items-center gap-4">
              <button className="wenyan-button-primary inline-flex items-center gap-2" disabled={loading || busy || !prepared?.count || Boolean(contentError)} onClick={() => void start()}>{busy ? '正在准备…' : mode === 'spelling' && pool === 'chapter' ? '继续拼写这一章' : `开始${selectedMode.title}`}<ArrowRight size={14} aria-hidden="true" /></button>
              {contentError && <button className="wenyan-button-secondary" onClick={() => void mutate()}>重试加载</button>}
              {!loading && !prepared?.count && pool !== 'chapter' && <button className="wenyan-link text-sm" onClick={() => change('pool', 'chapter')}>练当前章节</button>}
            </div>
          </div>
        </>}
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs"><p className="wenyan-muted">练习结果会进入学习记录。拼写、主动回想与辨认分别记录，随时可以暂停。</p><Link className="wenyan-link" to="/error-book">查看拼写错词</Link></div>
      <details className="mt-7 border-t border-[var(--wenyan-line-soft)] pt-4"><summary className="wenyan-muted cursor-pointer text-xs">该怎么选？</summary><div className="wenyan-muted mt-3 space-y-2 text-xs leading-6">
        <p>词形不稳：练拼写。看着词却说不出意思：先回想。意思相近、容易选错：用选择词义核对。模糊词来自你真实的自评或选错记录，不会凭空生成。</p>
        <p>中文 → 英文：可以在拼写页面开启“默写”，隐藏词形再输入；发音与提示设置会影响线索，因此只按真实拼写条件记录。它不等于无提示产出，也不替代词义回想。</p>
        <p>选择词义使用词书里的四个参考选项，适合检查辨认；它不测语境、搭配或熟词僻义。短段重复练习也不代表长期记住了。</p>
      </div></details>
    </main>
  </div>
}
