import TrainingHeader from '@/components/TrainingHeader'
import { practiceReturnPath } from '@/semantic/practiceChoices'
import type { SemanticProductionPayload } from '@/semantic/production'
import { endSemanticProductionRun, loadSemanticProductionRun, saveSemanticProductionAnswer } from '@/semantic/productionRuntime'
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

  useEffect(() => {
    void restore()
  }, [restore])
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
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a, input, textarea, select, summary, [contenteditable="true"]')) return
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
      <TrainingHeader returnPath={returnPath} returnLabel={completed ? '回到专项训练' : '暂停，回到专项训练'} />
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
        <p className="wenyan-kicker">看义写词</p>
        <p className="wenyan-muted mt-3 text-sm">只按当前词书的参考词头判分。</p>
        {error && (
          <div role="alert" className="mt-6">
            <p>{error}</p>
            <button className="wenyan-button-secondary mt-3" onClick={() => void restore()}>
              重新读取进度
            </button>
          </div>
        )}
        {!run && !error && (
          <p role="status" className="wenyan-muted mt-12">
            正在找回刚才的位置…
          </p>
        )}

        {showSummary && run ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <h1 className="text-3xl">{completed ? '这一段完成了。' : '到时间了，今天先到这里。'}</h1>
            <p className="wenyan-muted mt-5">已保存 {run.index} 次输入。</p>
            {evidence?.production && (
              <p className="mt-4 text-sm">
                写对 {evidence.production.correct} · 写错 {evidence.production.incorrect}
              </p>
            )}
            {Boolean(evidence?.production?.revisit.length) && (
              <Link className="wenyan-link mt-4 inline-block text-sm" to="/practice?pool=uncertain&mode=production">
                下次优先练写错的词 →
              </Link>
            )}
            <button className="wenyan-button-primary mt-6" disabled={busy} onClick={() => void finishStoppedRun()}>
              回到专项训练
            </button>
          </section>
        ) : feedback ? (
          <section
            className="wenyan-focus-surface mt-8 p-6 sm:p-10"
            data-feedback={feedback.isCorrect ? 'correct' : 'wrong'}
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="wenyan-kicker">{feedback.isCorrect ? '写对了' : '核对一下'}</span>
              <span className="wenyan-mono wenyan-muted text-xs">
                {Math.min(run?.index ?? 0, run?.items.length ?? 0)} / {run?.items.length ?? 0}
              </span>
            </div>

            {feedback.isCorrect ? (
              <div className="mt-8 border-y border-[var(--wenyan-line-soft)] py-6">
                <p className="wenyan-muted text-[11px]">参考词头</p>
                <p className="wenyan-mono mt-2 break-words text-4xl font-medium tracking-tight sm:text-5xl">{feedback.correctHeadword}</p>
              </div>
            ) : (
              <div className="mt-8 space-y-6">
                <div>
                  <p className="wenyan-muted text-[11px]">你的答案</p>
                  <p className="wenyan-mono mt-2 break-words text-xl text-[var(--wenyan-ink-secondary)] underline decoration-[color-mix(in_srgb,var(--wenyan-danger)_48%,transparent)] decoration-1 underline-offset-4">
                    {feedback.response}
                  </p>
                </div>
                <div className="border-l-2 border-[var(--wenyan-success)] pl-5">
                  <p className="wenyan-muted text-[11px]">参考词头</p>
                  <p className="wenyan-mono mt-2 break-words text-4xl font-medium tracking-tight sm:text-5xl">{feedback.correctHeadword}</p>
                </div>
              </div>
            )}

            <button className="wenyan-button-primary mt-8" onClick={continueAfterFeedback}>
              {run?.completedAt !== undefined ? '查看结果' : '下一个'}{' '}
              <kbd aria-hidden="true" className="wenyan-key ml-3">
                Enter
              </kbd>
            </button>
          </section>
        ) : run && item ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="wenyan-kicker">根据释义写词</span>
              <span className="wenyan-mono wenyan-muted text-xs">
                {run.index + 1} / {run.items.length}
              </span>
            </div>
            <progress className="wenyan-recall-progress mt-4" value={run.index} max={run.items.length} aria-label="本段已保存的输入" />
            <div className="my-9 space-y-3 border-l-2 border-[var(--wenyan-line)] pl-5 text-lg leading-relaxed sm:text-xl">
              {item.meanings.map((meaning, index) => (
                <p key={index}>{meaning}</p>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <label className="wenyan-muted block text-[11px]" htmlFor="semantic-production-answer">
                英文词头
              </label>
              <div className="mt-2 border-b border-[var(--wenyan-line)] transition-colors focus-within:border-[var(--wenyan-accent)]">
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
                  className="wenyan-mono w-full bg-transparent px-0 py-3 text-2xl tracking-tight text-[var(--wenyan-ink)] outline-none placeholder:text-[var(--wenyan-ink-muted)] disabled:opacity-50 sm:text-[28px]"
                  placeholder="输入英文词"
                />
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="wenyan-muted text-xs">{busy ? '正在保存…' : 'Enter 提交'}</p>
                <button type="submit" className="wenyan-button-primary" disabled={busy || stopped || !response.trim()}>
                  提交
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  )
}
