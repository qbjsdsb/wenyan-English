import { buildSemanticEvidence, parseSemanticPayload } from '../../../src/semantic/core.ts'
import { buildAgentExecutionGuidance } from '../../../src/coaching/agent.ts'
import { buildCoachingContext } from '../../../src/coaching/context.ts'
import type {
  CoachingWordFact,
  IntentReference,
  LearningStage,
  StagePreference,
  StageReminderPreference,
} from '../../../src/coaching/types.ts'
import type { SessionConstraints } from '../../../src/smart-session/types.ts'

const PAGE_SIZE = 500
const MAX_WORD_FACTS = 5000
const MAX_CONTEXT_BYTES = 24 * 1024
const COACHING_ALGORITHM_VERSION = 'coaching-v1'

type IntentReadStatus = 'available' | 'not_authorized' | 'unavailable' | 'invalid_response'
type PreferenceReadStatus = 'available' | 'not_authorized' | 'unavailable' | 'invalid_response'
type ExecutionAvailabilityReadStatus = 'fresh' | 'stale' | 'unavailable' | 'not_authorized' | 'invalid_response'

const DEFAULT_STAGE: StagePreference = {
  current: 'vocabulary',
  revision: 0,
  provenance: { kind: 'product_default', ref: 'exam-prep-strategy-v1', since: null },
}

interface CloudWordRow {
  id?: unknown
  occurred_at?: unknown
  created_at?: unknown
  word?: unknown
  dict?: unknown
  review_mode?: unknown
  wrong_count?: unknown
}

interface CloudIntentRow {
  id?: unknown
  scope?: unknown
  revision?: unknown
  effectiveFrom?: unknown
  expiresAt?: unknown
  constraints?: unknown
}

interface ExecutionAvailabilitySnapshot {
  algorithmVersion: 'elastic-v2'
  focusDictionary: string
  plannerSnapshotId: string
  availabilityStatus: 'evaluated' | 'not_evaluated'
  sessionKind: 'draft' | 'resume'
  disposition: 'continue' | 'break' | 'finish'
  reason: string
  retryAt: number | null
  reviewEligibleCount: number
  weakEligibleCount: number
  correctionEligibleCount: number
  correctionCooldownCount: number
  newEligibleCount: number
  newWordCapacity: number
  semanticEligibleCount: number | null
  readingEligibleCount: number
  selectedPurpose: 'review' | 'correction' | 'weak' | 'new' | 'reading' | 'semantic_recall' | null
  selectedItemCount: number
  coverage: 'complete' | 'partial' | 'unknown'
  reportedAt: number
  ageSeconds: number
}

interface CoachingAdapterOptions {
  supabaseUrl: string
  publishableKey: string
  token: string
  intentReadCapabilityStatus?: 'allowed' | 'denied' | 'unavailable'
  includeReadingCandidates: boolean
  candidatePurpose: 'execution' | 'stage_assessment'
  candidateLimit: number
  /** Test-only deterministic clock. Production callers omit this. */
  now?: number
}

function parseTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoolean(value: unknown) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function parseNonNegativeInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

