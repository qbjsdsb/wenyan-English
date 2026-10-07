import assert from 'node:assert/strict'
import { buildCloudCoachingContext } from '../supabase/functions/wenyan-english-mcp/coaching.ts'

const originalFetch = globalThis.fetch
const nowIso = new Date().toISOString()
const earlierIso = new Date(Date.now() - 86_400_000).toISOString()

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

let eventReads = 0
let intentReads = 0
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url)
  if (url.pathname.endsWith('/rest/v1/learning_events')) {
    eventReads += 1
    assert.equal(init.headers.Authorization, 'Bearer test-token')
    assert.equal(init.headers.apikey, 'test-key')
    assert.equal(url.searchParams.get('event_type'), 'eq.word_attempted')
    assert.match(url.searchParams.get('select') ?? '', /payload->>word/)
    return jsonResponse([
      {
        id: '11111111-1111-4111-8111-111111111111',
        occurred_at: earlierIso,
        created_at: earlierIso,
        word: 'Alpha',
        dict: 'fixture-dict',
        review_mode: 'false',
        wrong_count: '1',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        occurred_at: nowIso,
        created_at: nowIso,
        word: 'alpha',
        dict: 'fixture-dict',
        review_mode: 'true',
        wrong_count: '0',
      },
      {
        id: 'malformed',
        occurred_at: nowIso,
        created_at: nowIso,
        word: '',
        dict: 'fixture-dict',
        review_mode: 'true',
        wrong_count: '0',
      },
    ])
  }

  if (url.pathname.endsWith('/rest/v1/rpc/get_learning_intents')) {
    intentReads += 1
    assert.equal(init.method, 'POST')
    return jsonResponse([
      {
        id: '33333333-3333-4333-8333-333333333333',
        scope: 'day',
        revision: 2,
        effectiveFrom: earlierIso,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        constraints: { newWordCeiling: 8, reviewPreference: 'review_first' },
      },
    ])
  }

  throw new Error(`unexpected fetch ${url}`)
}

try {
  const result = await buildCloudCoachingContext({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'test-key',
    token: 'test-token',
    includeReadingCandidates: true,
    candidatePurpose: 'stage_assessment',
    candidateLimit: 3,
  })

  assert.equal(eventReads, 1)
  assert.equal(intentReads, 1)
  assert.equal(result.schemaVersion, 1)
  assert.equal(result.preferences.learningStage.current, 'vocabulary')
  assert.equal(result.preferences.currentIntent.length, 1)
  assert.equal(result.preferences.currentIntent[0].constraints.newWordCeiling, 8)
  assert.equal(result.derived.recentLearning.wordAttempts7, 2)
  assert.equal(result.derived.recentLearning.repeatedExposureAttempts7, 1)
  assert.equal(result.dataCoverage.localOnlyPossible, true)
  assert.equal(result.dataCoverage.wordHistoryTruncated, true)
  assert.equal(result.snapshot.coverageQuality, 'partial')
  assert.ok(result.snapshot.warnings.includes('visible_history_is_not_all_learning'))
  assert.equal(result.adapter.wordRowsRead, 3)
  assert.equal(result.adapter.invalidRowsExcluded, 1)
  assert.equal(result.adapter.readingCandidatesRequested, true)
  assert.equal(result.adapter.readingCandidatesAvailable, false)
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 24 * 1024)
  console.log('1 cloud coaching adapter scenario passed')
} finally {
  globalThis.fetch = originalFetch
}
