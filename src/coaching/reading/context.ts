import { buildCoachingContext } from '../context'
import type { CoachingContextInput } from '../types'
import { buildReadingEvidence } from './evidence'
import type { ReadingEvidenceInput } from './evidence'

/** Composition boundary; evidence availability never grants execution capability. */
export function buildReadingAwareCoachingContext(input: CoachingContextInput, reading: ReadingEvidenceInput | null) {
  if (reading && (reading.snapshotId !== input.snapshotId || reading.window.through !== input.now || reading.window.timezone !== input.timezone)) {
    throw new Error('reading_context_snapshot_mismatch')
  }
  const base = buildCoachingContext(input)
  const evidence = reading === null ? null : buildReadingEvidence(reading)
  return {
    ...base,
    // Existing snapshot coverage describes vocabulary only. Each activity declares its own coverage.
    snapshot: { ...base.snapshot, coverageBasis: 'word_attempted' as const, compositionVersion: 'reading-context-v1' as const },
    derived: { ...base.derived, readingEvidence: evidence },
    readingStrategyBoundary: {
      mode: 'advisory_only' as const,
      interpretationRequires: ['snapshotId', 'readingEvidence.window', 'readingEvidence.coverage', 'evidenceRefs', 'uncertainty'],
      futureIntentRequires: ['supported_intent_contract', 'fresh_provider_candidates', 'current_eligibility', 'deterministic_executor'],
      stageChangeRequires: 'user_confirmation' as const,
      evidenceDoesNotAuthorizeExecution: true,
    },
    uncertainty: [...base.uncertainty, ...(evidence?.uncertainty ?? ['reading_evidence_not_loaded_not_zero_activity'])],
  }
}
