import type { ReadingAnswerDraft, ReadingPassage } from './types'

export interface StoredReadingDraft {
  attemptId?: string
  ownerUserId?: string
  startedAt: number
  answers: ReadingAnswerDraft[]
}

/** Browser storage is untrusted; unknown options must never become learning facts. */
export function isReadingAnswers(value: unknown, passage: ReadingPassage): value is ReadingAnswerDraft[] {
  if (!Array.isArray(value) || value.length > passage.questions.length) return false
  const seen = new Set<string>()
  return value.every((answer) => {
    if (!answer || typeof answer !== 'object') return false
    const question = passage.questions.find((item) => item.id === answer.questionId)
    if (!question || seen.has(question.id)) return false
    seen.add(question.id)
    return (
      Number.isSafeInteger(answer.answerChangeCount) && answer.answerChangeCount >= 0 &&
      (answer.selectedOptionId === undefined || question.options.some((option) => option.id === answer.selectedOptionId))
    )
  })
}

export function draftKey(passageId: string, version: string, ownerUserId?: string) {
  return `wenyanReadingDraft:${encodeURIComponent(ownerUserId ?? 'anonymous')}:${passageId}:${version}`
}

export function readDraft(passage: ReadingPassage, ownerUserId?: string): StoredReadingDraft | undefined {
  try {
    const raw = window.localStorage.getItem(draftKey(passage.id, passage.version, ownerUserId))
    if (!raw) return undefined
    const value = JSON.parse(raw)
    if (
      !value || typeof value !== 'object' || value.ownerUserId !== ownerUserId ||
      !Number.isSafeInteger(value.startedAt) || value.startedAt < 0 || value.startedAt > Date.now() ||
      (value.attemptId !== undefined && (typeof value.attemptId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.attemptId))) ||
      !isReadingAnswers(value.answers, passage)
    ) return undefined
    return value
  } catch {
    return undefined
  }
}
