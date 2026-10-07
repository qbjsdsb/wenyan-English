import Header from '@/components/Header'
import Footer from '@/components/Footer'
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
      <div className="flex min-h-screen flex-col text-gray-900 dark:text-gray-100">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
          <h1 className="text-2xl font-semibold">这篇阅读暂时不可用。</h1>
          <p className="mt-3 text-sm text-gray-500">内容可能尚未导入，或者版本已经更新。</p>
          <Link to="/today" className="mt-8 inline-block text-sm text-indigo-600 dark:text-indigo-300">返回今日学习 →</Link>
        </main>
        <Footer />
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/60 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16 pt-8 lg:px-10">
        <div className="mb-7 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.18em] text-gray-500">READING · {passage.source.label}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{passage.title}</h1>
            <p className="mt-3 text-sm text-gray-500">约 {passage.estimatedMinutes} 分钟 · {passage.questions.length} 题 · 作答事实与 AI 分析分开保存</p>
          </div>
          <Link to="/today" className="text-sm text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-300">结束阅读</Link>
        </div>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <article className="rounded-3xl border border-gray-200 bg-white px-7 py-8 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:px-10 lg:py-10">
            <div className="space-y-6 text-[17px] leading-9 text-gray-800 dark:text-gray-200">
              {passage.paragraphs.map((paragraph, index) => (
                <p key={`${passage.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>

          <section aria-label="阅读题目" className="space-y-5">
            {passage.questions.map((question, index) => {
              const answer = answers.find((item) => item.questionId === question.id)
              const correct = summary ? answer?.selectedOptionId === question.correctOptionId : undefined
              return (
                <article key={question.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-xs font-medium tracking-wider text-gray-400">QUESTION {index + 1}</p>
                  <h2 className="mt-3 text-sm font-medium leading-7">{question.stem}</h2>
                  <div className="mt-4 space-y-2">
                    {question.options.map((option) => {
                      const selected = answer?.selectedOptionId === option.id
                      const showCorrect = Boolean(summary && option.id === question.correctOptionId)
                      const showWrong = Boolean(summary && selected && option.id !== question.correctOptionId)
                      return (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 text-sm leading-6 transition-colors ${
                            showCorrect
                              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                              : showWrong
                                ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                                : selected
                                  ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30'
                                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
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
                          <span><strong className="mr-2">{option.id}.</strong>{option.text}</span>
                        </label>
                      )
                    })}
                  </div>
                  {summary && (
                    <div className={`mt-4 rounded-xl px-4 py-3 text-xs leading-6 ${correct ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      <p className="font-medium">{correct ? '答对了' : `正确答案：${question.correctOptionId}`}</p>
                      {question.explanation && <p className="mt-1">{question.explanation}</p>}
                    </div>
                  )}
                </article>
              )
            })}

            <div className="sticky bottom-5 rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
              {summary ? (
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="text-xs tracking-wider text-gray-400">本次结果</p>
                    <p className="mt-1 text-lg font-semibold">{summary.correctCount} / {summary.questionCount}</p>
                    <p className="mt-1 text-xs text-gray-500">只保存真实作答；错误原因将由后续 AI interpretation 单独分析。</p>
                  </div>
                  <Link to="/today" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700">回到今天</Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="text-sm font-medium">已作答 {answers.filter((answer) => answer.selectedOptionId).length} / {passage.questions.length}</p>
                    <p className="mt-1 text-xs text-gray-500">可以留空提交；没有作答不会被记成答错。</p>
                    {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit()}
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy ? '正在保存…' : '提交这一篇'}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
