import { getReadingPassage } from '@/reading/content'
import { draftKey, readDraft } from '@/reading/draft'
import { saveReadingAttempt } from '@/reading/events'
import type { ReadingAnswerDraft, ReadingAttemptSummary } from '@/reading/types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const primaryButton = 'wenyan-button-primary shrink-0'

export default function ReadingPage() {
  const { contentId = '' } = useParams()
  const passage = getReadingPassage(contentId)
  const [ownerUserId, setOwnerUserId] = useState(() => getLocalLearningOwnerId())
  const ownerUserIdRef = useRef(ownerUserId)
  const restored = useMemo(
    () => (passage ? readDraft(passage, ownerUserId) : undefined),
    [ownerUserId, passage],
  )
  const [startedAt, setStartedAt] = useState(() => restored?.startedAt ?? Date.now())
  const [answers, setAnswers] = useState<ReadingAnswerDraft[]>(() => restored?.answers ?? [])
  const [summary, setSummary] = useState<ReadingAttemptSummary>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [articleFocus, setArticleFocus] = useState(false)
  const [draftWarning, setDraftWarning] = useState('')
  const submittingGeneration = useRef<number>()
  const passageIdentity = passage ? `${passage.id}:${passage.version}` : ''
  const passageIdentityRef = useRef(passageIdentity)
  const attemptGenerationRef = useRef(0)

  useEffect(() => {
    if (passageIdentityRef.current === passageIdentity) return
    passageIdentityRef.current = passageIdentity
    attemptGenerationRef.current += 1
    const nextOwner = getLocalLearningOwnerId()
    ownerUserIdRef.current = nextOwner
    const nextDraft = passage ? readDraft(passage, nextOwner) : undefined
    setOwnerUserId(nextOwner)
    setStartedAt(nextDraft?.startedAt ?? Date.now())
    setAnswers(nextDraft?.answers ?? [])
    setSummary(undefined)
    setBusy(false)
    setError('')
    setDraftWarning('')
    setArticleFocus(false)
  }, [passage, passageIdentity])

  useEffect(() => {
    const ownerChanged = () => {
      const nextOwner = getLocalLearningOwnerId()
      if (nextOwner === ownerUserIdRef.current) return
      // Update synchronously before React commits state. Multiple auth-owner
      // notifications can arrive in the same JS turn (A -> B -> A); comparing
      // only against the render closure would otherwise miss the return to A.
      ownerUserIdRef.current = nextOwner
      attemptGenerationRef.current += 1
      const nextDraft = passage ? readDraft(passage, nextOwner) : undefined
      setOwnerUserId(nextOwner)
      setStartedAt(nextDraft?.startedAt ?? Date.now())
      setAnswers(nextDraft?.answers ?? [])
      setSummary(undefined)
      setBusy(false)
      setDraftWarning('')
      setError('账号已切换。已为当前账号重新读取独立的阅读草稿。')
    }
    window.addEventListener('wenyan-learning-owner-changed', ownerChanged)
    window.addEventListener('storage', ownerChanged)
    return () => {
      window.removeEventListener('wenyan-learning-owner-changed', ownerChanged)
      window.removeEventListener('storage', ownerChanged)
    }
  }, [passage])

  if (!passage) {
    return (
      <div className="min-h-screen text-[var(--wenyan-ink)]">
        <header className="border-b border-[var(--wenyan-line-soft)]">
          <div className="mx-auto flex h-[58px] max-w-5xl items-center justify-between px-6">
            <Link to="/today" className="wenyan-brand text-[20px] font-semibold no-underline">Wenyan</Link>
            <Link to="/today" className="wenyan-link text-sm">返回</Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-6 py-16">
          <h1 className="wenyan-page-title text-[26px]">这篇阅读暂时不可用</h1>
          <p className="wenyan-muted mt-3 text-sm">内容尚未导入，或版本已经更新。</p>
        </main>
      </div>
    )
  }

  const updateAnswer = (questionId: string, selectedOptionId: string) => {
    if (busy || summary || submittingGeneration.current === attemptGenerationRef.current) return
    if (getLocalLearningOwnerId() !== ownerUserId) {
      setError('账号刚刚发生变化。请重新选择答案，避免把草稿写入错误账号。')
      return
    }
    const previous = answers.find((answer) => answer.questionId === questionId)
    if (previous?.selectedOptionId === selectedOptionId) return
    const next: ReadingAnswerDraft = {
      questionId,
      selectedOptionId,
      answerChangeCount: previous?.selectedOptionId ? previous.answerChangeCount + 1 : previous?.answerChangeCount ?? 0,
    }
    const merged = [...answers.filter((answer) => answer.questionId !== questionId), next]
    setAnswers(merged)
    try {
      window.localStorage.setItem(
        draftKey(passage.id, passage.version, ownerUserId),
        JSON.stringify({ ownerUserId, startedAt, answers: merged }),
      )
      setDraftWarning('')
    } catch {
      setDraftWarning('草稿暂时无法保存；请保持此页打开，完成后提交。')
    }
  }

  const submit = async () => {
    if (busy || summary || submittingGeneration.current === attemptGenerationRef.current) return
    if (getLocalLearningOwnerId() !== ownerUserId) {
      setError('账号已经切换。这次阅读不会提交到新的账号；请重新打开当前阅读。')
      return
    }
    const submittedGeneration = attemptGenerationRef.current
    submittingGeneration.current = submittedGeneration
    const submittedOwnerUserId = ownerUserId
    const submissionStillCurrent = () => (
      attemptGenerationRef.current === submittedGeneration
      && passageIdentityRef.current === passageIdentity
      && ownerUserIdRef.current === submittedOwnerUserId
      && getLocalLearningOwnerId() === submittedOwnerUserId
    )
    setBusy(true)
    setError('')
    try {
      const saved = await saveReadingAttempt(passage, answers, Math.max(0, Date.now() - startedAt), submittedOwnerUserId)
      if (!submissionStillCurrent()) return
      try {
        window.localStorage.removeItem(draftKey(passage.id, passage.version, submittedOwnerUserId))
      } catch {
        // Draft cleanup is best-effort and only runs for the still-current attempt.
      }
      setDraftWarning('')
      setSummary(saved)
    } catch (cause) {
      if (!submissionStillCurrent()) return
      setError(cause instanceof Error ? cause.message : '暂时无法保存这次阅读。')
    } finally {
      if (submittingGeneration.current === submittedGeneration) submittingGeneration.current = undefined
      if (submissionStillCurrent()) setBusy(false)
    }
  }

  const answeredCount = answers.filter((answer) => answer.selectedOptionId).length
  const progress = passage.questions.length ? Math.round((answeredCount / passage.questions.length) * 100) : 0

  return (
    <div className="wenyan-reading-shell min-h-screen text-[var(--wenyan-ink)]">
      <div className="wenyan-reading-progress" style={{ width: `${summary ? 100 : progress}%` }} aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-[var(--wenyan-line-soft)] bg-[color-mix(in_srgb,var(--wenyan-paper)_90%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-6xl items-center justify-between gap-5 px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/today" className="wenyan-brand text-[20px] font-semibold no-underline">Wenyan</Link>
            <span className="h-4 w-px bg-[var(--wenyan-line)]" />
            <span className="wenyan-muted truncate text-xs">{passage.source.label} · {passage.estimatedMinutes} 分钟 · {passage.questions.length} 题</span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              className="wenyan-link text-sm"
              aria-pressed={articleFocus}
              onClick={() => setArticleFocus((current) => !current)}
            >
              {articleFocus ? '显示题目' : '专注文章'}
            </button>
            <Link to="/today" className="wenyan-link text-sm">结束阅读</Link>
          </div>
        </div>
      </header>

      {(error || draftWarning) && (
        <div role="alert" className="mx-auto max-w-6xl px-6 pt-4 text-sm text-[var(--wenyan-danger)]">
          {error || draftWarning}
        </div>
      )}
      <main
        className={`mx-auto w-full px-6 pb-24 pt-12 ${
          articleFocus ? 'max-w-3xl' : 'grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_360px]'
        }`}
      >
        <article className={`min-w-0 ${articleFocus ? 'mx-auto w-full max-w-[720px]' : ''}`}>
          <h1 className="mb-9 max-w-[680px] text-[31px] font-semibold leading-[1.22] tracking-[-0.038em] text-[var(--wenyan-ink)]">{passage.title}</h1>
          <div className="wenyan-reading-copy space-y-6">
            {passage.paragraphs.map((paragraph, index) => (
              <p key={`${passage.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </article>

        {!articleFocus && (
          <section aria-label="阅读题目" className="min-w-0 lg:pt-[2px]">
            <div>
              {passage.questions.map((question, index) => {
                const answer = answers.find((item) => item.questionId === question.id)
                const correct = summary ? answer?.selectedOptionId === question.correctOptionId : undefined
                return (
                  <article
                    key={question.id}
                    className={`${index > 0 ? 'border-t border-[var(--wenyan-line-soft)]' : ''} py-6 first:pt-0`}
                  >
                    <div className="mb-2 flex items-baseline gap-3">
                      <span className="wenyan-muted text-[11px] tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                      <h2 className="text-sm font-medium leading-7 text-[var(--wenyan-ink)]">{question.stem}</h2>
                    </div>
                    <div className="ml-[26px] mt-3 space-y-1.5">
                      {question.options.map((option) => {
                        const selected = answer?.selectedOptionId === option.id
                        const showCorrect = Boolean(summary && option.id === question.correctOptionId)
                        const showWrong = Boolean(summary && selected && option.id !== question.correctOptionId)
                        return (
                          <label
                            key={option.id}
                            className={`wenyan-reading-option ${selected ? 'is-selected' : ''} ${showCorrect ? 'is-correct' : ''} ${showWrong ? 'is-wrong' : ''} ${
                              showCorrect
                                ? 'text-[var(--wenyan-ink)]'
                                : showWrong
                                  ? 'text-[var(--wenyan-ink-secondary)]'
                                  : selected
                                    ? 'text-[var(--wenyan-ink)]'
                                    : 'text-[var(--wenyan-ink-secondary)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
                            } flex cursor-pointer gap-3 rounded-[var(--wenyan-radius-sm)] px-3 py-2.5 text-sm leading-6`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option.id}
                              checked={selected}
                              disabled={busy || Boolean(summary)}
                              onChange={() => updateAnswer(question.id, option.id)}
                              className="mt-1 accent-[var(--wenyan-accent)]"
                            />
                            <span><span className="wenyan-muted mr-2">{option.id}.</span>{option.text}</span>
                          </label>
                        )
                      })}
                    </div>
                    {summary && (
                      <div className="ml-[26px] mt-4 border-l border-[var(--wenyan-line)] pl-3 text-xs leading-6 text-[var(--wenyan-ink-secondary)]">
                        <p className="font-medium text-[var(--wenyan-ink)]">{correct ? '答对了' : `${answer?.selectedOptionId ? '' : '未作答 · '}正确答案：${question.correctOptionId}`}</p>
                        {question.explanation && <p className="mt-1">{question.explanation}</p>}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            <div className="sticky bottom-0 mt-4 border-t border-[var(--wenyan-line-soft)] bg-[color-mix(in_srgb,var(--wenyan-paper)_90%,transparent)] py-4 backdrop-blur-xl">
              {summary ? (
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="wenyan-muted text-xs">本次结果</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--wenyan-ink)]">{summary.correctCount} / {summary.questionCount}</p>
                    <p className="wenyan-muted mt-1 text-xs">答对 {summary.correctCount} · 答错 {summary.answeredCount - summary.correctCount} · 未答 {summary.questionCount - summary.answeredCount}</p>
                  </div>
                  <Link to="/today" className={`${primaryButton} flex items-center no-underline`}>回到今天</Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="text-sm font-medium text-[var(--wenyan-ink)]">已作答 {answeredCount} / {passage.questions.length}</p>
                    {answeredCount < passage.questions.length && <p className="wenyan-muted mt-1 text-xs">还有 {passage.questions.length - answeredCount} 题未答，将按未作答保存。</p>}
                  </div>
                  <button type="button" disabled={busy} onClick={() => void submit()} className={primaryButton}>
                    {busy ? '正在保存…' : '提交'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
