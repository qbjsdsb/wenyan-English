import assert from 'node:assert/strict'

const originalFetch = globalThis.fetch
const originalDeno = globalThis.Deno
globalThis.Deno = {}
const { buildCloudCoachingContext } = await import('../supabase/functions/wenyan-english-mcp/coaching.ts?edge-production-regression')

const fixedNow = Date.parse('2026-10-12T03:00:00+08:00')
const occurredAt = new Date(fixedNow - 60_000).toISOString()
const contentVersion = `sha256:${'a'.repeat(64)}`
const readingAttemptId = '77777777-7777-4777-8777-777777777777'
let productionCorrect = true
let readingCorrect = true
let readingUnavailable = false
let productionReads = 0
let readingCompletionReads = 0
let readingQuestionReads = 0

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

function readingCompletionPayload() {
  return {
    attemptId: readingAttemptId,
    passageId: 'reading-fixture',
    passageVersion: '1',
    sourceKind: 'wenyan-original',
    durationMs: 120000,
    questionCount: 1,
    answeredCount: 1,
    correctCount: readingCorrect ? 1 : 0,
  }
}

function readingQuestionPayload() {
  const selectedOptionId = readingCorrect ? 'B' : 'A'
  return {
    attemptId: readingAttemptId,
    passageId: 'reading-fixture',
    passageVersion: '1',
    questionId: 'q1',
    questionType: 'single_choice',
    selectedOptionId,
    correctOptionId: 'B',
    answered: true,
    isCorrect: readingCorrect,
    answerChangeCount: 0,
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
    if (eventType === 'eq.reading_completed') {
      readingCompletionReads += 1
      if (readingUnavailable) return jsonResponse({ message: 'unavailable' }, 503)
      assert.equal(url.searchParams.get('limit'), '501')
      assert.ok(url.searchParams.get('occurred_at')?.startsWith('gte.'))
      return jsonResponse([{
        id: readingAttemptId,
        event_type: 'reading_completed',
        occurred_at: occurredAt,
        created_at: occurredAt,
        source_version: 3,
        payload: readingCompletionPayload(),
      }])
    }
    if (eventType === 'eq.question_attempted') {
      readingQuestionReads += 1
      assert.equal(url.searchParams.get('payload->>attemptId'), `in.(${readingAttemptId})`)
      assert.equal(url.searchParams.get('occurred_at'), null)
      return jsonResponse([{
        id: '88888888-8888-4888-8888-888888888888',
        event_type: 'question_attempted',
        occurred_at: occurredAt,
        created_at: occurredAt,
        source_version: 3,
        payload: readingQuestionPayload(),
      }])
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
  assert.equal(readingCompletionReads, 2)
  assert.equal(readingQuestionReads, 2)
  assert.equal(result.toolVersion, 'coaching-context-v1.7')
  assert.equal(result.derived.semanticProductionEvidence.status, 'available')
  assert.equal(result.derived.semanticProductionEvidence.summary.measurement, 'reference_headword_production')
  assert.equal(result.derived.semanticProductionEvidence.summary.attempts, 1)
  assert.equal(result.derived.semanticProductionEvidence.summary.correct, 1)
  assert.equal(result.derived.semanticProductionEvidence.summary.incorrect, 0)
  assert.match(result.derived.semanticProductionEvidence.summary.interpretation, /Not general translation/)
  assert.equal(result.adapter.semanticProductionReadStatus, 'available')
  assert.equal(result.adapter.snapshotDescriptor.semanticProductionFacts.eventType, 'semantic_production_attempted')

  assert.equal(result.derived.readingEvidence.status, 'available')
  assert.equal(result.derived.readingEvidence.summary.activity, 'reading')
  assert.equal(result.derived.readingEvidence.summary.measurement, 'versioned_reference_single_choice')
  assert.equal(result.derived.readingEvidence.summary.observations.attempts, 1)
  assert.equal(result.derived.readingEvidence.summary.observations.questions, 1)
  assert.equal(result.derived.readingEvidence.summary.observations.correct, 1)
  assert.equal(result.derived.readingEvidence.summary.observations.incorrect, 0)
  assert.equal(result.derived.readingEvidence.summary.coverage.reconciliation, 'complete_visible_query')
  assert.equal(result.derived.readingEvidence.summary.snapshotId, result.snapshot.id)
  assert.equal(result.adapter.readingReadStatus, 'available')
  assert.deepEqual(result.adapter.snapshotDescriptor.readingFacts.eventTypes, ['reading_completed', 'question_attempted'])
  assert.equal(result.adapter.snapshotDescriptor.readingFacts.ownerScope, 'oauth_rls')
  assert.equal(result.readingStrategyBoundary.mode, 'advisory_only')
  assert.equal(result.readingStrategyBoundary.evidenceDoesNotAuthorizeExecution, true)
  assert.equal(result.readingStrategyBoundary.privateReadingContentExposed, false)
  assert.match(result.agent.readingAction, /strategy interpretation only/)

  assert.equal(result.adapter.snapshotDescriptor.fingerprint, result.snapshot.id)
  assert.ok(result.uncertainty.includes('semantic_production_correctness_is_not_general_translation_or_semantic_mastery'))
  assert.match(result.agent.semanticAction, /direct manual practice/)
  assert.match(result.snapshot.id, /^sha256:[0-9a-f]{64}$/)
  assert.equal(repeated.snapshot.id, result.snapshot.id)
  assert.notEqual(repeated.requestId, result.requestId)
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 24 * 1024)

  readingCorrect = false
  const changedReading = await buildCloudCoachingContext(options)
  assert.equal(changedReading.derived.readingEvidence.summary.observations.correct, 0)
  assert.equal(changedReading.derived.readingEvidence.summary.observations.incorrect, 1)
  assert.notEqual(changedReading.snapshot.id, result.snapshot.id)

  productionCorrect = false
  const changedProduction = await buildCloudCoachingContext(options)
  assert.equal(changedProduction.derived.semanticProductionEvidence.summary.correct, 0)
  assert.equal(changedProduction.derived.semanticProductionEvidence.summary.incorrect, 1)
  assert.notEqual(changedProduction.snapshot.id, changedReading.snapshot.id)

  readingUnavailable = true
  const unavailable = await buildCloudCoachingContext(options)
  assert.equal(unavailable.derived.readingEvidence.status, 'unavailable')
  assert.equal(unavailable.derived.readingEvidence.summary, null)
  assert.ok(unavailable.uncertainty.includes('reading_cloud_query_unavailable_not_zero_activity'))
  assert.ok(unavailable.uncertainty.includes('reading_evidence_unavailable'))

  console.log('Coaching Context v1.7 keeps semantic and Reading evidence bounded, separate and fingerprinted')
} finally {
  globalThis.fetch = originalFetch
  if (originalDeno === undefined) delete globalThis.Deno
  else globalThis.Deno = originalDeno
}
