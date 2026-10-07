import type { QuestionAttemptedPayload, ReadingCompletedPayload } from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { db } from '@/utils/db'
import type { ReadingAnswerDraft, ReadingAttemptSummary, ReadingPassage } from './types'

function createAttemptId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `reading-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function saveReadingAttempt(
  passage: ReadingPassage,
  answers: readonly ReadingAnswerDraft[],
  durationMs: number,
): Promise<ReadingAttemptSummary> {
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error('reading_duration_invalid')

  const attemptId = createAttemptId()
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]))
  let answeredCount = 0
  let correctCount = 0

  const questionEvents = passage.questions.map((question) => {
    const draft = answerByQuestion.get(question.id)
    const selectedOptionId = draft?.selectedOptionId ?? null
    const answered = selectedOptionId !== null
    const isCorrect = answered ? selectedOptionId === question.correctOptionId : null
    if (answered) answeredCount += 1
    if (isCorrect) correctCount += 1

    return createLearningEvent<QuestionAttemptedPayload>(
      'question_attempted',
      {
        attemptId,
        passageId: passage.id,
        passageVersion: passage.version,
        questionId: question.id,
        questionType: question.type,
        selectedOptionId,
        correctOptionId: question.correctOptionId,
        answered,
        isCorrect,
        answerChangeCount: Math.max(0, Math.floor(draft?.answerChangeCount ?? 0)),
        questionTags: [...(question.tags ?? [])],
      },
      3,
    )
  })

  const completedEvent = createLearningEvent<ReadingCompletedPayload>(
    'reading_completed',
    {
      attemptId,
      passageId: passage.id,
      passageVersion: passage.version,
      sourceKind: passage.source.kind,
      durationMs: Math.floor(durationMs),
      questionCount: passage.questions.length,
      answeredCount,
      correctCount,
    },
    3,
  )

  await db.transaction('rw', db.learningEvents, async () => {
    await db.learningEvents.bulkAdd([...questionEvents, completedEvent])
  })

  return {
    attemptId,
    passageId: passage.id,
    passageVersion: passage.version,
    durationMs: Math.floor(durationMs),
    questionCount: passage.questions.length,
    answeredCount,
    correctCount,
  }
}
