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
let preferenceReads = 0
let executionReads = 0
let intentMode = 'available'
let preferenceMode = 'available'
let executionMode = 'fresh'

globalThis.fetch = async (input, init = {}) => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(rawUrl)
  if (url.pathname.endsWith('/rest/v1/learning_events') && url.searchParams.get('event_type') === 'eq.semantic_recall_attempted') {
    assert.equal(init.headers.Authorization, 'Bearer test-token')
    assert.equal(url.searchParams.get('limit'), '501')
    return jsonResponse([])
  }
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

  if (url.pathname.endsWith('/rest/v1/rpc/get_learning_preferences')) {
    preferenceReads += 1
    assert.equal(init.method, 'POST')
    if (preferenceMode === 'forbidden') return jsonResponse({ message: 'preferences_read_not_granted' }, 403)
    if (preferenceMode === 'transport') throw new TypeError('simulated preference network failure')
    if (preferenceMode === 'decode') return new Response('{broken-json', { status: 200 })
    return jsonResponse({
      schemaVersion: 1,
      learningStage: {
        current: 'mixed',
        revision: 3,
        provenance: { kind: 'user_confirmation', ref: 'pref-fixture', since: earlierIso },
      },
      stageReminder: null,
      confirmedAt: earlierIso,
      updatedAt: earlierIso,
    })
  }

  if (url.pathname.endsWith('/rest/v1/rpc/get_execution_availability')) {
    executionReads += 1
    assert.equal(init.method, 'POST')
    if (executionMode === 'forbidden') return jsonResponse({ message: 'not_allowed' }, 403)
    if (executionMode === 'transport') throw new TypeError('simulated execution availability network failure')
    if (executionMode === 'decode') return new Response('{broken-json', { status: 200 })
    return jsonResponse({
      status: executionMode === 'stale' ? 'stale' : 'fresh',
      reportedAt: nowIso,
      ageSeconds: executionMode === 'stale' ? 300 : 0,
      snapshot: {
        algorithmVersion: 'elastic-v2',
        focusDictionary: 'fixture-dict',
        plannerSnapshotId: 'fixture-planner-snapshot',
        availabilityStatus: 'evaluated',
        sessionKind: 'draft',
        disposition: 'continue',
        reason: 'next_useful_block',
        retryAt: null,
        reviewEligibleCount: 2,
        weakEligibleCount: 1,
        correctionEligibleCount: 0,
        correctionCooldownCount: 1,
        newEligibleCount: 20,
        newWordCapacity: 8,
        readingEligibleCount: 0,
        selectedPurpose: 'review',
        selectedItemCount: 3,
        coverage: 'unknown',
      },
    })
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
  assert.equal(preferenceReads, 2)
  assert.equal(executionReads, 2)
  assert.equal(result.derived.semanticEvidence.status, 'available')
  assert.equal(result.derived.semanticEvidence.summary.attempts, 0)
  assert.equal(result.executionCapabilities.semanticRecall, 'unknown')
  assert.equal(result.schemaVersion, 1)
  assert.equal(result.toolVersion, 'coaching-context-v1.4')
  assert.match(result.snapshot.id, /^sha256:[0-9a-f]{64}$/)
  assert.equal(repeated.snapshot.id, result.snapshot.id)
  assert.notEqual(repeated.requestId, result.requestId)
  assert.equal(result.preferences.learningStage.current, 'mixed')
  assert.equal(result.preferences.learningStage.revision, 3)
  assert.equal(result.preferences.learningStage.provenance.kind, 'user_confirmation')
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
  assert.equal(result.runtime.executionAvailability.status, 'fresh')
  assert.equal(result.runtime.executionAvailability.snapshot.reviewEligibleCount, 2)
  assert.equal(result.runtime.executionAvailability.snapshot.correctionCooldownCount, 1)
  assert.equal(result.runtime.executionAvailability.snapshot.newWordCapacity, 8)
  assert.match(result.runtime.executionAvailability.interpretation, /not learning evidence or mastery/)
  assert.equal(result.adapter.wordRowsRead, 3)
  assert.equal(result.adapter.invalidRowsExcluded, 1)
  assert.equal(result.adapter.intentReadStatus, 'available')
  assert.equal(result.adapter.preferenceReadStatus, 'available')
  assert.equal(result.adapter.executionAvailabilityReadStatus, 'fresh')
  assert.equal(result.adapter.readingCandidatesRequested, true)
  assert.equal(result.adapter.readingCandidatesAvailable, false)
  assert.equal(result.adapter.snapshotDescriptor.persistence, 'not_persisted')
  assert.equal(result.adapter.snapshotDescriptor.replaySupport, 'not_exposed')
  assert.equal(result.adapter.snapshotDescriptor.preferences.status, 'available')
  assert.equal(result.adapter.snapshotDescriptor.executionAvailability.ttlSeconds, 120)
  assert.ok(result.evidence.refs.every((ref) => ref.replayable === false && ref.id.startsWith('query:')))
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 24 * 1024)

  executionMode = 'stale'
  const staleAvailability = await buildCloudCoachingContext(options)
  assert.equal(staleAvailability.runtime.executionAvailability.status, 'stale')
  assert.equal(staleAvailability.runtime.executionAvailability.snapshot.newWordCapacity, 8)
  assert.ok(staleAvailability.snapshot.warnings.includes('execution_availability_stale'))
  assert.ok(staleAvailability.uncertainty.includes('execution_availability_is_stale_do_not_use_for_current_executor_capacity'))

  executionMode = 'transport'
  const missingAvailability = await buildCloudCoachingContext(options)
  assert.equal(missingAvailability.runtime.executionAvailability.status, 'unavailable')
  assert.equal(missingAvailability.runtime.executionAvailability.snapshot, null)
  assert.ok(missingAvailability.snapshot.warnings.includes('execution_availability_unavailable'))
  assert.ok(missingAvailability.uncertainty.includes('current_executor_capacity_not_visible_in_this_snapshot'))
  assert.equal(missingAvailability.derived.recentLearning.wordAttempts7, 2)
  executionMode = 'fresh'

  intentMode = 'forbidden'
  const readOnly = await buildCloudCoachingContext(options)
  assert.equal(readOnly.preferences.currentIntent.length, 0)
  assert.equal(readOnly.adapter.intentReadStatus, 'not_authorized')
  assert.ok(readOnly.snapshot.warnings.includes('learning_intent_unavailable'))
  assert.ok(readOnly.uncertainty.includes('active_learning_intent_not_visible_in_this_snapshot'))
  assert.equal(readOnly.preferences.learningStage.current, 'mixed')
  assert.equal(readOnly.derived.recentLearning.wordAttempts7, 2)
  assert.ok(Buffer.byteLength(JSON.stringify(readOnly)) < 24 * 1024)

  intentMode = 'available'
  const intentReadsBeforeCapabilityGate = intentReads
  const capabilityDenied = await buildCloudCoachingContext({ ...options, intentReadCapabilityStatus: 'denied' })
  assert.equal(intentReads, intentReadsBeforeCapabilityGate)
  assert.equal(capabilityDenied.adapter.intentReadStatus, 'not_authorized')
  assert.equal(capabilityDenied.preferences.currentIntent.length, 0)
  assert.equal(capabilityDenied.preferences.learningStage.current, 'mixed')
  assert.equal(capabilityDenied.derived.recentLearning.wordAttempts7, 2)

  const capabilityLookupUnavailable = await buildCloudCoachingContext({ ...options, intentReadCapabilityStatus: 'unavailable' })
  assert.equal(intentReads, intentReadsBeforeCapabilityGate)
  assert.equal(capabilityLookupUnavailable.adapter.intentReadStatus, 'unavailable')
  assert.equal(capabilityLookupUnavailable.preferences.currentIntent.length, 0)
  assert.equal(capabilityLookupUnavailable.preferences.learningStage.current, 'mixed')
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

  intentMode = 'available'
  preferenceMode = 'forbidden'
  const preferenceDenied = await buildCloudCoachingContext(options)
  assert.equal(preferenceDenied.adapter.preferenceReadStatus, 'not_authorized')
  assert.equal(preferenceDenied.preferences.learningStage.current, 'vocabulary')
  assert.equal(preferenceDenied.preferences.learningStage.revision, 0)
  assert.ok(preferenceDenied.snapshot.warnings.includes('learning_preferences_unavailable'))
  assert.ok(preferenceDenied.uncertainty.includes('learning_stage_preference_not_visible_in_this_snapshot'))

  preferenceMode = 'transport'
  const preferenceTransport = await buildCloudCoachingContext(options)
  assert.equal(preferenceTransport.adapter.preferenceReadStatus, 'unavailable')
  assert.equal(preferenceTransport.preferences.learningStage.current, 'vocabulary')
  assert.equal(preferenceTransport.derived.recentLearning.wordAttempts7, 2)

  preferenceMode = 'decode'
  const preferenceDecode = await buildCloudCoachingContext(options)
  assert.equal(preferenceDecode.adapter.preferenceReadStatus, 'unavailable')
  assert.equal(preferenceDecode.preferences.learningStage.current, 'vocabulary')
  assert.equal(preferenceDecode.derived.recentLearning.wordAttempts7, 2)

  console.log('10 cloud coaching adapter scenarios passed')
} finally {
  globalThis.fetch = originalFetch
}
