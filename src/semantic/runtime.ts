import type { SemanticRun } from '@/semantic/run'
import type { RecallRating, SemanticPayload } from './core'
import { parseSemanticPayload } from './core'
import { createLearningEvent } from '@/learning/types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'

export async function loadSemanticRun(id: string) {
  const run = await db.semanticRuns.get(id)
  if (!run || run.ownerUserId !== getLocalLearningOwnerId()) throw new Error('这段学习不属于当前账号，或已经不可用。')
  return run
}

export async function revealSemanticItem(id: string, index: number) {
  return db.transaction('rw', db.semanticRuns, async () => {
    const run = await loadSemanticRun(id)
    if (run.index !== index || (run.completedAt !== undefined || run.endedAt !== undefined)) throw new Error('进度已改变，请重新打开这一段。')
    if (run.hardStopAt !== undefined && Date.now() >= run.hardStopAt) throw new Error('本次学习已到时间上限。已保存的回想记录会保留。')
    await db.semanticRuns.update(id, { revealedIndex: index })
    return { ...run, revealedIndex: index }
  })
}

/** Fact and resume cursor commit together. A duplicate click cannot rate the next item. */
export async function saveSemanticRating(id: string, index: number, rating: RecallRating, resumedAfterReveal: boolean) {
  return db.transaction('rw', db.semanticRuns, db.learningEvents, async () => {
    const run = await loadSemanticRun(id)
    if (run.index !== index || (run.completedAt !== undefined || run.endedAt !== undefined) || run.revealedIndex !== index) throw new Error('进度已改变，请重新打开这一段。')
    const item = run.items[index]
    if (!item) throw new Error('词条已不可用。')
    const payload: SemanticPayload = parseSemanticPayload({
      domain: 'english', activity: 'semantic_recall', measurement: 'self_report_after_reveal', direction: 'en_to_meaning',
      contentId: item.contentId, contentVersion: item.contentVersion, dictionaryId: run.dictionaryId, word: item.word,
      sessionId: run.sessionId, blockId: id, cue: 'word_only', responseMode: 'mental_recall',
      answerRevealed: true, resumedAfterReveal, rating,
    })
    const fact = createLearningEvent('semantic_recall_attempted', payload, 4)
    // Owner was frozen at start; the transaction never assigns old work to a new account.
    fact.ownerUserId = run.ownerUserId
    await db.learningEvents.add(fact)
    const next: SemanticRun = { ...run, index: index + 1, revealedIndex: undefined,
      completedAt: index + 1 === run.items.length ? fact.occurredAt : undefined }
    await db.semanticRuns.put(next)
    return next
  })
}

/** Ending is a runtime choice; no completion event is synthesized. */
export async function endSemanticRun(id: string) {
  const run = await loadSemanticRun(id)
  await db.semanticRuns.update(run.id, { endedAt: Date.now() })
}
