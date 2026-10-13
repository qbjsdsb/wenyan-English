import { db } from '@/utils/db'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import type { ReadingEvidenceInput } from './evidence'

const MAX_ROWS = 20000

/** Read-only local snapshot. Caller must discard it when account ownership changes. */
export async function readLocalReadingEvidenceInput(options: {
  ownerUserId: string | undefined
  snapshotId: string
  window: ReadingEvidenceInput['window']
}): Promise<ReadingEvidenceInput> {
  const assertOwner = () => {
    if (getLocalLearningOwnerId() !== options.ownerUserId) throw new Error('reading_evidence_owner_changed')
  }
  assertOwner()
  const rows = await db.transaction('r', db.learningEvents, async () => {
    // Include earlier questions for completions crossing the window boundary. Limit newest
    // rows, not oldest history; a cut attempt is excluded by the core's reconciliation.
    const query = options.ownerUserId
      ? db.learningEvents.where('[ownerUserId+occurredAt]').between([options.ownerUserId, 0], [options.ownerUserId, options.window.through], true, true)
      : db.learningEvents.where('occurredAt').between(0, options.window.through, true, true)
    return query.reverse()
      .and((row) => row.ownerUserId === options.ownerUserId && (row.eventType === 'question_attempted' || row.eventType === 'reading_completed'))
      .limit(MAX_ROWS + 1).toArray()
  })
  assertOwner()
  const truncated = rows.length > MAX_ROWS
  return {
    ...options,
    events: rows.slice(0, MAX_ROWS).map(({ id, ownerUserId, eventType, sourceVersion, occurredAt, payload }) =>
      ({ id, ownerUserId, eventType, sourceVersion, occurredAt, payload })),
    coverage: {
      queryCompleteness: truncated ? 'partial' : 'complete',
      inputTruncated: truncated,
      localOnlyPossible: true,
      receivedThrough: null,
      queryRef: `${options.snapshotId}:reading:local`,
    },
  }
}
