import type { QuestionAttemptedPayload, ReadingCompletedPayload } from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import type { ReadingAnswerDraft, ReadingAttemptSummary, ReadingPassage } from './types'
import { isReadingAnswers } from './draft'
import { readingSummary } from './history'

/** Also serves as the completion event UUID, so a retry cannot add a second completion. */
export function createReadingAttemptId() {
  return createLearningEvent('reading_completed', null, 3).id
}

export async function saveReadingAttempt(
  passage: ReadingPassage,
  answers: readonly ReadingAnswerDraft[],
  durationMs: number,
  ownerUserId = getLocalLearningOwnerId(),
  attemptId = createReadingAttemptId(),
): Promise<ReadingAttemptSummary> {
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error('reading_duration_invalid')
  if (!isReadingAnswers(answers, passage)) throw new Error('阅读答案与当前题目不一致，请重新打开这篇阅读。')

  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(attemptId)) throw new Error('阅读提交标识无效，请重新打开。')
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

    const event = createLearningEvent<QuestionAttemptedPayload>(
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
    // The owner is frozen by the Reading runner. Switching accounts while a
    // passage is open must never reassign the finished attempt to the new user.
    event.ownerUserId = ownerUserId
    return event
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
  completedEvent.ownerUserId = ownerUserId
  completedEvent.id = attemptId

  return db.transaction('rw', db.learningEvents, async () => {
    const existing = await db.learningEvents.get(attemptId)
    if (existing) {
      const saved = readingSummary(existing)
      if (!saved || saved.attemptId !== attemptId || existing.ownerUserId !== ownerUserId ||
        saved.passageId !== passage.id || saved.passageVersion !== passage.version) {
        throw new Error('阅读提交标识发生冲突，原记录未修改。')
      }
      return saved
    }
    await db.learningEvents.bulkAdd([...questionEvents, completedEvent])
    return { attemptId, passageId: passage.id, passageVersion: passage.version,
      durationMs: Math.floor(durationMs), questionCount: passage.questions.length, answeredCount, correctCount }
  })
}
