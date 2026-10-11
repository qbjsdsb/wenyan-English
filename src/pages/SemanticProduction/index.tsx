import { practiceReturnPath } from '@/semantic/practiceChoices'
import { endSemanticProductionRun, loadSemanticProductionRun, saveSemanticProductionAnswer } from '@/semantic/productionRuntime'
import type { SemanticProductionPayload } from '@/semantic/production'
import type { SemanticRun } from '@/semantic/run'
import { useSemanticEvidence } from '@/semantic/useEvidence'
import { useRunVisitGuard, useRunVisitKey } from '@/semantic/useRunVisit'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

export default function SemanticProductionPage() {
  const { runId = '' } = useParams()
  const visitKey = useRunVisitKey(runId)
  return <SemanticProductionRun key={visitKey} runId={runId} />
}

function SemanticProductionRun({ runId }: { runId: string }) {
  const active = useRunVisitGuard()
  const navigate = useNavigate()
  const evidence = useSemanticEvidence(runId)
  const [run, setRun] = useState<SemanticRun>()
  const [response, setResponse] = useState('')
  const [feedback, setFeedback] = useState<SemanticProductionPayload>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stopped, setStopped] = useState(false)
  const lock = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  const restore = useCallback(async () => {
    try {
      const current = await loadSemanticProductionRun(runId)
      if (!active.current) return
      setRun(current)
      setResponse('')
      setFeedback(undefined)
      setStopped(current.hardStopAt !== undefined && Date.now() >= current.hardStopAt)
      setError('')
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : '无法读取这段训练。')
    }
  }, [active, runId])

  useEffect(() => { void restore() }, [restore])
  useEffect(() => {
    if (!feedback && run?.completedAt === undefined && run?.endedAt === undefined && !stopped) input.current?.focus()
  }, [feedback, run?.index, run?.completedAt, run?.endedAt, stopped])
  useEffect(() => {
    if (run?.hardStopAt === undefined) return
    const timer = window.setTimeout(() => setStopped(true), Math.max(0, run.hardStopAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [run?.hardStopAt])

  const returnPath = run ? practiceReturnPath('production', run.practiceChoices) : '/practice?mode=production'
  const completed = run?.completedAt !== undefined || run?.endedAt !== undefined
  const item = run?.items[run.index]

  const submit = useCallback(async () => {
    if (!active.current || !run || !item || feedback || stopped || lock.current || !response.trim()) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await saveSemanticProductionAnswer(run.id, run.index, response)
      if (!active.current) return
      setRun(saved.run)
      setFeedback(saved.payload)
      setResponse('')
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : '这次答案尚未保存，请重试。')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [active, feedback, item, response, run, stopped])

  const continueAfterFeedback = useCallback(() => {
    setFeedback(undefined)
    setResponse('')
  }, [])

  const finishStoppedRun = useCallback(async () => {
    if (!run || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (run.completedAt === undefined && run.endedAt === undefined) await endSemanticProductionRun(run.id)
      if (active.current) navigate(returnPath)
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : '暂时无法结束这一段，请重试。')
      lock.current = false
      setBusy(false)
    }
  }, [active, navigate, returnPath, run])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || busy) return
      if (event.key === 'Escape') {
        event.preventDefault()
        navigate(returnPath)
        return
      }
      if (feedback && event.key === 'Enter') {
        event.preventDefault()
        continueAfterFeedback()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [busy, continueAfterFeedback, feedback, navigate, returnPath])

  const showSummary = Boolean(run && !feedback && (completed || stopped))
  return (
    <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-8">
        <Link className="wenyan-brand text-xl no-underline" to="/today">Wenyan</Link>
        <Link className="wenyan-link text-sm" to={returnPath}>{completed ? '回到专项训练' : '暂停，回到专项训练'}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
        <p className="wenyan-kicker">看义写词</p>
        <p className="wenyan-muted mt-3 text-sm">只按当前词书的参考词头判分。</p>
        {error && <div role="alert" className="mt-6"><p>{error}</p><button className="wenyan-button-secondary mt-3" onClick={() => void restore()}>重新读取进度</button></div>}
        {!run && !error && <p role="status" className="wenyan-muted mt-12">正在找回刚才的位置…</p>}

        {showSummary && run ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <h1 className="text-3xl">{completed ? '这一段完成了。' : '到时间了，今天先到这里。'}</h1>
            <p className="wenyan-muted mt-5">已保存 {run.index} 次输入。</p>
            {evidence?.production && <p className="mt-4 text-sm">写对 {evidence.production.correct} · 写错 {evidence.production.incorrect}</p>}
            {Boolean(evidence?.production?.revisit.length) && <Link className="wenyan-link mt-4 inline-block text-sm" to="/practice?pool=uncertain&mode=production">下次优先练写错的词 →</Link>}
            <button className="wenyan-button-primary mt-6" disabled={busy} onClick={() => void finishStoppedRun()}>回到专项训练</button>
          </section>
        ) : feedback ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10" aria-live="polite">
            <div className="flex items-center justify-between gap-4">
              <span className="wenyan-kicker">{feedback.isCorrect ? '写对了' : '核对一下'}</span>
              <span className="wenyan-mono wenyan-muted text-xs">{Math.min(run?.index ?? 0, run?.items.length ?? 0)} / {run?.items.length ?? 0}</span>
            </div>
            <p className={`mt-8 text-lg font-medium ${feedback.isCorrect ? '' : 'text-[var(--wenyan-danger)]'}`}>{feedback.isCorrect ? '和词书参考一致。' : `你写的是：${feedback.response}`}</p>
            <p className="wenyan-muted mt-5 text-sm">参考词头</p>
            <p className="wenyan-mono mt-2 break-words text-4xl font-medium tracking-tight sm:text-5xl">{feedback.correctHeadword}</p>
            <button className="wenyan-button-primary mt-8" onClick={continueAfterFeedback}>{run?.completedAt !== undefined ? '查看结果' : '下一个'} <kbd aria-hidden="true" className="wenyan-key ml-3">Enter</kbd></button>
          </section>
        ) : run && item ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="wenyan-kicker">根据释义写词</span>
              <span className="wenyan-mono wenyan-muted text-xs">{run.index + 1} / {run.items.length}</span>
            </div>
            <progress className="wenyan-recall-progress mt-4" value={run.index} max={run.items.length} aria-label="本段已保存的输入" />
            <div className="my-9 space-y-3 border-l-2 border-[var(--wenyan-line)] pl-5 text-lg leading-relaxed sm:text-xl">
              {item.meanings.map((meaning, index) => <p key={index}>{meaning}</p>)}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
              <label className="wenyan-muted block text-sm" htmlFor="semantic-production-answer">英文词头</label>
              <input
                id="semantic-production-answer"
                ref={input}
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={300}
                disabled={busy || stopped}
                className="mt-3 w-full rounded-[var(--wenyan-radius-sm)] border border-[var(--wenyan-line)] bg-transparent px-4 py-3 text-xl outline-none focus:border-[var(--wenyan-ink-soft)]"
                placeholder="输入英文词"
              />
              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="wenyan-muted text-xs">{busy ? '正在保存…' : 'Enter 提交'}</p>
                <button type="submit" className="wenyan-button-primary" disabled={busy || stopped || !response.trim()}>提交</button>
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  )
}
