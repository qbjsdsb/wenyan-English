import { buildCloudCoachingContext as buildCloudCoachingContextV15 } from './coaching.ts'
import { readSemanticProductionFacts } from './semanticProduction.ts'

const MAX_CONTEXT_BYTES = 24 * 1024

type CoachingAdapterOptions = Parameters<typeof buildCloudCoachingContextV15>[0]

function uniqueSorted(items: readonly string[]) {
  return Array.from(new Set(items)).sort()
}

async function sha256Hex(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Coaching Context v1.6 keeps the stable v1.5 adapter intact and adds one epistemically separate
 * evidence channel: exact reference-headword production from a versioned dictionary-meaning cue.
 */
export async function buildCloudCoachingContext(options: CoachingAdapterOptions) {
  const now = options.now ?? Date.now()
  if (!Number.isFinite(now) || now < 0) throw new Error('INVALID_SNAPSHOT_TIME')

  const stableOptions = { ...options, now }
  const [base, productionData] = await Promise.all([
    buildCloudCoachingContextV15(stableOptions),
    readSemanticProductionFacts(stableOptions, now),
  ])

  const fingerprint = await sha256Hex({
    baseSnapshotId: base.snapshot.id,
    semanticProductionStatus: productionData.status,
    semanticProductionRows: productionData.fingerprintRows,
  })
  const snapshotId = `sha256:${fingerprint}`

  const result = {
    ...base,
    snapshot: {
      ...base.snapshot,
      id: snapshotId,
    },
    derived: {
      ...base.derived,
      semanticProductionEvidence: {
        status: productionData.status,
        summary: productionData.evidence,
        coverage: {
          windowDays: 14,
          maxRows: 500,
          rowsRead: productionData.rowsRead,
          truncated: productionData.truncated,
          invalidRowsExcluded: productionData.excluded,
          localOnlyPossible: true,
        },
      },
    },
    agent: {
      ...base.agent,
      epistemicLevels: {
        ...base.agent.epistemicLevels,
        observed:
          'Immutable event records. Semantic recall ratings are self-reports; semantic discrimination correctness is verified only against the presented versioned dictionary references; semantic production correctness is verified only against the exact current dictionary headword for the presented versioned meaning cue.',
        derived:
          'Versioned deterministic aggregation with bounded coverage. Recall, reference discrimination and reference-headword production remain separate measurements; none is a semantic mastery score.',
      },
      semanticAction:
        'Use preferredActivities=["semantic_recall"] for reversible automatic day/session vocabulary activity; semantic production is currently direct manual practice, not a Smart Session planner activity. Treat semanticDiscriminationEvidence as reference-choice evidence only. Treat semanticProductionEvidence as exact reference-headword production only, never as general translation, contextual production, synonym rejection evidence or semantic mastery.',
    },
    uncertainty: uniqueSorted([
      ...base.uncertainty,
      ...(productionData.status === 'available'
        ? ['semantic_production_correctness_is_not_general_translation_or_semantic_mastery']
        : ['semantic_production_evidence_unavailable']),
    ]),
    toolVersion: 'coaching-context-v1.6',
    adapter: {
      ...base.adapter,
      semanticProductionReadStatus: productionData.status,
      snapshotDescriptor: {
        ...base.adapter.snapshotDescriptor,
        fingerprint: snapshotId,
        semanticProductionFacts: {
          eventType: 'semantic_production_attempted',
          maxRows: 500,
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