function isConstraints(value: unknown): value is SessionConstraints {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function uniqueSorted(items: readonly string[]) {
  return Array.from(new Set(items)).sort()
}

async function sha256Hex(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function fetchJson(url: URL, token: string, publishableKey: string, range?: [number, number]) {
  const headers: Record<string, string> = {
    apikey: publishableKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
  if (range) {
    headers['Range-Unit'] = 'items'
    headers.Range = `${range[0]}-${range[1]}`
  }

  const response = await fetch(url, { headers })
  if (response.status === 401 || response.status === 403) throw new Error('NOT_AUTHORIZED')
  if (!response.ok) throw new Error('CLOUD_UNAVAILABLE')
  return response.json()
}

async function postRpc(url: string, name: string, token: string, publishableKey: string) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (response.status === 401 || response.status === 403) throw new Error('NOT_AUTHORIZED')
  if (!response.ok) throw new Error('CLOUD_UNAVAILABLE')
  return response.json()
}

async function readWordFacts(options: CoachingAdapterOptions, receivedAtOrBefore: string) {
  const rows: CloudWordRow[] = []
  let truncated = false

  for (let offset = 0; offset < MAX_WORD_FACTS; offset += PAGE_SIZE) {
    const url = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
    url.searchParams.set(
      'select',
      'id,occurred_at,created_at,word:payload->>word,dict:payload->>dict,review_mode:payload->>reviewMode,wrong_count:payload->>wrongCount',
    )
    url.searchParams.set('event_type', 'eq.word_attempted')
    // Freeze the cloud receive boundary so rows arriving during pagination cannot shift later pages.
    url.searchParams.set('created_at', `lte.${receivedAtOrBefore}`)
    url.searchParams.set('order', 'occurred_at.desc,id.desc')

    const page = await fetchJson(url, options.token, options.publishableKey, [offset, offset + PAGE_SIZE - 1])
    if (!Array.isArray(page)) throw new Error('CLOUD_UNAVAILABLE')
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    if (rows.length >= MAX_WORD_FACTS) truncated = true
  }

  const facts: CoachingWordFact[] = []
  const fingerprintRows: Array<{
    id: string
    occurredAt: number
    createdAt: number | null
    word: string
    dictionaryId: string
    reviewMode: boolean
    wrongCount: number
  }> = []
  let invalidRows = 0
  let historyFrom: number | null = null
  let cloudReceivedThrough: number | null = null

  for (const row of rows.slice(0, MAX_WORD_FACTS)) {
    const occurredAt = parseTimestamp(row.occurred_at)
    const createdAt = parseTimestamp(row.created_at)
    const reviewMode = parseBoolean(row.review_mode)
    const wrongCount = parseNonNegativeInteger(row.wrong_count)
    if (
      typeof row.id !== 'string' ||
      typeof row.word !== 'string' ||
      !row.word.trim() ||
      typeof row.dict !== 'string' ||
      !row.dict.trim() ||
      occurredAt === null ||
      reviewMode === null ||
      wrongCount === null
    ) {
      invalidRows += 1
      continue
    }

    const fact = {
      id: row.id,
      word: row.word,
      dictionaryId: row.dict,
      reviewMode,
      wrongCount,
      occurredAt,
    }
    facts.push(fact)
    fingerprintRows.push({ ...fact, createdAt })
    historyFrom = historyFrom === null ? occurredAt : Math.min(historyFrom, occurredAt)
    if (createdAt !== null) cloudReceivedThrough = cloudReceivedThrough === null ? createdAt : Math.max(cloudReceivedThrough, createdAt)
  }

  fingerprintRows.sort((a, b) => a.id.localeCompare(b.id))

  return {
    facts,
    fingerprintRows,
    rowCount: rows.length,
    invalidRows,
    truncated: truncated || invalidRows > 0,
    historyFrom,
    cloudReceivedThrough,
  }
}

async function readSemanticFacts(options: CoachingAdapterOptions, now: number) {
  const url = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
  url.searchParams.set('select', 'id,occurred_at,created_at,source_version,payload')
  url.searchParams.set('event_type', 'eq.semantic_recall_attempted')
  url.searchParams.set('created_at', `lte.${new Date(now).toISOString()}`)
  url.searchParams.set('occurred_at', `gte.${new Date(now - 14 * 86400000).toISOString()}`)
  url.searchParams.set('order', 'occurred_at.desc,id.desc')
  url.searchParams.set('limit', '501')
  try {
    const rows = await fetchJson(url, options.token, options.publishableKey)
    if (!Array.isArray(rows)) throw new Error('invalid_semantic_response')
    let excluded = 0
    const facts = rows.slice(0, 500).flatMap((row) => {
      try {
        if (row.source_version !== 4 || typeof row.id !== 'string') throw new Error('invalid_semantic_version')
        const occurredAt = parseTimestamp(row.occurred_at)
        if (occurredAt === null || occurredAt > now) throw new Error('invalid_semantic_time')
        return [{ id: row.id, occurredAt, payload: parseSemanticPayload(row.payload) }]
      } catch { excluded++; return [] }
    })
    return { status: 'available' as const, evidence: buildSemanticEvidence(facts, now), rowsRead: Math.min(rows.length, 500),
      truncated: rows.length > 500, excluded, fingerprintRows: facts, localOnlyPossible: true }
  } catch {
    return { status: 'unavailable' as const, evidence: null, rowsRead: null, truncated: null, excluded: null,
      fingerprintRows: [], localOnlyPossible: true }
  }
}

function mapIntent(value: unknown): IntentReference | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as CloudIntentRow
  const effectiveFrom = parseTimestamp(row.effectiveFrom)
  const expiresAt = row.expiresAt === null ? null : parseTimestamp(row.expiresAt)
  if (
    typeof row.id !== 'string' ||
    !['ongoing', 'day', 'session'].includes(String(row.scope)) ||
    !Number.isInteger(row.revision) ||
    Number(row.revision) < 1 ||
    effectiveFrom === null ||
    (row.expiresAt !== null && expiresAt === null) ||
    !isConstraints(row.constraints)
  ) return null

  return {
    id: row.id,
    revision: Number(row.revision),
    scope: row.scope as IntentReference['scope'],
    effectiveFrom,
    expiresAt,
    constraints: row.constraints,
  }
}

function mapPreferences(value: unknown): { stage: StagePreference; reminder: StageReminderPreference | null } | null {
  const root = object(value)
  const stageRow = object(root?.learningStage)
  const provenance = object(stageRow?.provenance)
  if (!root || !stageRow || !provenance) return null

  const current = stageRow.current
  const revision = stageRow.revision
  const kind = provenance.kind
  const ref = provenance.ref
  const since = provenance.since === null ? null : parseTimestamp(provenance.since)

  if (
    !['vocabulary', 'mixed', 'exam_practice'].includes(String(current)) ||
    !Number.isInteger(revision) ||
    Number(revision) < 0 ||
    !['product_default', 'user_confirmation'].includes(String(kind)) ||
    typeof ref !== 'string' ||
    !ref ||
    (provenance.since !== null && since === null)
  ) return null

  const stage: StagePreference = {
    current: current as LearningStage,
    revision: Number(revision),
    provenance: {
      kind: kind as StagePreference['provenance']['kind'],
      ref,
      since,
    },
  }

  if (root.stageReminder === null || root.stageReminder === undefined) return { stage, reminder: null }
  const reminderRow = object(root.stageReminder)
  const revisit = object(reminderRow?.revisit)
  const declinedAt = parseTimestamp(reminderRow?.declinedAt)
  if (
    !reminderRow ||
    !revisit ||
    !['vocabulary', 'mixed', 'exam_practice'].includes(String(reminderRow.target)) ||
    declinedAt === null ||
    typeof reminderRow.provenanceRef !== 'string' ||
    !reminderRow.provenanceRef
  ) return null

  let revisitValue: StageReminderPreference['revisit']
  if (revisit.kind === 'user_reopens') {
    revisitValue = { kind: 'user_reopens' }
  } else if (revisit.kind === 'after') {
    const notBefore = parseTimestamp(revisit.notBefore)
    if (notBefore === null || !Number.isInteger(revisit.additionalActiveDays) || Number(revisit.additionalActiveDays) < 1) return null
    revisitValue = { kind: 'after', notBefore, additionalActiveDays: Number(revisit.additionalActiveDays) }
  } else {
    return null
  }

  return {
    stage,
    reminder: {
      target: reminderRow.target as LearningStage,
      declinedAt,
      provenanceRef: reminderRow.provenanceRef,
      revisit: revisitValue,
    },
  }
}

function mapExecutionAvailability(value: unknown): { status: ExecutionAvailabilityReadStatus; snapshot: ExecutionAvailabilitySnapshot | null } {
  const root = object(value)
  if (!root) return { status: 'invalid_response', snapshot: null }
  if (root.status === 'unavailable') return { status: 'unavailable', snapshot: null }
  if (root.status !== 'fresh' && root.status !== 'stale') return { status: 'invalid_response', snapshot: null }

  const reportedAt = parseTimestamp(root.reportedAt)
  const ageSeconds = parseNonNegativeInteger(root.ageSeconds)
  const row = object(root.snapshot)
  if (!row || reportedAt === null || ageSeconds === null) return { status: 'invalid_response', snapshot: null }

  const retryAt = row.retryAt === null ? null : parseTimestamp(row.retryAt)
  const selectedPurpose = row.selectedPurpose
  const counts = [
    row.reviewEligibleCount,
    row.weakEligibleCount,
    row.correctionEligibleCount,
    row.correctionCooldownCount,
    row.newEligibleCount,
    row.newWordCapacity,
    row.readingEligibleCount,
    row.selectedItemCount,
  ].map(parseNonNegativeInteger)

  if (
    row.algorithmVersion !== 'elastic-v2' ||
    typeof row.focusDictionary !== 'string' || !row.focusDictionary ||
    typeof row.plannerSnapshotId !== 'string' || !row.plannerSnapshotId ||
    !['evaluated', 'not_evaluated'].includes(String(row.availabilityStatus)) ||
    !['draft', 'resume'].includes(String(row.sessionKind)) ||
    !['continue', 'break', 'finish'].includes(String(row.disposition)) ||
    typeof row.reason !== 'string' || !row.reason ||
    (row.retryAt !== null && retryAt === null) ||
    counts.some((count) => count === null) ||
    (selectedPurpose !== null && !['review', 'correction', 'weak', 'new', 'reading', 'semantic_recall'].includes(String(selectedPurpose))) ||
    !['complete', 'partial', 'unknown'].includes(String(row.coverage))
  ) return { status: 'invalid_response', snapshot: null }

  return {
    status: root.status,
    snapshot: {
      algorithmVersion: 'elastic-v2',
      focusDictionary: row.focusDictionary,
      plannerSnapshotId: row.plannerSnapshotId,
      availabilityStatus: row.availabilityStatus as ExecutionAvailabilitySnapshot['availabilityStatus'],
      sessionKind: row.sessionKind as ExecutionAvailabilitySnapshot['sessionKind'],
      disposition: row.disposition as ExecutionAvailabilitySnapshot['disposition'],
      reason: row.reason,
      retryAt,
      reviewEligibleCount: counts[0] as number,
      weakEligibleCount: counts[1] as number,
      correctionEligibleCount: counts[2] as number,
      correctionCooldownCount: counts[3] as number,
      newEligibleCount: counts[4] as number,
      newWordCapacity: counts[5] as number,
      semanticEligibleCount: parseNonNegativeInteger(row.semanticEligibleCount),
      readingEligibleCount: counts[6] as number,
      selectedPurpose: selectedPurpose as ExecutionAvailabilitySnapshot['selectedPurpose'],
      selectedItemCount: counts[7] as number,
      coverage: row.coverage as ExecutionAvailabilitySnapshot['coverage'],
      reportedAt,
      ageSeconds,
    },
  }
}

async function readIntents(options: CoachingAdapterOptions) {
  if (options.intentReadCapabilityStatus === 'denied') {
    return { status: 'not_authorized' as IntentReadStatus, intents: [] as IntentReference[], invalidRows: 0 }
  }
  if (options.intentReadCapabilityStatus === 'unavailable') {
    return { status: 'unavailable' as IntentReadStatus, intents: [] as IntentReference[], invalidRows: 0 }
  }

  try {
    const raw = await postRpc(options.supabaseUrl, 'get_learning_intents', options.token, options.publishableKey)
    if (!Array.isArray(raw)) return { status: 'invalid_response' as IntentReadStatus, intents: [] as IntentReference[], invalidRows: 0 }
    const mapped = raw.map(mapIntent)
    return {
      status: 'available' as IntentReadStatus,
      intents: mapped.filter((intent): intent is IntentReference => intent !== null),
      invalidRows: mapped.filter((intent) => intent === null).length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'NOT_AUTHORIZED') return { status: 'not_authorized' as IntentReadStatus, intents: [] as IntentReference[], invalidRows: 0 }
    // Intent is optional enrichment. HTTP failures, rejected fetches and decode errors must not hide valid learning facts.
    return { status: 'unavailable' as IntentReadStatus, intents: [] as IntentReference[], invalidRows: 0 }
  }
}

async function readPreferences(options: CoachingAdapterOptions) {
  try {
    const raw = await postRpc(options.supabaseUrl, 'get_learning_preferences', options.token, options.publishableKey)
    const mapped = mapPreferences(raw)
    if (!mapped) {
      return { status: 'invalid_response' as PreferenceReadStatus, stage: DEFAULT_STAGE, reminder: null as StageReminderPreference | null }
    }
    return { status: 'available' as PreferenceReadStatus, ...mapped }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return {
      status: (message === 'NOT_AUTHORIZED' ? 'not_authorized' : 'unavailable') as PreferenceReadStatus,
      stage: DEFAULT_STAGE,
      reminder: null as StageReminderPreference | null,
    }
  }
}

async function readExecutionAvailability(options: CoachingAdapterOptions) {
  try {
    const raw = await postRpc(options.supabaseUrl, 'get_execution_availability', options.token, options.publishableKey)
    return mapExecutionAvailability(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return {
      status: (message === 'NOT_AUTHORIZED' ? 'not_authorized' : 'unavailable') as ExecutionAvailabilityReadStatus,
      snapshot: null as ExecutionAvailabilitySnapshot | null,
    }
  }
}

export async function buildCloudCoachingContext(options: CoachingAdapterOptions) {
  const now = options.now ?? Date.now()
  if (!Number.isFinite(now) || now < 0) throw new Error('INVALID_SNAPSHOT_TIME')
  const receivedAtOrBefore = new Date(now).toISOString()

  // Learning facts are required. Intent, durable preferences and executor availability are optional enrichments and fail soft.
  const [wordData, intentData, preferenceData, executionData, semanticData] = await Promise.all([
    readWordFacts(options, receivedAtOrBefore),
    readIntents(options),
    readPreferences(options),
    readExecutionAvailability(options),
    readSemanticFacts(options, now),
  ])

  const canonicalIntents = [...intentData.intents]
    .sort((a, b) => a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id))
    .map((intent) => ({
      id: intent.id,
      revision: intent.revision,
      scope: intent.scope,
      effectiveFrom: intent.effectiveFrom,
      expiresAt: intent.expiresAt,
      constraints: intent.constraints,
    }))

  const fingerprint = await sha256Hex({
    algorithmVersion: COACHING_ALGORITHM_VERSION,
    generatedAt: now,
    receivedAtOrBefore,
    rows: wordData.fingerprintRows,
    rowCount: wordData.rowCount,
    invalidRows: wordData.invalidRows,
    truncated: wordData.truncated,
    intents: canonicalIntents,
    intentReadStatus: intentData.status,
    learningStage: preferenceData.stage,
    stageReminder: preferenceData.reminder,
    preferenceReadStatus: preferenceData.status,
    semanticStatus: semanticData.status,
    semanticRows: semanticData.fingerprintRows,
    executionAvailabilityStatus: executionData.status,
    executionAvailability: executionData.snapshot,
  })
  const snapshotId = `sha256:${fingerprint}`

  const context = buildCoachingContext({
    now,
    snapshotId,
    timezone: 'Asia/Shanghai',
    wordFacts: wordData.facts,
    coverage: {
      historyCompleteness: wordData.truncated ? 'partial' : 'complete',
      historyFrom: wordData.historyFrom,
      cloudReceivedThrough: wordData.cloudReceivedThrough,
      // The MCP can only see cloud-synced rows. An offline device may still hold newer local facts.
      localOnlyPossible: true,
      wordHistoryTruncated: wordData.truncated,
    },
    stage: preferenceData.stage,
    vocabularyProvider: { status: 'unavailable', ref: null },
    intents: intentData.intents,
    reminder: preferenceData.reminder,
  })

  const adapterWarnings = [
    'snapshot_descriptor_not_server_persisted',
    'multi_source_snapshot_not_atomic',
    ...(intentData.status === 'available' ? [] : ['learning_intent_unavailable']),
    ...(intentData.invalidRows > 0 ? ['invalid_learning_intent_rows_excluded'] : []),
    ...(preferenceData.status === 'available' ? [] : ['learning_preferences_unavailable']),
    ...(executionData.status === 'fresh'
      ? []
      : [executionData.status === 'stale' ? 'execution_availability_stale' : 'execution_availability_unavailable']),
  ]
  const evidenceRefs = context.evidence.refs.map((ref) => ({
    ...ref,
    id: ref.id.endsWith(':word_attempted:14d') ? 'query:word_attempted:calendar-14d' : 'query:word_attempted:visible-history',
    replayable: false as const,
  }))

  const result = {
    ...context,
    snapshot: {
      ...context.snapshot,
      warnings: uniqueSorted([...context.snapshot.warnings, ...adapterWarnings]),
    },
    evidence: {
      ...context.evidence,
      refs: evidenceRefs,
    },
    executionCapabilities: {
      ...context.executionCapabilities,
      semanticRecall: executionData.status === 'fresh' && executionData.snapshot?.semanticEligibleCount !== null
        && executionData.snapshot?.semanticEligibleCount !== undefined ? 'available' : 'unknown',
    },
    derived: {
      ...context.derived,
      semanticEvidence: { status: semanticData.status, summary: semanticData.evidence,
        coverage: { windowDays: 14, maxRows: 500, rowsRead: semanticData.rowsRead, truncated: semanticData.truncated,
          invalidRowsExcluded: semanticData.excluded, localOnlyPossible: true } },
    },
    agent: {
      epistemicLevels: { observed: 'Immutable event records; semantic ratings are reports, not verified correctness.',
        derived: 'Versioned deterministic aggregation with bounded coverage.',
        userStatement: 'Intent rationale marked user_statement; not a measured learning fact.',
        recommendation: 'Future intent and Coach advice; never evidence of completion.',
        unknown: 'Unavailable, unsynced or missing evidence is unknown, not zero ability.' },
      execution: buildAgentExecutionGuidance(executionData),
      semanticAction: 'Use preferredActivities=["semantic_recall"] for a reversible day/session vocabulary activity; do not change long-term stage. Only recommend automatic execution when executionCapabilities.semanticRecall is available; otherwise ask the user to open the updated website. If no known words with references are eligible, explain availability rather than treating spelling as semantic success.',
    },
    runtime: {
      executionAvailability: {
        status: executionData.status,
        reportedAt: executionData.snapshot?.reportedAt ?? null,
        ageSeconds: executionData.snapshot?.ageSeconds ?? null,
        snapshot: executionData.snapshot
          ? {
              algorithmVersion: executionData.snapshot.algorithmVersion,
              focusDictionary: executionData.snapshot.focusDictionary,
              plannerSnapshotId: executionData.snapshot.plannerSnapshotId,
              availabilityStatus: executionData.snapshot.availabilityStatus,
              sessionKind: executionData.snapshot.sessionKind,
              disposition: executionData.snapshot.disposition,
              reason: executionData.snapshot.reason,
              retryAt: executionData.snapshot.retryAt,
              reviewEligibleCount: executionData.snapshot.reviewEligibleCount,
              weakEligibleCount: executionData.snapshot.weakEligibleCount,
              correctionEligibleCount: executionData.snapshot.correctionEligibleCount,
              correctionCooldownCount: executionData.snapshot.correctionCooldownCount,
              newEligibleCount: executionData.snapshot.newEligibleCount,
              newWordCapacity: executionData.snapshot.newWordCapacity,
              semanticEligibleCount: executionData.snapshot.semanticEligibleCount,
              readingEligibleCount: executionData.snapshot.readingEligibleCount,
              selectedPurpose: executionData.snapshot.selectedPurpose,
              selectedItemCount: executionData.snapshot.selectedItemCount,
              coverage: executionData.snapshot.coverage,
            }
          : null,
        interpretation:
          'Ephemeral deterministic executor state, not learning evidence or mastery. Use capacity counts only when status is fresh.',
      },
    },
    uncertainty: uniqueSorted([
      ...context.uncertainty,
      'snapshot_query_refs_are_descriptive_not_replay_handles',
      ...(semanticData.status === 'available' ? ['semantic_self_report_is_not_objective_correctness'] : ['semantic_evidence_unavailable']),
      ...(intentData.status === 'available' ? [] : ['active_learning_intent_not_visible_in_this_snapshot']),
      ...(preferenceData.status === 'available' ? [] : ['learning_stage_preference_not_visible_in_this_snapshot']),
      ...(executionData.status === 'fresh'
        ? []
        : [executionData.status === 'stale'
            ? 'execution_availability_is_stale_do_not_use_for_current_executor_capacity'
            : 'current_executor_capacity_not_visible_in_this_snapshot']),
    ]),
    toolVersion: 'coaching-context-v1.4',
    requestId: crypto.randomUUID(),
    adapter: {
      source:
        'owner-scoped synced cloud learning_events; durable Learning Preferences and active Learning Intent when authorized and available; optional short-lived deterministic executor availability',
      semanticReadStatus: semanticData.status,
      wordRowsRead: wordData.rowCount,
      invalidRowsExcluded: wordData.invalidRows,
      maxWordFacts: MAX_WORD_FACTS,
      intentReadStatus: intentData.status,
      invalidIntentRowsExcluded: intentData.invalidRows,
      preferenceReadStatus: preferenceData.status,
      executionAvailabilityReadStatus: executionData.status,
      readingCandidatesRequested: options.includeReadingCandidates,
      readingCandidatesAvailable: false,
      candidatePurpose: options.candidatePurpose,
      candidateLimit: options.candidateLimit,
      snapshotDescriptor: {
        fingerprint: snapshotId,
        persistence: 'not_persisted',
        replaySupport: 'not_exposed',
        wordFacts: {
          eventType: 'word_attempted',
          receivedAtOrBefore,
          order: 'occurred_at.desc,id.desc',
          maxRows: MAX_WORD_FACTS,
        },
        intents: {
          status: intentData.status,
          atomicWithWordFacts: false,
        },
        preferences: {
          status: preferenceData.status,
          atomicWithWordFacts: false,
        },
        executionAvailability: {
          status: executionData.status,
          atomicWithWordFacts: false,
          ttlSeconds: 120,
        },
      },
    },
  }

  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_CONTEXT_BYTES) throw new Error('COACHING_BUDGET_EXCEEDED')
  return result
}
