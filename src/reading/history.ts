import { learningEventsForOwnerByTypes } from '@/learning/eventQueries'
import type { LearningEventRecord, QuestionAttemptedPayload, ReadingCompletedPayload } from '@/learning/types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import type { ReadingAnswerDraft, ReadingAttemptSummary, ReadingPassage } from './types'
import { isReadingAnswers } from './draft'

export interface ReadingReview {
  summary: ReadingAttemptSummary
  answers: ReadingAnswerDraft[]
  occurredAt: number
}

export interface ReadingHistoryEntry extends ReadingAttemptSummary {
  occurredAt: number
}

export function readingSummary(event: LearningEventRecord | undefined): ReadingHistoryEntry | undefined {
  if (!event || event.eventType !== 'reading_completed' || event.sourceVersion !== 3) return undefined
  const p = event.payload as Partial<ReadingCompletedPayload> | null
  if (!p || typeof p.attemptId !== 'string' || !p.attemptId || typeof p.passageId !== 'string' || !p.passageId ||
    typeof p.passageVersion !== 'string' || !p.passageVersion || !Number.isFinite(event.occurredAt)) return undefined
  const counts = [p.durationMs, p.questionCount, p.answeredCount, p.correctCount]
  if (!counts.every((value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) return undefined
  const { durationMs, questionCount, answeredCount, correctCount } = p as ReadingCompletedPayload
  if (!questionCount || correctCount > answeredCount || answeredCount > questionCount) return undefined
  return { attemptId: p.attemptId, passageId: p.passageId, passageVersion: p.passageVersion,
    durationMs, questionCount, answeredCount, correctCount, occurredAt: event.occurredAt }
}

export async function listReadingHistory(owner = getLocalLearningOwnerId()): Promise<ReadingHistoryEntry[]> {
  const events = await learningEventsForOwnerByTypes(owner, ['reading_completed'])
  return events.flatMap((event) => { const entry = readingSummary(event); return entry ? [entry] : [] })
    .sort((a, b) => b.occurredAt - a.occurredAt || a.attemptId.localeCompare(b.attemptId))
}

/** Reconstruct reviews from immutable facts, never from a localStorage result cache. */
export async function loadReadingReview(passage: ReadingPassage, attemptId: string, owner = getLocalLearningOwnerId()): Promise<ReadingReview | undefined> {
  const events = await learningEventsForOwnerByTypes(owner, ['reading_completed', 'question_attempted'])
  const completions = events.filter((event) => event.eventType === 'reading_completed' && (event.payload as Partial<ReadingCompletedPayload> | null)?.attemptId === attemptId)
  if (!completions.length) return undefined
  if (completions.length !== 1) throw new Error('这次阅读存在冲突记录，暂时无法复盘。')
  const summary = readingSummary(completions[0])
  if (!summary || summary.passageId !== passage.id || summary.passageVersion !== passage.version) throw new Error('作答记录与题目版本不一致，请从阅读记录重新打开。')
  const questionEvents = events.filter((event) => event.eventType === 'question_attempted' && (event.payload as Partial<QuestionAttemptedPayload> | null)?.attemptId === attemptId)
  if (questionEvents.length !== passage.questions.length || summary.questionCount !== passage.questions.length) throw new Error('这次作答的逐题记录尚不完整，请同步后再打开。')
  const answers: ReadingAnswerDraft[] = []
  for (const event of questionEvents) {
    const p = event.payload as QuestionAttemptedPayload
    const question = passage.questions.find((question) => question.id === p.questionId)
    if (event.sourceVersion !== 3 || !question || p.passageId !== passage.id || p.passageVersion !== passage.version ||
      p.questionType !== 'single_choice' || p.correctOptionId !== question.correctOptionId ||
      p.answered !== (p.selectedOptionId !== null) || p.isCorrect !== (p.selectedOptionId === null ? null : p.selectedOptionId === p.correctOptionId)) {
      throw new Error('题目与历史答案不一致，已停止复盘，原始记录未修改。')
    }
    answers.push({ questionId: p.questionId, selectedOptionId: p.selectedOptionId ?? undefined, answerChangeCount: p.answerChangeCount })
  }
  if (!isReadingAnswers(answers, passage)) throw new Error('这次作答记录无法完整还原。')
  const answeredCount = answers.filter((answer) => answer.selectedOptionId !== undefined).length
  const correctCount = answers.filter((answer) => passage.questions.find((question) => question.id === answer.questionId)?.correctOptionId === answer.selectedOptionId).length
  if (answeredCount !== summary.answeredCount || correctCount !== summary.correctCount) throw new Error('逐题记录与整篇结果不一致，请先检查同步记录。')
  return { summary, answers, occurredAt: summary.occurredAt }
}
