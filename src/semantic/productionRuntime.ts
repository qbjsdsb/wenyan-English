import { createLearningEvent } from '@/learning/types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import { createSemanticProductionPayload, parseSemanticProductionPayload } from './production'
import type { SemanticProductionPayload } from './production'
import type { SemanticRun } from './run'

export async function loadSemanticProductionRun(id: string) {
  const run = await db.semanticRuns.get(id)
  if (!run || run.ownerUserId !== getLocalLearningOwnerId() || run.mode !== 'production') {
    throw new Error('这段看义写词不属于当前账号，或已经不可用。')
  }
  return run
}

/** Production fact and authoritative run cursor commit atomically. */
export async function saveSemanticProductionAnswer(id: string, index: number, response: string) {
  return db.transaction('rw', db.semanticRuns, db.learningEvents, async () => {
    const run = await loadSemanticProductionRun(id)
    if (run.index !== index || run.completedAt !== undefined || run.endedAt !== undefined) {
      throw new Error('进度已改变，请重新打开这一段。')
    }
    if (run.hardStopAt !== undefined && Date.now() >= run.hardStopAt) {
      throw new Error('本次学习已到时间上限。已保存的记录会保留。')
    }
    const item = run.items[index]
    if (!item) throw new Error('词条已不可用。')

    const payload: SemanticProductionPayload = parseSemanticProductionPayload(
      createSemanticProductionPayload(item, run.dictionaryId, run.sessionId, id, response),
    )
    const fact = createLearningEvent('semantic_production_attempted', payload, 6)
    fact.ownerUserId = run.ownerUserId
    await db.learningEvents.add(fact)

    const next: SemanticRun = {
      ...run,
      index: index + 1,
      completedAt: index + 1 === run.items.length ? fact.occurredAt : undefined,
    }
    await db.semanticRuns.put(next)
    return { run: next, payload }
  })
}

/** Ending is execution state only; saved production facts stay immutable. */
export async function endSemanticProductionRun(id: string) {
  const run = await loadSemanticProductionRun(id)
  await db.semanticRuns.update(run.id, { endedAt: Date.now() })
}
