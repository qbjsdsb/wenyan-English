import {
  buildSemanticProductionEvidence,
  parseSemanticProductionPayload,
} from '../../../src/semantic/production.ts'

interface SemanticProductionAdapterOptions {
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

/** Optional enrichment: reference-headword production remains separate from recall and discrimination. */
export async function readSemanticProductionFacts(options: SemanticProductionAdapterOptions, now: number) {
  const url = new URL(`${options.supabaseUrl}/rest/v1/learning_events`)
  url.searchParams.set('select', 'id,occurred_at,created_at,source_version,payload')
  url.searchParams.set('event_type', 'eq.semantic_production_attempted')
  url.searchParams.set('created_at', `lte.${new Date(now).toISOString()}`)
  url.searchParams.set('occurred_at', `gte.${new Date(now - 14 * 86400000).toISOString()}`)
  url.searchParams.set('order', 'occurred_at.desc,id.desc')
  url.searchParams.set('limit', '501')

  try {
    const rows = await fetchJson(url, options.token, options.publishableKey)
    if (!Array.isArray(rows)) throw new Error('invalid_semantic_production_response')
    let excluded = 0
    const facts = rows.slice(0, 500).flatMap((row) => {
      try {
        if (row.source_version !== 6 || typeof row.id !== 'string') throw new Error('invalid_semantic_production_version')
        const occurredAt = parseTimestamp(row.occurred_at)
        if (occurredAt === null || occurredAt > now) throw new Error('invalid_semantic_production_time')
        return [{ id: row.id, occurredAt, payload: parseSemanticProductionPayload(row.payload) }]
      } catch {
        excluded += 1
        return []
      }
    })

    return {
      status: 'available' as const,
      evidence: buildSemanticProductionEvidence(facts, now),
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
