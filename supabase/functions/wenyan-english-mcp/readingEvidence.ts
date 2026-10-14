import type { ReadingEvidenceEvent, ReadingEvidenceInput } from '../../../src/coaching/reading/evidence.ts'

const WINDOW_MS = 14 * 86400000
const MAX_COMPLETIONS = 500
const MAX_INPUT_ROWS = 20000
const PAGE_SIZE = 500
const ATTEMPT_CHUNK_SIZE = 25
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

interface ReadingAdapterOptions {
  supabaseUrl: string
  publishableKey: string
  token: string
}

interface CloudReadingRow {
  id?: unknown
  event_type?: unknown
  occurred_at?: unknown
  created_at?: unknown
  source_version?: unknown
  payload?: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function parseTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
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

function sanitizePayload(eventType: unknown, payload: unknown) {
  const row = record(payload)
  if (!row) return null
  if (eventType === 'reading_completed') {
    return {
      attemptId: row.attemptId,
      passageId: row.passageId,
      passageVersion: row.passageVersion,
      sourceKind: row.sourceKind,
      durationMs: row.durationMs,
      questionCount: row.questionCount,
      answeredCount: row.answeredCount,
      correctCount: row.correctCount,
    }
  }
  if (eventType === 'question_attempted') {
    return {
      attemptId: row.attemptId,
      passageId: row.passageId,
      passageVersion: row.passageVersion,
      questionId: row.questionId,
      questionType: row.questionType,
      selectedOptionId: row.selectedOptionId,
      correctOptionId: row.correctOptionId,
      answered: row.answered,
      isCorrect: row.isCorrect,
      answerChangeCount: row.answerChangeCount,
    }
  }
  return null
}

function mapEvent(row: CloudReadingRow): { event: ReadingEvidenceEvent; createdAt: number | null } {
  return {
    event: {
      id: typeof row.id === 'string' ? row.id : '',
      ownerUserId: undefined,
      eventType: typeof row.event_type === 'string' ? row.event_type : '',
      sourceVersion: typeof row.source_version === 'number' ? row.source_version : undefined,
      occurredAt: parseTimestamp(row.occurred_at) ?? -1,
      payload: sanitizePayload(row.event_type, row.payload),
    },
    createdAt: parseTimestamp(row.created_at),
  }
}

function chunks<T>(items: readonly T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

/**
 * Read an owner-scoped cloud Reading snapshot through the caller's Supabase JWT/RLS identity.
 * Completion time selects the 14-day window. Linked question facts are then fetched by attemptId
 * without a lower occurred_at bound so an attempt crossing the window edge can still reconcile.
 */
export async function readCloudReadingEvidence(options: ReadingAdapterOptions, now: number) {
  const throughIso = new Date(now).toISOString()
  const since = now - WINDOW_MS
  const completionUrl = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
  completionUrl.searchParams.set('select', 'id,event_type,occurred_at,created_at,source_version,payload')
  completionUrl.searchParams.set('event_type', 'eq.reading_completed')
  completionUrl.searchParams.set('created_at', `lte.${throughIso}`)
  completionUrl.searchParams.set('occurred_at', `gte.${new Date(since).toISOString()}`)
  completionUrl.searchParams.set('order', 'occurred_at.desc,id.desc')
  completionUrl.searchParams.set('limit', String(MAX_COMPLETIONS + 1))

  try {
    const rawCompletions = await fetchJson(completionUrl, options.token, options.publishableKey)
    if (!Array.isArray(rawCompletions)) throw new Error('invalid_reading_completion_response')
    const completionTruncated = rawCompletions.length > MAX_COMPLETIONS
    const completionRows = rawCompletions.slice(0, MAX_COMPLETIONS) as CloudReadingRow[]
    const attemptIds = Array.from(new Set(completionRows.flatMap((row) => {
      const attemptId = record(row.payload)?.attemptId
      return typeof attemptId === 'string' && UUID_RE.test(attemptId) ? [attemptId] : []
    }))).sort()

    const questionRows: CloudReadingRow[] = []
    let questionTruncated = false
    outer: for (const attemptChunk of chunks(attemptIds, ATTEMPT_CHUNK_SIZE)) {
      let offset = 0
      while (true) {
        const remaining = MAX_INPUT_ROWS - completionRows.length - questionRows.length
        if (remaining <= 0) {
          questionTruncated = true
          break outer
        }
        const requestSize = Math.min(PAGE_SIZE, remaining + 1)
        const questionUrl = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
        questionUrl.searchParams.set('select', 'id,event_type,occurred_at,created_at,source_version,payload')
        questionUrl.searchParams.set('event_type', 'eq.question_attempted')
        questionUrl.searchParams.set('created_at', `lte.${throughIso}`)
        questionUrl.searchParams.set('payload->>attemptId', `in.(${attemptChunk.join(',')})`)
        questionUrl.searchParams.set('order', 'occurred_at.asc,id.asc')
        const page = await fetchJson(questionUrl, options.token, options.publishableKey, [offset, offset + requestSize - 1])
        if (!Array.isArray(page)) throw new Error('invalid_reading_question_response')
        if (page.length > remaining) {
          questionRows.push(...page.slice(0, remaining) as CloudReadingRow[])
          questionTruncated = true
          break outer
        }
        questionRows.push(...page as CloudReadingRow[])
        if (page.length < requestSize) break
        offset += page.length
      }
    }

    const mapped = [...completionRows, ...questionRows].map(mapEvent)
    const events = mapped.map((item) => item.event)
    const fingerprintRows = mapped
      .map((item) => ({ ...item.event, createdAt: item.createdAt }))
      .sort((a, b) => a.id.localeCompare(b.id))
    const receivedThrough = mapped.reduce<number | null>((latest, item) => (
      item.createdAt === null ? latest : latest === null ? item.createdAt : Math.max(latest, item.createdAt)
    ), null)
    const truncated = completionTruncated || questionTruncated
    const coverage: ReadingEvidenceInput['coverage'] = {
      queryCompleteness: truncated ? 'partial' : 'complete',
      inputTruncated: truncated,
      localOnlyPossible: true,
      receivedThrough,
      queryRef: 'query:reading:rolling-14d',
    }

    return {
      status: 'available' as const,
      events,
      window: { since, through: now, timezone: 'Asia/Shanghai' },
      coverage,
      rowsRead: events.length,
      completionRowsRead: completionRows.length,
      questionRowsRead: questionRows.length,
      truncated,
      fingerprintRows,
      ownerScope: 'oauth_rls' as const,
    }
  } catch {
    return {
      status: 'unavailable' as const,
      events: [] as ReadingEvidenceEvent[],
      window: { since, through: now, timezone: 'Asia/Shanghai' },
      coverage: null,
      rowsRead: null,
      completionRowsRead: null,
      questionRowsRead: null,
      truncated: null,
      fingerprintRows: [],
      ownerScope: 'oauth_rls' as const,
    }
  }
}

export const CLOUD_READING_WINDOW_DAYS = 14
export const CLOUD_READING_MAX_ROWS = MAX_INPUT_ROWS
