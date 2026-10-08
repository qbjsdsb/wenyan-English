// Synthetic evidence only. This validates decision guardrails, not learner ability.
import assert from 'node:assert/strict'
import { buildCoachingContext } from '../src/coaching/context.ts'

const now = Date.parse('2026-10-07T16:00:00Z') // Oct 8 midnight in Shanghai
const day = 86_400_000
const base = {
  now,
  snapshotId: 'decision-fixture',
  timezone: 'Asia/Shanghai',
  wordFacts: [],
  coverage: {
    historyCompleteness: 'complete',
    historyFrom: now - 30 * day,
    cloudReceivedThrough: now,
    localOnlyPossible: false,
    wordHistoryTruncated: false,
  },
  stage: {
    current: 'vocabulary',
    revision: 1,
    provenance: { kind: 'user_confirmation', ref: 'fixture:user-confirmed', since: now - day },
  },
  vocabularyProvider: { status: 'unavailable', ref: null },
  intents: [],
  reminder: null,
}

const fact = (id, at, wrongCount = 0, word = id) => ({
  id,
  word,
  occurredAt: at,
  wrongCount,
  dictionaryId: 'fixture',
  reviewMode: false,
})

let count = 0
const check = (name, fn) => {
  fn()
  console.log('PASS', name)
  count += 1
}

check('sparse evidence does not become a diagnosis', () => {
  const support = buildCoachingContext(base).derived.coachDecisionSupport
  assert.equal(support.algorithmVersion, 'coach-decision-support-v1')
  assert.equal(support.evidenceStatus, 'sparse')
  assert.equal(support.longitudinalComparison.use, 'not_available')
  assert.equal(support.productPolicy.learningStage.writeRequiresUserConfirmation, true)
  assert.ok(!JSON.stringify(support).includes('readinessScore'))
  assert.ok(!JSON.stringify(support).includes('masteryRate'))
})

check('one observed week cannot support a longitudinal comparison', () => {
  const support = buildCoachingContext({
    ...base,
    wordFacts: [fact('today-1', now), fact('today-2', now, 1)],
  }).derived.coachDecisionSupport
  assert.equal(support.evidenceStatus, 'single_window_observed')
  assert.equal(support.longitudinalComparison.use, 'not_available')
  assert.ok(support.observedSignals.includes('current_window_activity_observed'))
  assert.ok(support.uncertainties.includes('longitudinal_comparison_needs_observations_in_both_windows'))
})

check('single active days in both windows stay limited and descriptive', () => {
  const support = buildCoachingContext({
    ...base,
    wordFacts: [fact('previous', now - 8 * day), fact('current', now)],
  }).derived.coachDecisionSupport
  assert.equal(support.evidenceStatus, 'two_windows_complete_visible_history')
  assert.equal(support.longitudinalComparison.use, 'limited_descriptive_only')
  assert.ok(support.uncertainties.includes('few_active_days_limit_longitudinal_interpretation'))
})

check('multi-day complete windows permit bounded descriptive comparison only', () => {
  const support = buildCoachingContext({
    ...base,
    wordFacts: [
      fact('p1', now - 12 * day),
      fact('p2', now - 9 * day),
      fact('c1', now - 5 * day),
      fact('c2', now - day),
    ],
  }).derived.coachDecisionSupport
  assert.equal(support.longitudinalComparison.use, 'bounded_descriptive_only')
  assert.equal(support.longitudinalComparison.note, 'window_deltas_are_descriptive_not_causal')
  assert.deepEqual(support.uncertainties, [])
})

check('partial visible history never upgrades to complete comparison', () => {
  const support = buildCoachingContext({
    ...base,
    wordFacts: [
      fact('p1', now - 12 * day),
      fact('p2', now - 9 * day),
      fact('c1', now - 5 * day),
      fact('c2', now - day),
    ],
    coverage: { ...base.coverage, localOnlyPossible: true },
  }).derived.coachDecisionSupport
  assert.equal(support.evidenceStatus, 'two_windows_partial_visible_history')
  assert.equal(support.longitudinalComparison.use, 'partial_descriptive_only')
  assert.ok(support.uncertainties.includes('visible_history_may_exclude_unsynced_learning'))
})

check('repeated spelling errors are a bounded signal, not semantic mastery evidence', () => {
  const support = buildCoachingContext({
    ...base,
    wordFacts: [
      fact('e1', now - 2 * day, 1, 'alpha'),
      fact('e2', now - day, 2, 'alpha'),
    ],
  }).derived.coachDecisionSupport
  assert.ok(support.observedSignals.includes('repeated_spelling_errors_observed'))
  assert.ok(support.productPolicy.forbiddenClaims.includes('semantic_mastery_from_spelling'))
})

check('ordinary coach changes are reversible future intent while stage remains user-confirmed', () => {
  const policy = buildCoachingContext(base).derived.coachDecisionSupport.productPolicy
  assert.deepEqual(policy.reversibleFutureIntent.scopes, ['session', 'day', 'ongoing'])
  assert.ok(policy.reversibleFutureIntent.fields.includes('targetMinutes'))
  assert.ok(policy.reversibleFutureIntent.fields.includes('reviewPreference'))
  assert.equal(policy.reversibleFutureIntent.rationaleMustDeclareBasis, true)
  assert.equal(policy.learningStage.coachMayRecommend, true)
  assert.equal(policy.learningStage.writeRequiresUserConfirmation, true)
})

console.log(`${count} coach decision scenarios passed`)
