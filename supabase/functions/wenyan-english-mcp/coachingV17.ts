import { buildReadingEvidence } from '../../../src/coaching/reading/evidence.ts'
import { buildCloudCoachingContext as buildCloudCoachingContextV16 } from './coachingV16.ts'
import { CLOUD_READING_MAX_ROWS, CLOUD_READING_WINDOW_DAYS, readCloudReadingEvidence } from './readingEvidence.ts'

const MAX_CONTEXT_BYTES = 24 * 1024

type CoachingAdapterOptions = Parameters<typeof buildCloudCoachingContextV16>[0]

function uniqueSorted(items: readonly string[]) {
  return Array.from(new Set(items)).sort()
}

async function sha256Hex(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Coaching Context v1.7 adds Reading evidence without granting Reading execution authority.
 * v1.6 remains a stable lower layer; missing cloud Reading facts are unknown, never zero performance.
 */
export async function buildCloudCoachingContext(options: CoachingAdapterOptions) {
  const now = options.now ?? Date.now()
  if (!Number.isFinite(now) || now < 0) throw new Error('INVALID_SNAPSHOT_TIME')

  const stableOptions = { ...options, now }
  const [base, readingData] = await Promise.all([
    buildCloudCoachingContextV16(stableOptions),
    readCloudReadingEvidence(stableOptions, now),
  ])

  const fingerprint = await sha256Hex({
    baseSnapshotId: base.snapshot.id,
    readingStatus: readingData.status,
    readingRows: readingData.fingerprintRows,
    readingCoverage: readingData.coverage,
    readingTruncated: readingData.truncated,
  })
  const snapshotId = `sha256:${fingerprint}`

  const readingEvidence = readingData.status === 'available' && readingData.coverage
    ? buildReadingEvidence({
        ownerUserId: undefined,
        events: readingData.events,
        snapshotId,
        window: readingData.window,
        coverage: readingData.coverage,
      })
    : null

  const result = {
    ...base,
    snapshot: {
      ...base.snapshot,
      id: snapshotId,
      compositionVersion: 'coaching-context-v1.7',
    },
    derived: {
      ...base.derived,
      readingEvidence: {
        status: readingData.status,
        summary: readingEvidence,
        coverage: {
          windowDays: CLOUD_READING_WINDOW_DAYS,
          maxRows: CLOUD_READING_MAX_ROWS,
          rowsRead: readingData.rowsRead,
          completionRowsRead: readingData.completionRowsRead,
          questionRowsRead: readingData.questionRowsRead,
          truncated: readingData.truncated,
          queryCompleteness: readingData.coverage?.queryCompleteness ?? 'unknown',
          localOnlyPossible: true,
          ownerScope: readingData.ownerScope,
        },
      },
    },
    readingStrategyBoundary: {
      mode: 'advisory_only' as const,
      interpretationRequires: ['snapshotId', 'readingEvidence.window', 'readingEvidence.coverage', 'evidenceRefs', 'uncertainty'],
      futureIntentRequires: ['supported_intent_contract', 'fresh_provider_candidates', 'current_eligibility', 'deterministic_executor'],
      stageChangeRequires: 'user_confirmation' as const,
      evidenceDoesNotAuthorizeExecution: true,
      privateReadingContentExposed: false,
    },
    agent: {
      ...base.agent,
      epistemicLevels: {
        ...base.agent.epistemicLevels,
        observed:
          'Immutable event records. Reading correctness is only the recorded result against the versioned reference answer; article text, question text and option text are not exposed in Coaching Context.',
        derived:
          'Versioned deterministic aggregation with bounded query and reconciliation coverage. Reading counts describe reconciled visible attempts, not comprehension mastery, speed, attention, novelty or error cause.',
      },
      readingAction:
        'Use readingEvidence for bounded strategy interpretation only. Do not infer mastery from percentages or wall-clock duration. Reading evidence does not make a provider, candidate set or executor available. Do not auto-create Reading execution intent until Wenyan exposes a supported intent contract, fresh provider candidates, current eligibility and a deterministic executor.',
    },
    uncertainty: uniqueSorted([
      ...base.uncertainty,
      ...(readingEvidence?.uncertainty ?? ['reading_evidence_unavailable']),
      ...(readingData.status === 'available' ? [] : ['reading_cloud_query_unavailable_not_zero_activity']),
    ]),
    toolVersion: 'coaching-context-v1.7',
    adapter: {
      ...base.adapter,
      readingReadStatus: readingData.status,
      snapshotDescriptor: {
        ...base.adapter.snapshotDescriptor,
        fingerprint: snapshotId,
        readingFacts: {
          eventTypes: ['reading_completed', 'question_attempted'],
          windowDays: CLOUD_READING_WINDOW_DAYS,
          maxRows: CLOUD_READING_MAX_ROWS,
          selection: 'completion_occurred_at_inclusive_with_linked_questions',
          queryRef: readingData.coverage?.queryRef ?? null,
          ownerScope: readingData.ownerScope,
          atomicWithWordFacts: false,
        },
      },
    },
  }

  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_CONTEXT_BYTES) {
    throw new Error('COACHING_BUDGET_EXCEEDED')
  }
  return result
}
