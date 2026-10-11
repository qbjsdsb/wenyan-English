import { useRunVisitGuard, useRunVisitKey } from '@/semantic/useRunVisit'
import { practiceReturnPath } from '@/semantic/practiceChoices'
import { useSemanticEvidence } from '@/semantic/useEvidence'
import type { SemanticDiscriminationQuestion } from '@/semantic/discrimination'
import type { SemanticRun } from '@/semantic/run'
import { endSemanticDiscriminationRun, loadSemanticDiscriminationRun, saveSemanticDiscriminationAnswer } from '@/semantic/discriminationRuntime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

interface Feedback {
  question: SemanticDiscriminationQuestion
  selectedContentId: string
  isCorrect: boolean
}

export default function SemanticCheckPage() {
  const { runId = '' } = useParams()
  const visitKey = useRunVisitKey(runId)
  return <SemanticCheckRun key={visitKey} runId={runId} />
}

function SemanticCheckRun({ runId }: { runId: string }) {
  const active = useRunVisitGuard()
  const navigate = useNavigate()
  const evidence = useSemanticEvidence(runId)
  const [run, setRun] = useState<SemanticRun>()
  const [feedback, setFeedback] = useState<Feedback>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stopped, setStopped] = useState(false)
  const lock = useRef(false)
  const focus = useRef<HTMLHeadingElement>(null)

  const restore = useCallback(async () => {
    try {
      const current = await loadSemanticDiscriminationRun(runId)
      if (!active.current) return
      setRun(current)
      setFeedback(undefined)
      setStopped(current.hardStopAt !== undefined && Date.now() >= current.hardStopAt)
      setError('')
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : '无法读取这段选择词义。')
    }
  }, [active, runId])

  useEffect(() => { void restore() }, [restore])
  useEffect(() => { focus.current?.focus() }, [run?.index, feedback])
  useEffect(() => {
    if (run?.hardStopAt === undefined) return
    const timer = window.setTimeout(() => setStopped(true), Math.max(0, run.hardStopAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [run?.hardStopAt])

  const answer = useCallback(async (selectedContentId: string) => {
    if (!active.current || !run || feedback || lock.current || stopped) return
    const question = run.discriminationQuestions?.[run.index]
    if (!question) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await saveSemanticDiscriminationAnswer(run.id, run.index, selectedContentId)
      if (!active.current) return
      setRun(saved.run)
      setFeedback({ question, selectedContentId, isCorrect: saved.payload.isCorrect })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '这次选择尚未保存，请重试。')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [active, feedback, run, stopped])

  const continueAfterFeedback = useCallback(() => setFeedback(undefined), [])
  const returnPath = run?.origin === 'manual' ? practiceReturnPath(run.mode === 'discrimination' ? 'discrimination' : 'recall', run.practiceChoices) : '/today'
  const returnLabel = run?.origin === 'manual' ? '回到专项训练' : '回到今天'
  const completed = run?.completedAt !== undefined || run?.endedAt !== undefined
  const question = run?.discriminationQuestions?.[run.index]

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && !busy) { event.preventDefault(); navigate(returnPath); return }
      if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
      if (busy || error) return
      if (feedback && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault(); continueAfterFeedback(); return
      }
      if (!feedback && !completed && !stopped && question && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        const index = Number(event.key) - 1
        const option = question.options[index]
        if (option) void answer(option.contentId)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [answer, busy, completed, continueAfterFeedback, error, feedback, navigate, question, stopped, returnPath])

  return (
    <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-8">
        <Link className="wenyan-brand text-xl no-underline" to="/today">Wenyan</Link>
        <Link className="wenyan-link text-sm" to={returnPath}>{completed ? returnLabel : `暂停，${returnLabel}`}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
        <p className="wenyan-kicker">选择词义</p>
        <p className="wenyan-muted mt-3 text-sm">选出这个词在当前词书中的释义。</p>

        {error && <div role="alert" className="mt-6"><p>{error}</p><button className="wenyan-button-secondary mt-3" onClick={() => void restore()}>重新读取进度</button></div>}
        {!run && !error && <p role="status" className="wenyan-muted mt-12">正在找回刚才的位置…</p>}

        {run && feedback ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <p className="wenyan-kicker">{feedback.isCorrect ? '选对了' : '这次选错了'}</p>
            <h1 ref={focus} tabIndex={-1} className="mt-6 break-words text-4xl font-medium tracking-tight outline-none sm:text-5xl">{feedback.question.word}</h1>
            <div className="mt-8 space-y-3">
              {feedback.question.options.map((option, index) => {
                const correct = option.contentId === feedback.question.correctContentId
                const selected = option.contentId === feedback.selectedContentId
                return (
                  <div key={option.contentId} className={`rounded-[var(--wenyan-radius-sm)] border px-4 py-3 text-sm leading-6 ${
                    correct ? 'border-[var(--wenyan-success)] bg-[color-mix(in_srgb,var(--wenyan-success)_7%,transparent)]'
                      : selected ? 'border-[var(--wenyan-danger)]' : 'border-[var(--wenyan-line-soft)]'
                  }`}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="wenyan-mono wenyan-muted text-[10px]">{index + 1}</span>
                      {correct && <span className="text-[11px] text-[var(--wenyan-success)]">正确释义</span>}
                    </div>
                    {option.meanings.map((meaning, meaningIndex) => <p key={meaningIndex}>{meaning}</p>)}
                  </div>
                )
              })}
            </div>
            <button className="wenyan-button-primary mt-7" onClick={continueAfterFeedback}>
              {run.completedAt !== undefined ? '查看结果' : '继续'} <kbd aria-hidden="true" className="wenyan-key ml-3">Enter</kbd>
            </button>
          </section>
        ) : run && (completed || stopped || !question) ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <h1 ref={focus} tabIndex={-1} className="text-3xl outline-none">{completed ? '这一段完成了。' : '到时间了，今天先到这里。'}</h1>
            <p className="wenyan-muted mt-5">已保存 {run.index} 次选择。</p>
            {evidence?.recognition && <p className="mt-4 text-sm">选对 {evidence.recognition.correct} · 选错 {evidence.recognition.incorrect}</p>}
            {run.origin === 'manual' && Boolean(evidence?.recognition?.incorrect) && <Link className="wenyan-link mt-4 inline-block text-sm" to="/practice?pool=uncertain&mode=recall">换成主动回想，巩固模糊词 →</Link>}
            <button className="wenyan-button-primary mt-8" disabled={busy} onClick={async () => { setBusy(true); try { await endSemanticDiscriminationRun(run.id); if (active.current) navigate(returnPath) } catch { setError('暂时无法结束这一段，请重试。'); setBusy(false) } }}>{returnLabel}</button>
          </section>
        ) : run && question ? (
          <section className="wenyan-focus-surface mt-8 p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="wenyan-kicker">先判断，再核对</span>
              <span className="wenyan-mono wenyan-muted text-xs">{run.index + 1} / {run.discriminationQuestions?.length ?? 0}</span>
            </div>
            <progress className="wenyan-recall-progress mt-4" value={run.index} max={run.discriminationQuestions?.length ?? 1} aria-label="本段已保存的选择" />
            <h1 ref={focus} tabIndex={-1} className="mt-10 break-words text-4xl font-medium tracking-tight outline-none sm:text-5xl">{question.word}</h1>
            <p className="wenyan-muted mb-6 mt-5 text-sm">哪组释义属于这个词？</p>
            <div className="grid grid-cols-1 gap-3">
              {question.options.map((option, index) => (
                <button key={option.contentId} disabled={busy || stopped} className="wenyan-recall-choice items-start text-left" aria-label={`${index + 1} ${option.meanings.join('；')}`} aria-keyshortcuts={String(index + 1)} onClick={() => void answer(option.contentId)}>
                  <kbd aria-hidden="true" className="wenyan-key shrink-0">{index + 1}</kbd>
                  <span className="space-y-1">{option.meanings.map((meaning, meaningIndex) => <span className="block" key={meaningIndex}>{meaning}</span>)}</span>
                </button>
              ))}
            </div>
            <p className="wenyan-muted mt-4 text-xs">{busy ? '正在保存…' : '按 1–4 或点击选择。'}</p>
          </section>
        ) : null}
      </main>
    </div>
  )
}
