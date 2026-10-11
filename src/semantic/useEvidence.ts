import { useLearningOwner } from '@/hooks/useLearningOwner'
import { buildSemanticEvidence } from './core'
import type { SemanticPayload } from './core'
import { buildSemanticDiscriminationEvidence } from './discrimination'
import type { SemanticDiscriminationPayload } from './discrimination'
import { buildSemanticProductionEvidence } from './production'
import type { SemanticProductionPayload } from './production'
import { learningEventsForOwnerBetween, learningEventsForOwnerByTypes } from '@/learning/eventQueries'
import { useLiveQuery } from 'dexie-react-hooks'

export function useSemanticEvidence(blockId?: string) {
  const owner = useLearningOwner()
  return useLiveQuery(async () => {
    try {
      const now = Date.now()
      const events = (await (blockId
        ? learningEventsForOwnerByTypes(owner, ['semantic_recall_attempted', 'semantic_discrimination_attempted', 'semantic_production_attempted'])
        : learningEventsForOwnerBetween(owner, now - 14 * 86400000, now)))
        .filter((event) => event.ownerUserId === owner && (!blockId || (event.payload as { blockId?: string } | null)?.blockId === blockId))
      const recall = buildSemanticEvidence(events.filter((event) => event.eventType === 'semantic_recall_attempted')
        .map((event) => ({ ...event, payload: event.payload as SemanticPayload })), now, blockId ? 0 : undefined)
      const recognition = buildSemanticDiscriminationEvidence(events.filter((event) => event.eventType === 'semantic_discrimination_attempted')
        .map((event) => ({ ...event, payload: event.payload as SemanticDiscriminationPayload })), now, blockId ? 0 : undefined)
      const production = buildSemanticProductionEvidence(events.filter((event) => event.eventType === 'semantic_production_attempted')
        .map((event) => ({ ...event, payload: event.payload as SemanticProductionPayload })), now, blockId ? 0 : undefined)
      return { recall, recognition, production, error: false }
    } catch { return { recall: undefined, recognition: undefined, production: undefined, error: true } }
  }, [blockId, owner])
}
