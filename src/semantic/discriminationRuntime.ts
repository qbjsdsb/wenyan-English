import { createLearningEvent } from '@/learning/types'
import { buildSemanticDiscriminationQuestions, parseSemanticDiscriminationPayload } from './discrimination'
import type { SemanticDiscriminationPayload } from './discrimination'
import type { SemanticRun } from './run'
import { loadSemanticRun } from './runtime'
import { createSmartSessionId } from '@/smart-session/runtime'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'

export async function createSemanticDiscriminationRunFromRecall(recallRunId: string, now = Date.now()) {
  const recall = await loadSemanticRun(recallRunId)
  if (recall.mode === 'discrimination') throw new Error('这已经是一段参考释义辨认。')
  if (recall.completedAt === undefined) throw new Error('先完成这段词义回想，再做参考释义辨认。')
  if (recall.hardStopAt !== undefined && now >= recall.hardStopAt) throw new Error('本次学习已经到时间上限。')
  if (recall.ownerUserId !== getLocalLearningOwnerId()) throw new Error('账号已经改变，请重新开始。')

  const questions = buildSemanticDiscriminationQuestions(recall.items)
  if (!questions.length) throw new Error('这一段可安全区分的参考释义不足 4 个，暂不生成客观辨义题。')

  const id = createSmartSessionId()
  const run: SemanticRun = {
    id,
    mode: 'discrimination',
    sessionCheckpoint: recall.sessionCheckpoint,
    ownerUserId: recall.ownerUserId,
    sessionId: recall.sessionId,
    dictionaryId: recall.dictionaryId,
    startedAt: now,
    hardStopAt: recall.hardStopAt,
    items: recall.items,
    discriminationQuestions: questions,
    index: 0,
  }
  await db.semanticRuns.add(run)
  return run
}

export async function loadSemanticDiscriminationRun(id: string) {
  const run = await loadSemanticRun(id)
  if (run.mode !== 'discrimination' || !Array.isArray(run.discriminationQuestions)) {
    throw new Error('这不是一段可用的参考释义辨认。')
  }
  return run
}

/** Answer fact and resume cursor commit together; refresh resumes at the next unanswered question. */
export async function saveSemanticDiscriminationAnswer(id: string, index: number, selectedContentId: string) {
  return db.transaction('rw', db.semanticRuns, db.learningEvents, async () => {
    const run = await loadSemanticDiscriminationRun(id)
    const questions = run.discriminationQuestions
    if (!questions) throw new Error('题目已经不可用。')
    if (run.index !== index || run.completedAt !== undefined || run.endedAt !== undefined) {
      throw new Error('进度已改变，请重新打开这一段。')
    }
    if (run.hardStopAt !== undefined && Date.now() >= run.hardStopAt) throw new Error('本次学习已到时间上限。')
    const question = questions[index]
    if (!question) throw new Error('题目已经不可用。')
    if (!question.options.some((option) => option.contentId === selectedContentId)) throw new Error('所选释义不在当前题目中。')

    const payload: SemanticDiscriminationPayload = parseSemanticDiscriminationPayload({
      domain: 'english',
      activity: 'semantic_discrimination',
      measurement: 'reference_meaning_discrimination',
      direction: 'en_to_meaning',
      contentId: question.contentId,
      contentVersion: question.contentVersion,
      dictionaryId: run.dictionaryId,
      word: question.word,
      sessionId: run.sessionId,
      blockId: run.id,
      cue: 'word_only',
      responseMode: 'single_choice',
      options: question.options.map((option) => ({ contentId: option.contentId, contentVersion: option.contentVersion })),
      selectedContentId,
      correctContentId: question.correctContentId,
      isCorrect: selectedContentId === question.correctContentId,
    })
    const fact = createLearningEvent('semantic_discrimination_attempted', payload, 5)
    fact.ownerUserId = run.ownerUserId
    await db.learningEvents.add(fact)

    const next: SemanticRun = {
      ...run,
      index: index + 1,
      completedAt: index + 1 === questions.length ? fact.occurredAt : undefined,
    }
    await db.semanticRuns.put(next)
    return { run: next, payload }
  })
}

export async function endSemanticDiscriminationRun(id: string) {
  const run = await loadSemanticDiscriminationRun(id)
  await db.semanticRuns.update(run.id, { endedAt: Date.now() })
}
