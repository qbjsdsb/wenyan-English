import assert from 'node:assert/strict'
import { buildCloudCoachingContext } from '../supabase/functions/wenyan-english-mcp/coachingV16.ts'

const originalFetch = globalThis.fetch
const fixedNow = Date.parse('2026-10-12T03:00:00+08:00')
const occurredAt = new Date(fixedNow - 60_000).toISOString()
const contentVersion = `sha256:${'a'.repeat(64)}`
let productionCorrect = true
let productionReads = 0

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

function productionPayload() {
  const response = productionCorrect ? 'alpha' : 'wrong'
  return {
    domain: 'english',
    activity: 'semantic_production',
    measurement: 'reference_headword_production',
    direction: 'meaning_to_en',
    contentId: 'semantic:fixture-dict:alpha',
    contentVersion,
    dictionaryId: 'fixture-dict',
    word: 'alpha',
    sessionId: 'session',
    blockId: 'production-block',
    cue: 'dictionary_meanings',
    responseMode: 'typed_headword',
    response,
    normalizedResponse: response,
    correctHeadword: 'alpha',
    isCorrect: productionCorrect,
  }
}

globalThis.fetch = async (input) => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(rawUrl)
  if (url.pathname.endsWith('/rest/v1/learning_events')) {
    const eventType = url.searchParams.get('event_type')
    if (eventType === 'eq.semantic_production_attempted') {
      productionReads += 1
      assert.equal(url.searchParams.get('limit'), '501')
      return jsonResponse([{ id: '66666666-6666-4666-8666-666666666666', occurred_at: occurredAt, created_at: occurredAt, source_version: 6, payload: productionPayload() }])
    }
    if (eventType === 'eq.semantic_recall_attempted' || eventType === 'eq.semantic_discrimination_attempted' || eventType === 'eq.word_attempted') {
      return jsonResponse([])
    }
  }
  if (url.pathname.includes('/rest/v1/rpc/')) return jsonResponse({ message: 'not_authorized' }, 403)
  throw new Error(`unexpected fetch ${url}`)
}

const options = {
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'test-key',
  token: 'test-token',
  intentReadCapabilityStatus: 'denied',
  includeReadingCandidates: false,
  candidatePurpose: 'stage_assessment',
  candidateLimit: 3,
  now: fixedNow,
}

try {
  const result = await buildCloudCoachingContext(options)
  const repeated = await buildCloudCoachingContext(options)

  assert.equal(productionReads, 2)
  assert.equal(result.toolVersion, 'coaching-context-v1.6')
  assert.equal(result.derived.semanticProductionEvidence.status, 'available')
  assert.equal(result.derived.semanticProductionEvidence.summary.measurement, 'reference_headword_production')
  assert.equal(result.derived.semanticProductionEvidence.summary.attempts, 1)
  assert.equal(result.derived.semanticProductionEvidence.summary.correct, 1)
  assert.equal(result.derived.semanticProductionEvidence.summary.incorrect, 0)
  assert.match(result.derived.semanticProductionEvidence.summary.interpretation, /Not general translation/)
  assert.equal(result.adapter.semanticProductionReadStatus, 'available')
  assert.equal(result.adapter.snapshotDescriptor.semanticProductionFacts.eventType, 'semantic_production_attempted')
  assert.equal(result.adapter.snapshotDescriptor.fingerprint, result.snapshot.id)
  assert.ok(result.uncertainty.includes('semantic_production_correctness_is_not_general_translation_or_semantic_mastery'))
  assert.match(result.agent.semanticAction, /direct manual practice/)
  assert.match(result.snapshot.id, /^sha256:[0-9a-f]{64}$/)
  assert.equal(repeated.snapshot.id, result.snapshot.id)
  assert.notEqual(repeated.requestId, result.requestId)
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 24 * 1024)

  productionCorrect = false
  const changed = await buildCloudCoachingContext(options)
  assert.equal(changed.derived.semanticProductionEvidence.summary.correct, 0)
  assert.equal(changed.derived.semanticProductionEvidence.summary.incorrect, 1)
  assert.notEqual(changed.snapshot.id, result.snapshot.id)

  console.log('Coaching Context v1.6 production evidence remains separate, bounded and fingerprinted')
} finally {
  globalThis.fetch = originalFetch
}
