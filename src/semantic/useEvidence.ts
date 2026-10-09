import { useLearningOwner } from '@/hooks/useLearningOwner'
import { buildSemanticEvidence } from './core'
import type { SemanticPayload } from './core'
import { buildSemanticDiscriminationEvidence } from './discrimination'
import type { SemanticDiscriminationPayload } from './discrimination'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'

export function useSemanticEvidence(blockId?: string) {
  const owner = useLearningOwner()
  return useLiveQuery(async () => {
    try {
      const now = Date.now()
      const events = (await db.learningEvents.where('occurredAt').aboveOrEqual(now - 14 * 86400000).toArray())
        .filter((event) => event.ownerUserId === owner && (!blockId || (event.payload as { blockId?: string }).blockId === blockId))
      const recall = buildSemanticEvidence(events.filter((event) => event.eventType === 'semantic_recall_attempted')
        .map((event) => ({ ...event, payload: event.payload as SemanticPayload })), now)
      const recognition = buildSemanticDiscriminationEvidence(events.filter((event) => event.eventType === 'semantic_discrimination_attempted')
        .map((event) => ({ ...event, payload: event.payload as SemanticDiscriminationPayload })), now)
      return { recall, recognition, error: false }
    } catch { return { recall: undefined, recognition: undefined, error: true } }
  }, [blockId, owner])
}
