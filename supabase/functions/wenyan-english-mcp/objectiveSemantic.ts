import {
  buildSemanticDiscriminationEvidence,
  parseSemanticDiscriminationPayload,
} from '../../../src/semantic/discrimination.ts'

interface ObjectiveSemanticAdapterOptions {
  supabaseUrl: string
  publishableKey: string
  token: string
}

function parseTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchJson(url: URL, token: string, publishableKey: string) {
  const response = await fetch(url, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (response.status === 401 || response.status === 403) throw new Error('NOT_AUTHORIZED')
  if (!response.ok) throw new Error('CLOUD_UNAVAILABLE')
  return response.json()
}

/** Optional enrichment: objective reference discrimination stays separate from self-report semantic recall. */
export async function readObjectiveSemanticFacts(options: ObjectiveSemanticAdapterOptions, now: number) {
  const url = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
  url.searchParams.set('select', 'id,occurred_at,created_at,source_version,payload')
  url.searchParams.set('event_type', 'eq.semantic_discrimination_attempted')
  url.searchParams.set('created_at', `lte.${new Date(now).toISOString()}`)
  url.searchParams.set('occurred_at', `gte.${new Date(now - 14 * 86400000).toISOString()}`)
  url.searchParams.set('order', 'occurred_at.desc,id.desc')
  url.searchParams.set('limit', '501')
  try {
    const rows = await fetchJson(url, options.token, options.publishableKey)
    if (!Array.isArray(rows)) throw new Error('invalid_objective_semantic_response')
    let excluded = 0
    const facts = rows.slice(0, 500).flatMap((row) => {
      try {
        if (row.source_version !== 5 || typeof row.id !== 'string') throw new Error('invalid_objective_semantic_version')
        const occurredAt = parseTimestamp(row.occurred_at)
        if (occurredAt === null || occurredAt > now) throw new Error('invalid_objective_semantic_time')
        return [{ id: row.id, occurredAt, payload: parseSemanticDiscriminationPayload(row.payload) }]
      } catch {
        excluded += 1
        return []
      }
    })
    return {
      status: 'available' as const,
      evidence: buildSemanticDiscriminationEvidence(facts, now),
      rowsRead: Math.min(rows.length, 500),
      truncated: rows.length > 500,
      excluded,
      fingerprintRows: facts,
      localOnlyPossible: true,
    }
  } catch {
    return {
      status: 'unavailable' as const,
      evidence: null,
      rowsRead: null,
      truncated: null,
      excluded: null,
      fingerprintRows: [],
      localOnlyPossible: true,
    }
  }
}
