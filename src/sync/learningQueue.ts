import type { LearningEventRecord, LearningEventSourceVersion } from '@/learning/types'
import { db } from '@/utils/db'

const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 15 * 60_000

export interface RemoteLearningEvent {
  id: string
  event_type: string
  occurred_at: string
  source: 'wenyan-english'
  source_version: LearningEventSourceVersion
  payload: unknown
}

export interface LearningQueueSummary {
  currentAccount: number
  unclaimed: number
  otherAccount: number
  readyNow: number
}

export function calculateRetryDelayMs(attempt: number) {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1))
}

export async function getReadyLearningEvents(userId: string, limit = 100, now = Date.now()): Promise<LearningEventRecord[]> {
  const events = await db.learningEvents.where('syncState').anyOf('pending', 'failed').sortBy('occurredAt')
  return events
    .filter(
      (event) =>
        event.ownerUserId === userId &&
        (event.syncState === 'pending' || event.nextSyncAttemptAt === undefined || event.nextSyncAttemptAt <= now),
    )
    .slice(0, Math.max(1, limit))
}

export async function getLearningQueueSummary(userId?: string, now = Date.now()): Promise<LearningQueueSummary> {
  const events = await db.learningEvents.where('syncState').anyOf('pending', 'failed').toArray()
  const currentAccount = userId ? events.filter((event) => event.ownerUserId === userId).length : 0
  const unclaimed = events.filter((event) => !event.ownerUserId).length
  const otherAccount = userId ? events.filter((event) => event.ownerUserId && event.ownerUserId !== userId).length : 0
  const readyNow = userId
    ? events.filter(
        (event) =>
          event.ownerUserId === userId &&
          (event.syncState === 'pending' || event.nextSyncAttemptAt === undefined || event.nextSyncAttemptAt <= now),
      ).length
    : 0

  return { currentAccount, unclaimed, otherAccount, readyNow }
}

export async function claimUnownedLearningEvents(userId: string) {
  const events = await db.learningEvents.where('syncState').anyOf('pending', 'failed').toArray()
  const unclaimed = events.filter((event) => !event.ownerUserId)
  if (unclaimed.length === 0) return 0

  await db.transaction('rw', db.learningEvents, async () => {
    await Promise.all(
      unclaimed.map((event) =>
        db.learningEvents.update(event.id, {
          ownerUserId: userId,
          syncState: 'pending',
          nextSyncAttemptAt: undefined,
          lastSyncError: undefined,
        }),
      ),
    )
  })

  return unclaimed.length
}

export function toRemoteLearningEvent(event: LearningEventRecord): RemoteLearningEvent {
  return {
    id: event.id,
    event_type: event.eventType,
    occurred_at: new Date(event.occurredAt).toISOString(),
    source: 'wenyan-english',
    source_version: event.sourceVersion ?? 1,
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
          nextSyncAttemptAt: undefined,
          lastSyncError: undefined,
        }),
      ),
    )
  })
}

export async function markLearningEventsFailed(ids: string[], error: unknown, now = Date.now()) {
  if (ids.length === 0) return
  const message = error instanceof Error ? error.message : String(error)

  await db.transaction('rw', db.learningEvents, async () => {
    const events = await db.learningEvents.bulkGet(ids)
    await Promise.all(
      events.map((event, index) => {
        if (!event) return Promise.resolve(0)
        const nextAttempt = event.syncAttempts + 1
        return db.learningEvents.update(ids[index], {
          syncState: 'failed',
          syncAttempts: nextAttempt,
          nextSyncAttemptAt: now + calculateRetryDelayMs(nextAttempt),
          lastSyncError: message,
        })
      }),
    )
  })
}
