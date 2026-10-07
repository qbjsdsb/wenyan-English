import assert from 'node:assert/strict'
import { buildCloudCoachingContext } from '../supabase/functions/wenyan-english-mcp/coaching.ts'

const originalFetch = globalThis.fetch
const fixedNow = Date.parse('2026-10-08T00:30:00+08:00')
const nowIso = new Date(fixedNow).toISOString()
const earlierIso = new Date(fixedNow - 86_400_000).toISOString()
const expiresIso = new Date(fixedNow + 86_400_000).toISOString()

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

let eventReads = 0
let intentReads = 0
let intentMode = 'available'

globalThis.fetch = async (input, init = {}) => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(rawUrl)
  if (url.pathname.endsWith('/rest/v1/learning_events')) {
    eventReads += 1
    assert.equal(init.headers.Authorization, 'Bearer test-token')
    assert.equal(init.headers.apikey, 'test-key')
    assert.equal(url.searchParams.get('event_type'), 'eq.word_attempted')
    assert.equal(url.searchParams.get('created_at'), `lte.${nowIso}`)
    assert.equal(url.searchParams.get('order'), 'occurred_at.desc,id.desc')
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
    if (intentMode === 'forbidden') return jsonResponse({ message: 'intent_read_not_granted' }, 403)
    if (intentMode === 'transport') throw new TypeError('simulated network failure')
    if (intentMode === 'decode') return new Response('{broken-json', { status: 200 })
    return jsonResponse([
      {
        id: '33333333-3333-4333-8333-333333333333',
        scope: 'day',
        revision: 2,
        effectiveFrom: earlierIso,
        expiresAt: expiresIso,
        constraints: { newWordCeiling: 8, reviewPreference: 'review_first' },
      },
    ])
  }

  throw new Error(`unexpected fetch ${url}`)
}

const options = {
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'test-key',
  token: 'test-token',
  includeReadingCandidates: true,
  candidatePurpose: 'stage_assessment',
  candidateLimit: 3,
  now: fixedNow,
}

try {
  const result = await buildCloudCoachingContext(options)
  const repeated = await buildCloudCoachingContext(options)

  assert.equal(eventReads, 2)
  assert.equal(intentReads, 2)
  assert.equal(result.schemaVersion, 1)
  assert.equal(result.toolVersion, 'coaching-context-v1.1')
  assert.match(result.snapshot.id, /^sha256:[0-9a-f]{64}$/)
  assert.equal(repeated.snapshot.id, result.snapshot.id)
  assert.notEqual(repeated.requestId, result.requestId)
  assert.equal(result.preferences.learningStage.current, 'vocabulary')
  assert.equal(result.preferences.currentIntent.length, 1)
  assert.equal(result.preferences.currentIntent[0].constraints.newWordCeiling, 8)
  assert.equal(result.derived.recentLearning.wordAttempts7, 2)
  assert.equal(result.derived.recentLearning.repeatedExposureAttempts7, 1)
  assert.equal(result.dataCoverage.localOnlyPossible, true)
  assert.equal(result.dataCoverage.wordHistoryTruncated, true)
  assert.equal(result.snapshot.coverageQuality, 'partial')
  assert.ok(result.snapshot.warnings.includes('visible_history_is_not_all_learning'))
  assert.ok(result.snapshot.warnings.includes('snapshot_descriptor_not_server_persisted'))
  assert.ok(result.snapshot.warnings.includes('multi_source_snapshot_not_atomic'))
  assert.equal(result.adapter.wordRowsRead, 3)
  assert.equal(result.adapter.invalidRowsExcluded, 1)
  assert.equal(result.adapter.intentReadStatus, 'available')
  assert.equal(result.adapter.readingCandidatesRequested, true)
  assert.equal(result.adapter.readingCandidatesAvailable, false)
  assert.equal(result.adapter.snapshotDescriptor.persistence, 'not_persisted')
  assert.equal(result.adapter.snapshotDescriptor.replaySupport, 'not_exposed')
  assert.ok(result.evidence.refs.every((ref) => ref.replayable === false && ref.id.startsWith('query:')))
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 24 * 1024)

  intentMode = 'forbidden'
  const readOnly = await buildCloudCoachingContext(options)
  assert.equal(readOnly.preferences.currentIntent.length, 0)
  assert.equal(readOnly.adapter.intentReadStatus, 'not_authorized')
  assert.ok(readOnly.snapshot.warnings.includes('learning_intent_unavailable'))
  assert.ok(readOnly.uncertainty.includes('active_learning_intent_not_visible_in_this_snapshot'))
  assert.equal(readOnly.derived.recentLearning.wordAttempts7, 2)
  assert.ok(Buffer.byteLength(JSON.stringify(readOnly)) < 24 * 1024)

  intentMode = 'available'
  const intentReadsBeforeCapabilityGate = intentReads
  const capabilityDenied = await buildCloudCoachingContext({ ...options, intentReadCapabilityStatus: 'denied' })
  assert.equal(intentReads, intentReadsBeforeCapabilityGate)
  assert.equal(capabilityDenied.adapter.intentReadStatus, 'not_authorized')
  assert.equal(capabilityDenied.preferences.currentIntent.length, 0)
  assert.equal(capabilityDenied.derived.recentLearning.wordAttempts7, 2)

  const capabilityLookupUnavailable = await buildCloudCoachingContext({ ...options, intentReadCapabilityStatus: 'unavailable' })
  assert.equal(intentReads, intentReadsBeforeCapabilityGate)
  assert.equal(capabilityLookupUnavailable.adapter.intentReadStatus, 'unavailable')
  assert.equal(capabilityLookupUnavailable.preferences.currentIntent.length, 0)
  assert.equal(capabilityLookupUnavailable.derived.recentLearning.wordAttempts7, 2)

  intentMode = 'transport'
  const transportFailure = await buildCloudCoachingContext(options)
  assert.equal(transportFailure.adapter.intentReadStatus, 'unavailable')
  assert.equal(transportFailure.preferences.currentIntent.length, 0)
  assert.equal(transportFailure.derived.recentLearning.wordAttempts7, 2)
  assert.ok(transportFailure.snapshot.warnings.includes('learning_intent_unavailable'))

  intentMode = 'decode'
  const decodeFailure = await buildCloudCoachingContext(options)
  assert.equal(decodeFailure.adapter.intentReadStatus, 'unavailable')
  assert.equal(decodeFailure.preferences.currentIntent.length, 0)
  assert.equal(decodeFailure.derived.recentLearning.wordAttempts7, 2)
  assert.ok(decodeFailure.snapshot.warnings.includes('learning_intent_unavailable'))

  console.log('6 cloud coaching adapter scenarios passed')
} finally {
  globalThis.fetch = originalFetch
}
