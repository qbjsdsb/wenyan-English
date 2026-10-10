import type { LearningEventRecord, LearningEventType } from './types'
import { db } from '@/utils/db'

/**
 * Query immutable learning facts for exactly one visible owner.
 *
 * Signed-in owners use the v9 compound index so high-frequency surfaces do not
 * scan another account's lifetime history. Signed-out learning keeps the legacy
 * eventType path because IndexedDB does not index undefined ownerUserId values.
 */
export async function learningEventsForOwnerByTypes(
  ownerUserId: string | undefined,
  eventTypes: readonly LearningEventType[],
): Promise<LearningEventRecord[]> {
  if (eventTypes.length === 0) return []

  if (!ownerUserId) {
    const events = await db.learningEvents.where('eventType').anyOf(...eventTypes).toArray()
    return events.filter((event) => event.ownerUserId === undefined)
  }

  const keys = eventTypes.map((eventType) => [ownerUserId, eventType] as [string, LearningEventType])
  return db.learningEvents.where('[ownerUserId+eventType]').anyOf(...keys).toArray()
}

export async function learningEventsForOwnerBetween(
  ownerUserId: string | undefined,
  startMs: number,
  endMs: number,
): Promise<LearningEventRecord[]> {
  if (!ownerUserId) {
    const events = await db.learningEvents.where('occurredAt').between(startMs, endMs, true, true).toArray()
    return events.filter((event) => event.ownerUserId === undefined)
  }

  return db.learningEvents
    .where('[ownerUserId+occurredAt]')
    .between([ownerUserId, startMs], [ownerUserId, endMs], true, true)
    .toArray()
}
