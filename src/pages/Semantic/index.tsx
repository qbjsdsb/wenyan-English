import { useSemanticEvidence } from '@/semantic/useEvidence'
import type { SemanticRun } from '@/semantic/run'
import type { RecallRating } from '@/semantic/core'
import { buildSemanticDiscriminationQuestions } from '@/semantic/discrimination'
import { createSemanticDiscriminationRunFromRecall } from '@/semantic/discriminationRuntime'
import { endSemanticRun, loadSemanticRun, revealSemanticItem, saveSemanticRating } from '@/semantic/runtime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

/** The answer is absent from the DOM until reveal. No grading API or AI dependency. */
export default function SemanticPage() {
  const { runId = '' } = useParams()
  const navigate = useNavigate()
  const evidence = useSemanticEvidence(runId)
  const [run, setRun] = useState<SemanticRun>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [resumedAfterReveal, setResumedAfterReveal] = useState(false)
  const lock = useRef(false)
  const focus = useRef<HTMLHeadingElement>(null)

  const restore = useCallback(async () => {
    try {
      const current = await loadSemanticRun(runId)
      if (current.mode === 'discrimination') throw new Error('请从参考释义辨认页面继续这一段。')
      setRun(current)
      setResumedAfterReveal(current.revealedIndex === current.index)
      setStopped(current.hardStopAt !== undefined && Date.now() >= current.hardStopAt)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取这段学习。') }
  }, [runId])
  useEffect(() => {
    void restore()
    const changed = () => { setRun(undefined); setSaved(false); void restore() }
    window.addEventListener('wenyan-learning-owner-changed', changed)
    window.addEventListener('storage', changed)
    return () => { window.removeEventListener('wenyan-learning-owner-changed', changed); window.removeEventListener('storage', changed) }
  }, [restore])
  useEffect(() => { focus.current?.focus() }, [run?.index, run?.revealedIndex])
  useEffect(() => {
    if (run?.hardStopAt === undefined) return
    const timer = window.setTimeout(() => setStopped(true), Math.max(0, run.hardStopAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [run?.hardStopAt])

  const reveal = useCallback(async () => {
    if (!run || lock.current || stopped || run.revealedIndex === run.index) return
    lock.current = true
    setBusy(true)
    setError('')
    try { setRun(await revealSemanticItem(run.id, run.index)); setResumedAfterReveal(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '未能保存揭示状态，请重试。') }
    finally { lock.current = false; setBusy(false) }
  }, [run, stopped])

  const rate = useCallback(async (rating: RecallRating) => {
    if (!run || lock.current || run.revealedIndex !== run.index) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const next = await saveSemanticRating(run.id, run.index, rating, resumedAfterReveal)
      setRun(next)
      setResumedAfterReveal(false)
      setSaved(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '这次自评尚未保存，请重试。') }
    finally { lock.current = false; setBusy(false) }
  }, [run, resumedAfterReveal])

  const startObjectiveCheck = useCallback(async () => {
    if (!run || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const check = await createSemanticDiscriminationRunFromRecall(run.id)
      navigate(`/semantic-check/${encodeURIComponent(check.id)}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法开始参考释义辨认。')
      lock.current = false
      setBusy(false)
    }
  }, [navigate, run])

  const revealed = run?.revealedIndex === run?.index && Boolean(run)
  const returnPath = run?.origin === 'manual' ? '/practice' : '/today'
  const returnLabel = run?.origin === 'manual' ? '回到专项训练' : '回到今天'
  const completed = run?.completedAt !== undefined || run?.endedAt !== undefined
  const canObjectiveCheck = Boolean(
    run?.completedAt !== undefined
      && (run.hardStopAt === undefined || Date.now() < run.hardStopAt)
      && buildSemanticDiscriminationQuestions(run.items).length > 0,
  )
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'Escape') { event.preventDefault(); navigate(returnPath); return }
      if (completed || busy || error) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); void reveal() }
      if (revealed && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault(); void rate(({ '1': 'not_recalled', '2': 'partial', '3': 'recalled' } as const)[event.key as '1' | '2' | '3'])
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [busy, completed, error, navigate, rate, reveal, revealed, returnPath])

  const item = run?.items[run.index]
  return (
    <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-8">
        <Link className="wenyan-brand text-xl no-underline" to="/today">Wenyan</Link>
        <Link className="wenyan-link text-sm" to={returnPath}>{completed ? returnLabel : `暂停，${returnLabel}`}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
        <p className="wenyan-kicker">词义回想</p>
        <p className="wenyan-muted mt-3 text-sm" role="status">{saved ? '自评已保存在本机，联网后可同步。' : '先回想，再查看释义。随时可以暂停。'}</p>
        {error && <div role="alert" className="mt-6"><p>{error}</p><button className="wenyan-button-secondary mt-3" onClick={() => void restore()}>重新读取进度</button></div>}
        {!run && !error && <p role="status" className="wenyan-muted mt-12">正在找回刚才的位置…</p>}
        {run && (completed || (stopped && !revealed)) ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <h1 ref={focus} tabIndex={-1} className="text-3xl outline-none">{completed ? '这一段，已经留下记录。' : '到时间了，今天先到这里。'}</h1>
            <p className="wenyan-muted mt-5">已保存 {run.index} 个词的自评。它们会帮助下一次安排，不代表已经完全掌握。</p>
            {evidence?.recall && <p className="mt-4 text-sm">想起 {evidence.recall.selfReported.recalled} · 部分 {evidence.recall.selfReported.partial} · 没想起 {evidence.recall.selfReported.notRecalled}</p>}
            {run.origin === 'manual' && Boolean(evidence?.recall?.revisit.length) && <Link className="wenyan-link mt-4 inline-block text-sm" to="/practice?pool=uncertain&mode=recall">下次优先练模糊词 →</Link>}
            {completed && canObjectiveCheck && (
              <div className="mt-7 rounded-[var(--wenyan-radius-sm)] border border-[var(--wenyan-line-soft)] p-4">
                <p className="text-sm font-medium">再做一小段参考释义辨认</p>
                <p className="wenyan-muted mt-2 text-xs leading-5">从刚才这些真实词书参考里做 4 选 1。系统能客观记录是否选中当前词条的参考释义，但不会把它叫作“掌握”。</p>
                <button disabled={busy} className="wenyan-button-primary mt-4" onClick={() => void startObjectiveCheck()}>{busy ? '正在准备…' : '开始辨认'}</button>
              </div>
            )}
            <button className={`${canObjectiveCheck ? 'wenyan-button-secondary' : 'wenyan-button-primary'} mt-5`} disabled={busy} onClick={async () => { setBusy(true); try { await endSemanticRun(run.id); navigate(returnPath) } catch { setError('暂时无法结束这一段，请重试。'); setBusy(false) } }}>{returnLabel}</button>
          </section>
        ) : run && item && (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="wenyan-kicker">{revealed ? '核对与自评' : '先试着回想'}</span>
              <span className="wenyan-mono wenyan-muted text-xs">{run.index + 1} / {run.items.length}</span>
            </div>
            <progress className="wenyan-recall-progress mt-4" value={run.index} max={run.items.length} aria-label="本段已保存的自评" />
            <h1 ref={focus} tabIndex={-1} className="mt-10 break-words text-4xl font-medium tracking-tight sm:text-5xl outline-none">{item.word}</h1>
            {!revealed ? <>
              <p className="wenyan-muted mb-10 mt-6">这个词是什么意思？先在心里说出，再核对。</p>
              <button disabled={busy || stopped} className="wenyan-button-primary" onClick={() => void reveal()}>查看释义 <kbd aria-hidden="true" className="wenyan-key ml-3">Space</kbd></button>
            </> : <>
              <div className="my-8 space-y-3 border-l-2 border-[var(--wenyan-line)] pl-5 text-lg leading-relaxed sm:text-xl">{item.meanings.map((meaning, i) => <p key={i}>{meaning}</p>)}</div>
              <p className="wenyan-muted mb-5 text-sm">{resumedAfterReveal ? '恢复时释义已揭示；请按刚才的真实回想情况自评。' : '对照释义，你刚才回想到了多少？这是自评，不是系统判分。'}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button className="wenyan-recall-choice" aria-label="1 没想起" aria-keyshortcuts="1" disabled={busy} onClick={() => void rate('not_recalled')}><kbd aria-hidden="true" className="wenyan-key">1</kbd><span>没想起</span></button>
                <button className="wenyan-recall-choice" aria-label="2 想起部分" aria-keyshortcuts="2" disabled={busy} onClick={() => void rate('partial')}><kbd aria-hidden="true" className="wenyan-key">2</kbd><span>想起部分</span></button>
                <button className="wenyan-recall-choice" aria-label="3 想起了" aria-keyshortcuts="3" disabled={busy} onClick={() => void rate('recalled')}><kbd aria-hidden="true" className="wenyan-key">3</kbd><span>想起了</span></button>
              </div>
              <p className="wenyan-muted mt-4 text-xs">{busy ? '正在保存这次自评…' : '选择后保存并继续。不确定时，如实选择即可。'}</p>
            </>}
          </section>
        )}
        <p className="wenyan-muted mt-6 text-xs">释义来自当前词书，仅作核对。此处不测熟词僻义、阅读理解或主动运用。</p>
      </main>
    </div>
  )
}
