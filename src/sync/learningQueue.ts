import type { LearningEventRecord } from '@/learning/types'
import { db } from '@/utils/db'

export interface RemoteLearningEvent {
  id: string
  event_type: string
  occurred_at: string
  source: 'wenyan-english'
  source_version: 1
  payload: unknown
}

export async function getPendingLearningEvents(limit = 100): Promise<LearningEventRecord[]> {
  const events = await db.learningEvents.where('syncState').equals('pending').sortBy('occurredAt')
  return events.slice(0, Math.max(1, limit))
}

export function toRemoteLearningEvent(event: LearningEventRecord): RemoteLearningEvent {
  return {
    id: event.id,
    event_type: event.eventType,
    occurred_at: new Date(event.occurredAt).toISOString(),
    source: 'wenyan-english',
    source_version: 1,
    payload: event.payload,
  }
}

export async function markLearningEventsSynced(ids: string[]) {
  if (ids.length === 0) return

  await db.transaction('rw', db.learningEvents, async () => {
    await Promise.all(
      ids.map((id) =>
        db.learningEvents.update(id, {
          syncState: 'synced',
          lastSyncError: undefined,
        }),
      ),
    )
  })
}

export async function markLearningEventsFailed(ids: string[], error: unknown) {
  if (ids.length === 0) return
  const message = error instanceof Error ? error.message : String(error)

  await db.transaction('rw', db.learningEvents, async () => {
    const events = await db.learningEvents.bulkGet(ids)
    await Promise.all(
      events.map((event, index) => {
        if (!event) return Promise.resolve(0)
        return db.learningEvents.update(ids[index], {
          syncState: 'failed',
          syncAttempts: event.syncAttempts + 1,
          lastSyncError: message,
        })
      }),
    )
  })
}

export async function retryFailedLearningEvents() {
  const failed = await db.learningEvents.where('syncState').equals('failed').toArray()
  await db.transaction('rw', db.learningEvents, async () => {
    await Promise.all(failed.map((event) => db.learningEvents.update(event.id, { syncState: 'pending' })))
  })
}
