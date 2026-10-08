import type { SemanticRun } from '@/semantic/run'
import type { RecallRating } from '@/semantic/core'
import { endloadrevealSemanticItem, saveSemanticRating } from '@/semantic/runtime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

/** The answer is absent from the DOM until reveal. No grading API or AI dependency. */
export default function SemanticPage() {
  const { runId = '' } = useParams()
  const navigate = useNavigate()
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
      setRun(current)
      setResumedAfterReveal(current.revealedIndex === current.index)
      setStopped(current.hardStopAt !== undefined && Date.now() >= current.hardStopAt)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取这段学习。') }
  }, [runId])
  useEffect(() => { void restore() }, [restore])
  useEffect(() => { focus.current?.focus() }, [run?.index])
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

  const revealed = run?.revealedIndex === run?.index && Boolean(run)
  const completed = run?.completedAt !== undefined || run?.endedAt !== undefined
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'Escape') { event.preventDefault(); navigate('/today'); return }
      if (completed || busy || error) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); void reveal() }
      if (revealed && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault(); void rate(({ '1': 'not_recalled', '2': 'partial', '3': 'recalled' } as const)[event.key as '1' | '2' | '3'])
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [busy, completed, error, navigate, rate, reveal, revealed])

  const item = run?.items[run.index]
  return (
    <div className="min-h-screen text-[var(--wenyan-ink)]">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-8">
        <Link className="wenyan-brand text-xl no-underline" to="/today">Wenyan</Link>
        <Link className="wenyan-link text-sm" to="/today">暂停，回到今天</Link>
      </header>
      <main className="mx-auto max-w-3xl px-8 py-12">
        <p className="wenyan-kicker">词义回想</p>
        <p className="wenyan-muted mt-3 text-sm" role="status">{saved ? '自评已保存在本机，联网后可同步。' : '先回想，再查看释义。随时可以暂停。'}</p>
        {error && <div role="alert" className="mt-6"><p>{error}</p><button className="wenyan-button-secondary mt-3" onClick={() => void restore()}>重新读取进度</button></div>}
        {!run && !error && <p role="status" className="wenyan-muted mt-12">正在找回刚才的位置…</p>}
        {run && (completed || (stopped && !revealed)) ? (
          <section className="wenyan-focus-surface mt-10 p-10">
            <h1 ref={focus} tabIndex={-1} className="text-3xl outline-none">{completed ? '这一段，已经留下记录。' : '到时间了，今天先到这里。'}</h1>
            <p className="wenyan-muted mt-5">已保存 {run.index} 个词的自评。它们会帮助下一次安排，不代表已经完全掌握。</p>
            <button className="wenyan-button-primary mt-8" onClick={async () => { await endSemanticRun(run.id); navigate('/today') }}>回到今天</button>
          </section>
        ) : item && (
          <section className="wenyan-focus-surface mt-10 p-10">
            <div className="wenyan-mono wenyan-muted text-xs">{run!.index + 1} / {run!.items.length}</div>
            <h1 ref={focus} tabIndex={-1} className="mt-10 break-words text-5xl font-medium tracking-tight outline-none">{item.word}</h1>
            {!revealed ? <>
              <p className="wenyan-muted mb-10 mt-6">这个词是什么意思？先在心里说出，再核对。</p>
              <button disabled={busy || stopped} className="wenyan-button-primary" onClick={() => void reveal()}>查看释义 <span className="ml-3 opacity-60">Space</span></button>
            </> : <>
              <div className="my-8 space-y-3 text-xl leading-relaxed">{item.meanings.map((meaning, i) => <p key={i}>{meaning}</p>)}</div>
              <p className="wenyan-muted mb-5 text-sm">{resumedAfterReveal ? '恢复时释义已揭示；请按刚才的真实回想情况自评。' : '对照释义，你刚才回想到了多少？这是自评，不是系统判分。'}</p>
              <div className="flex flex-wrap gap-3">
                <button className="wenyan-button-secondary" disabled={busy} onClick={() => void rate('not_recalled')}>1 没想起</button>
                <button className="wenyan-button-secondary" disabled={busy} onClick={() => void rate('partial')}>2 想起部分</button>
                <button className="wenyan-button-primary" disabled={busy} onClick={() => void rate('recalled')}>3 想起了</button>
              </div>
            </>}
          </section>
        )}
        <p className="wenyan-muted mt-6 text-xs">释义来自当前词书，仅作核对。此处不测熟词僻义、阅读理解或主动运用。</p>
      </main>
    </div>
  )
}
