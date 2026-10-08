import { getReadingPassage } from '@/reading/content'
import { saveReadingAttempt } from '@/reading/events'
import type { ReadingAnswerDraft, ReadingAttemptSummary } from '@/reading/types'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

interface StoredReadingDraft {
  startedAt: number
  answers: ReadingAnswerDraft[]
}

function draftKey(passageId: string, version: string) {
  return `wenyanReadingDraft:${passageId}:${version}`
}

function readDraft(passageId: string, version: string): StoredReadingDraft | undefined {
  try {
    const raw = window.localStorage.getItem(draftKey(passageId, version))
    if (!raw) return undefined
    const value = JSON.parse(raw) as StoredReadingDraft
    if (!Number.isFinite(value.startedAt) || !Array.isArray(value.answers)) return undefined
    return value
  } catch {
    return undefined
  }
}

const primaryButton = 'shrink-0 rounded-lg bg-[#1d1d1b] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50 dark:bg-[#eeeeea] dark:text-[#111210] dark:hover:bg-white'

export default function ReadingPage() {
  const { contentId = '' } = useParams()
  const passage = getReadingPassage(contentId)
  const restored = useMemo(() => (passage ? readDraft(passage.id, passage.version) : undefined), [passage])
  const [startedAt] = useState(() => restored?.startedAt ?? Date.now())
  const [answers, setAnswers] = useState<ReadingAnswerDraft[]>(() => restored?.answers ?? [])
  const [summary, setSummary] = useState<ReadingAttemptSummary>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!passage) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100">
        <header className="border-b border-black/[0.07] dark:border-white/[0.08]">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
            <Link to="/today" className="font-serif text-lg font-semibold text-gray-950 no-underline dark:text-gray-100">Wenyan</Link>
            <Link to="/today" className="text-sm text-gray-500 no-underline hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-200">返回</Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">这篇阅读暂时不可用</h1>
          <p className="mt-3 text-sm text-gray-500">内容尚未导入，或版本已经更新。</p>
        </main>
      </div>
    )
  }

  const updateAnswer = (questionId: string, selectedOptionId: string) => {
    if (summary) return
    setAnswers((current) => {
      const previous = current.find((answer) => answer.questionId === questionId)
      const next: ReadingAnswerDraft = {
        questionId,
        selectedOptionId,
        answerChangeCount:
          previous?.selectedOptionId && previous.selectedOptionId !== selectedOptionId
            ? previous.answerChangeCount + 1
            : previous?.answerChangeCount ?? 0,
      }
      const merged = [...current.filter((answer) => answer.questionId !== questionId), next]
      try {
        window.localStorage.setItem(draftKey(passage.id, passage.version), JSON.stringify({ startedAt, answers: merged }))
      } catch {
        // Draft recovery is helpful, but storage failure must not block answering.
      }
      return merged
    })
  }

  const submit = async () => {
    if (busy || summary) return
    setBusy(true)
    setError('')
    try {
      const saved = await saveReadingAttempt(passage, answers, Math.max(0, Date.now() - startedAt))
      setSummary(saved)
      window.localStorage.removeItem(draftKey(passage.id, passage.version))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法保存这次阅读。')
    } finally {
      setBusy(false)
    }
  }

  const answeredCount = answers.filter((answer) => answer.selectedOptionId).length

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-[#f6f6f3]/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#111210]/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/today" className="font-serif text-lg font-semibold text-gray-950 no-underline dark:text-gray-100">Wenyan</Link>
            <span className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.09]" />
            <span className="truncate text-xs text-gray-400 dark:text-gray-600">{passage.source.label} · {passage.estimatedMinutes} 分钟 · {passage.questions.length} 题</span>
          </div>
          <Link to="/today" className="shrink-0 text-sm text-gray-500 no-underline transition-colors hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-200">结束阅读</Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-24 pt-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <article className="min-w-0 lg:border-r lg:border-black/[0.07] lg:pr-10 dark:lg:border-white/[0.08]">
          <h1 className="mb-9 max-w-2xl text-[30px] font-semibold leading-tight tracking-[-0.035em] text-gray-950 dark:text-gray-100">{passage.title}</h1>
          <div className="space-y-7 text-[17px] leading-[2.05] text-gray-800 dark:text-gray-300">
            {passage.paragraphs.map((paragraph, index) => (
              <p key={`${passage.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </article>

        <section aria-label="阅读题目" className="min-w-0">
          <div className="divide-y divide-black/[0.07] border-y border-black/[0.08] dark:divide-white/[0.08] dark:border-white/[0.09]">
            {passage.questions.map((question, index) => {
              const answer = answers.find((item) => item.questionId === question.id)
              const correct = summary ? answer?.selectedOptionId === question.correctOptionId : undefined
              return (
                <article key={question.id} className="py-6">
                  <p className="mb-2 text-xs tabular-nums text-gray-400 dark:text-gray-600">{index + 1}</p>
                  <h2 className="text-sm font-medium leading-7 text-gray-900 dark:text-gray-200">{question.stem}</h2>
                  <div className="mt-4 space-y-1.5">
                    {question.options.map((option) => {
                      const selected = answer?.selectedOptionId === option.id
                      const showCorrect = Boolean(summary && option.id === question.correctOptionId)
                      const showWrong = Boolean(summary && selected && option.id !== question.correctOptionId)
                      return (
                        <label
                          key={option.id}
                          className={`${
                            showCorrect
                              ? 'bg-emerald-50/80 text-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200'
                              : showWrong
                                ? 'bg-red-50/70 text-red-900 dark:bg-red-950/20 dark:text-red-200'
                                : selected
                                  ? 'bg-black/[0.045] dark:bg-white/[0.06]'
                                  : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.035]'
                          } flex cursor-pointer gap-3 rounded-md px-3 py-2.5 text-sm leading-6 transition-colors`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={selected}
                            disabled={Boolean(summary)}
                            onChange={() => updateAnswer(question.id, option.id)}
                            className="mt-1"
                          />
                          <span><span className="mr-2 text-gray-400 dark:text-gray-600">{option.id}.</span>{option.text}</span>
                        </label>
                      )
                    })}
                  </div>
                  {summary && (
                    <div className="mt-4 border-l border-black/[0.1] pl-3 text-xs leading-6 text-gray-500 dark:border-white/[0.12] dark:text-gray-500">
                      <p className="font-medium text-gray-700 dark:text-gray-300">{correct ? '答对了' : `正确答案：${question.correctOptionId}`}</p>
                      {question.explanation && <p className="mt-1">{question.explanation}</p>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <div className="sticky bottom-0 mt-6 border-t border-black/[0.08] bg-[#f6f6f3]/96 py-4 backdrop-blur-md dark:border-white/[0.09] dark:bg-[#111210]/96">
            {summary ? (
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">本次结果</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{summary.correctCount} / {summary.questionCount}</p>
                </div>
                <Link to="/today" className={`${primaryButton} no-underline`}>回到今天</Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-medium">已作答 {answeredCount} / {passage.questions.length}</p>
                  {error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
                </div>
                <button type="button" disabled={busy} onClick={() => void submit()} className={primaryButton}>
                  {busy ? '正在保存…' : '提交'}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
