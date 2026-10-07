import { buildCoachingContext } from '../../../src/coaching/context.ts'
import type { CoachingWordFact, IntentReference } from '../../../src/coaching/types.ts'
import type { SessionConstraints } from '../../../src/smart-session/types.ts'

const PAGE_SIZE = 500
const MAX_WORD_FACTS = 5000
const MAX_CONTEXT_BYTES = 24 * 1024

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

interface CoachingAdapterOptions {
  supabaseUrl: string
  publishableKey: string
  token: string
  includeReadingCandidates: boolean
  candidatePurpose: 'execution' | 'stage_assessment'
  candidateLimit: number
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

async function readWordFacts(options: CoachingAdapterOptions) {
  const rows: CloudWordRow[] = []
  let truncated = false

  for (let offset = 0; offset < MAX_WORD_FACTS; offset += PAGE_SIZE) {
    const url = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
    url.searchParams.set(
      'select',
      'id,occurred_at,created_at,word:payload->>word,dict:payload->>dict,review_mode:payload->>reviewMode,wrong_count:payload->>wrongCount',
    )
    url.searchParams.set('event_type', 'eq.word_attempted')
    url.searchParams.set('order', 'occurred_at.desc,id.desc')

    const page = await fetchJson(url, options.token, options.publishableKey, [offset, offset + PAGE_SIZE - 1])
    if (!Array.isArray(page)) throw new Error('CLOUD_UNAVAILABLE')
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    if (rows.length >= MAX_WORD_FACTS) truncated = true
  }

  const facts: CoachingWordFact[] = []
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

    facts.push({
      id: row.id,
      word: row.word,
      dictionaryId: row.dict,
      reviewMode,
      wrongCount,
      occurredAt,
    })
    historyFrom = historyFrom === null ? occurredAt : Math.min(historyFrom, occurredAt)
    if (createdAt !== null) cloudReceivedThrough = cloudReceivedThrough === null ? createdAt : Math.max(cloudReceivedThrough, createdAt)
  }

  return {
    facts,
    rowCount: rows.length,
    invalidRows,
    truncated: truncated || invalidRows > 0,
    historyFrom,
    cloudReceivedThrough,
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

export async function buildCloudCoachingContext(options: CoachingAdapterOptions) {
  const now = Date.now()
  const [wordData, rawIntents] = await Promise.all([
    readWordFacts(options),
    postRpc(options.supabaseUrl, 'get_learning_intents', options.token, options.publishableKey),
  ])
  const intents = (Array.isArray(rawIntents) ? rawIntents : []).map(mapIntent).filter((intent): intent is IntentReference => intent !== null)

  const context = buildCoachingContext({
    now,
    snapshotId: crypto.randomUUID(),
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
    stage: {
      current: 'vocabulary',
      revision: 0,
      provenance: { kind: 'product_default', ref: 'exam-prep-strategy-v1', since: null },
    },
    vocabularyProvider: { status: 'unavailable', ref: null },
    intents,
    reminder: null,
  })

  const result = {
    ...context,
    toolVersion: 'coaching-context-v1',
    requestId: crypto.randomUUID(),
    adapter: {
      source: 'owner-scoped synced cloud learning_events + active Learning Intent',
      wordRowsRead: wordData.rowCount,
      invalidRowsExcluded: wordData.invalidRows,
      maxWordFacts: MAX_WORD_FACTS,
      readingCandidatesRequested: options.includeReadingCandidates,
      readingCandidatesAvailable: false,
      candidatePurpose: options.candidatePurpose,
      candidateLimit: options.candidateLimit,
    },
  }

  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_CONTEXT_BYTES) throw new Error('COACHING_BUDGET_EXCEEDED')
  return result
}
