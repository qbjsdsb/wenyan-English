import assert from 'node:assert/strict'
import { buildReadingEvidence } from '../src/coaching/reading/evidence.ts'

const since = Date.parse('2026-10-01T00:00:00+08:00')
const through = Date.parse('2026-10-15T00:00:00+08:00')
const snapshotId = `sha256:${'9'.repeat(64)}`
const baseCoverage = {
  queryCompleteness: 'complete',
  inputTruncated: false,
  localOnlyPossible: true,
  receivedThrough: through,
  queryRef: 'query:reading:test-14d',
}

const completion = (overrides = {}) => ({
  id: 'completion-1', ownerUserId: undefined, eventType: 'reading_completed', sourceVersion: 3,
  occurredAt: since + 1000,
  payload: {
    attemptId: 'attempt-1', passageId: 'passage-1', passageVersion: '1', sourceKind: 'wenyan-original',
    durationMs: 120000, questionCount: 1, answeredCount: 1, correctCount: 1,
  },
  ...overrides,
})
const question = (overrides = {}) => ({
  id: 'question-1', ownerUserId: undefined, eventType: 'question_attempted', sourceVersion: 3,
  occurredAt: since - 1000,
  payload: {
    attemptId: 'attempt-1', passageId: 'passage-1', passageVersion: '1', questionId: 'q1',
    questionType: 'single_choice', selectedOptionId: 'B', correctOptionId: 'B', answered: true,
    isCorrect: true, answerChangeCount: 0,
  },
  ...overrides,
})

const complete = buildReadingEvidence({
  ownerUserId: undefined,
  events: [question(), completion()],
  snapshotId,
  window: { since, through, timezone: 'Asia/Shanghai' },
  coverage: baseCoverage,
})
assert.equal(complete.coverage.reconciliation, 'complete_visible_query')
assert.equal(complete.observations.attempts, 1)
assert.equal(complete.observations.questions, 1)
assert.equal(complete.observations.correct, 1)
assert.equal(complete.recentAttempts[0].questionRefSample[0], 'question-1')
assert.ok(complete.uncertainty.includes('counts_describe_reconciled_visible_attempts_not_mastery_or_all_learning'))
assert.equal('mastery' in complete.observations, false)

const incomplete = buildReadingEvidence({
  ownerUserId: undefined,
  events: [question(), completion({ payload: { ...completion().payload, questionCount: 2, answeredCount: 1, correctCount: 1 } })],
  snapshotId,
  window: { since, through, timezone: 'Asia/Shanghai' },
  coverage: baseCoverage,
})
assert.equal(incomplete.observations.attempts, 0)
assert.equal(incomplete.coverage.incompleteAttempts, 1)
assert.equal(incomplete.coverage.reconciliation, 'partial_visible_query')

assert.throws(() => buildReadingEvidence({
  ownerUserId: undefined,
  events: [question(), question({ payload: { ...question().payload, selectedOptionId: 'A', isCorrect: false } }), completion()],
  snapshotId,
  window: { since, through, timezone: 'Asia/Shanghai' },
  coverage: baseCoverage,
}), /conflicting_reading_fact_uuid/)

assert.throws(() => buildReadingEvidence({
  ownerUserId: 'owner-a',
  events: [question({ ownerUserId: 'owner-b' })],
  snapshotId,
  window: { since, through, timezone: 'Asia/Shanghai' },
  coverage: baseCoverage,
}), /reading_evidence_owner_mismatch/)

console.log('Reading evidence reconciles boundary-linked facts and fails closed on incomplete, conflicting or cross-owner input')
