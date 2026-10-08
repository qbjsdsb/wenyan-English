// Synthetic evidence only. Node 22.6+, same lightweight runner as Smart Session.
import assert from 'node:assert/strict'
import { buildCoachingContext, buildReadingCandidates, stageReminderStatus, validateReadingSelection } from '../src/coaching/context.ts'
import { buildSmartSession } from '../src/smart-session/planner.ts'

const now = Date.parse('2026-10-07T16:00:00Z') // Oct 8 midnight in Shanghai
const day = 86_400_000
const base = {
  now, snapshotId: 'synthetic-1', timezone: 'Asia/Shanghai', wordFacts: [],
  coverage: { historyCompleteness: 'complete', historyFrom: now - 30 * day, cloudReceivedThrough: now, localOnlyPossible: false, wordHistoryTruncated: false },
  stage: { current: 'vocabulary', revision: 0, provenance: { kind: 'product_default', ref: 'policy-v1', since: null } },
  vocabularyProvider: { status: 'unavailable', ref: null }, intents: [], reminder: null,
}
const fact = (id, word, at = now, wrongCount = 0) => ({ id, word, occurredAt: at, wrongCount, dictionaryId: 'synthetic', reviewMode: false })
const entry = (id, word = 'alpha') => ({
  passage: { id, version: 'v1', title: id, source: { kind: 'wenyan-original', label: 'synthetic' },
    paragraphs: ['Synthetic fixture only.'], estimatedMinutes: 18, recommendationEligible: true,
    vocabulary: [{ surface: word, lemma: word, core: true }],
    questions: [{ id: 'q1', type: 'single_choice', stem: 'Synthetic question?', correctOptionId: 'A', tags: ['inference'], options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }] }] },
  providerRef: 'fixture-provider:v1', currentVersion: 'v1', loadable: true, contentComplete: true, answersVerified: true,
  estimateBasis: 'fixture estimate', repeatPolicy: { kind: 'never_same_version' }, completedAttempts: [],
})
const reading = { now, recentSince: now - 13 * day, stage: 'mixed', readingSupported: true, availableSeconds: 1200,
  purpose: 'execution', limit: 3, words: [{ surface: 'alpha', lastObservedAt: now, recentError: false }], catalog: [entry('A'), entry('B', 'beta')] }
let count = 0
const check = (name, fn) => { fn(); console.log('PASS', name); count++ }

check('new user: sparse evidence never low ability', () => {
  const c = buildCoachingContext(base)
  assert.equal(c.snapshot.coverageQuality, 'sparse')
  assert.equal(c.derived.recentLearning.wordAttempts7, 0)
  assert.equal(c.derived.learningEvidence.comparability, 'sparse')
  assert.equal(c.derived.learningEvidence.windows.current7.wordAttempts, 0)
  assert.equal(c.derived.reviewPressure.scheduledDueCount, null)
  assert.equal(c.preferences.vocabularyRoute.observedProgress, null)
  assert.ok(!JSON.stringify(c).includes('masteryRate'))
})
check('weeks of activity produce descriptive evidence without changing stage', () => {
  const facts = Array.from({ length: 28 }, (_, i) => fact(`f${i}`, `word${i}`, now - i * day))
  const c = buildCoachingContext({ ...base, wordFacts: facts })
  assert.equal(c.derived.recentLearning.activeDays7, 7)
  assert.equal(c.derived.recentLearning.activeDays14, 14)
  assert.equal(c.derived.recentLearning.firstObservedWords7, 7)
  assert.equal(c.derived.learningEvidence.windows.current7.activeDays, 7)
  assert.equal(c.derived.learningEvidence.windows.previous7.activeDays, 7)
  assert.equal(c.derived.learningEvidence.windows.delta.activeDays, 0)
  assert.equal(c.derived.learningEvidence.continuity.recentActiveDayStreak, 28)
  assert.equal(c.derived.learningEvidence.comparability, 'complete_visible_history')
  assert.equal(c.preferences.learningStage.current, 'vocabulary')
  assert.equal(c.evidence.sampleFactIds.length, 6)
  assert.equal(c.evidence.samplesAreExhaustive, false)
})
check('learning evidence compares equal calendar windows and bounds repeated spelling errors', () => {
  const facts = [
    fact('p1', 'alpha', now - 13 * day, 1),
    fact('p2', 'beta', now - 9 * day, 0),
    fact('p3', 'gamma', now - 7 * day, 0),
    fact('c1', 'alpha', now - 6 * day, 2),
    fact('c2', 'alpha', now - 4 * day, 1),
    fact('c3', 'delta', now - 2 * day, 0),
    fact('c4', 'epsilon', now - day, 1),
    fact('c5', 'zeta', now, 0),
  ]
  const c = buildCoachingContext({ ...base, wordFacts: facts })
  const evidence = c.derived.learningEvidence
  assert.equal(evidence.algorithmVersion, 'learning-evidence-v1')
  assert.equal(evidence.windows.previous7.wordAttempts, 3)
  assert.equal(evidence.windows.current7.wordAttempts, 5)
  assert.equal(evidence.windows.delta.wordAttempts, 2)
  assert.equal(evidence.windows.current7.spellingErrorAttempts, 3)
  assert.equal(evidence.windows.previous7.spellingErrorAttempts, 1)
  assert.equal(evidence.windows.delta.spellingErrorAttempts, 2)
  assert.equal(evidence.continuity.calendarDaysSinceLatest, 0)
  assert.equal(evidence.repeatedSpellingErrors14[0].surface, 'alpha')
  assert.equal(evidence.repeatedSpellingErrors14[0].errorAttempts, 3)
  assert.deepEqual(evidence.repeatedSpellingErrors14[0].evidenceIds, ['p1', 'c1', 'c2'])
  assert.ok(evidence.uncertainties.includes('window_deltas_are_descriptive_not_causal'))
  assert.ok(!JSON.stringify(evidence).includes('improved'))
  assert.ok(!JSON.stringify(evidence).includes('fatigue'))
})
check('partial coverage keeps useful window counts but marks comparison partial', () => {
  const c = buildCoachingContext({
    ...base,
    wordFacts: [fact('a', 'alpha', now - day, 1), fact('b', 'alpha', now, 0)],
    coverage: { ...base.coverage, localOnlyPossible: true },
  })
  assert.equal(c.derived.learningEvidence.windows.current7.wordAttempts, 2)
  assert.equal(c.derived.learningEvidence.comparability, 'partial_visible_history')
  assert.ok(c.derived.learningEvidence.uncertainties.includes('visible_history_may_exclude_unsynced_learning'))
})
check('user decline persists next day and only explicit revisit policy can open reconsideration', () => {
  const p = { target: 'mixed', declinedAt: now, provenanceRef: 'user:decline', revisit: { kind: 'user_reopens' } }
  assert.equal(stageReminderStatus(p, now + day, 20, true), 'suppressed')
  const timed = { ...p, revisit: { kind: 'after', notBefore: now + day, additionalActiveDays: 3 } }
  assert.equal(stageReminderStatus(timed, now + day, 2, true), 'suppressed')
  assert.equal(stageReminderStatus(timed, now + day, 3, false), 'suppressed')
  assert.equal(stageReminderStatus(timed, now + day, 3, true), 'may_reconsider')
})
check('ordinary fatigue preference is future intent; day preference expires at exact boundary', () => {
  const intent = { id: 'i', revision: 1, scope: 'day', effectiveFrom: now - day, expiresAt: now,
    constraints: { targetMinutes: 20, intensity: 'gentle', newWordCeiling: 5, reviewPreference: 'review_first' } }
  assert.equal(buildCoachingContext({ ...base, intents: [intent] }).preferences.currentIntent.length, 0)
  const c = buildCoachingContext({ ...base, now: now - 1, intents: [intent] })
  assert.equal(c.preferences.currentIntent[0].constraints.targetMinutes, 20)
  assert.equal(c.derived.recentLearning.wordAttempts7, 0)
})
check('candidate evidence allows reasoning practice, not a lexical winning score', () => {
  const c = buildReadingCandidates(reading)
  assert.equal(c.items[0].core.observedExposure, 1)
  assert.equal(c.items[1].core.observedExposure, 0)
  assert.deepEqual(c.items[0].questionTags, ['inference'])
  assert.equal(validateReadingSelection({ contentId: 'B', contentVersion: 'v1' }, c.items).allowed, true)
  assert.equal(c.order, 'content_id')
})
check('stage assessment visible but vocabulary stage never executable', () => {
  assert.equal(buildReadingCandidates({ ...reading, stage: 'vocabulary' }).items.length, 0)
  const c = buildReadingCandidates({ ...reading, stage: 'vocabulary', purpose: 'stage_assessment' })
  assert.equal(c.items.length, 2)
  assert.equal(c.items[0].executableNow, false)
  assert.equal(validateReadingSelection({ contentId: 'A', contentVersion: 'v1' }, c.items).allowed, false)
})
check('unsynced history is explicit and cannot unblock a reminder', () => {
  const c = buildCoachingContext({ ...base, wordFacts: [fact('a', 'alpha')], coverage: { ...base.coverage, localOnlyPossible: true } })
  assert.equal(c.snapshot.coverageQuality, 'partial')
  assert.ok(c.snapshot.warnings.includes('visible_history_is_not_all_learning'))
})
check('no AI: existing deterministic vocabulary planner still works', () => {
  const r = buildSmartSession({ now, snapshotId: 'offline', constraints: {}, availableActivities: ['vocabulary'], newItemsToday: 0, coverage: 'unknown',
    candidates: [{ kind: 'vocabulary', key: 'spelling:alpha', contentId: 'fixture:alpha', dictionaryId: 'fixture', ordinal: 0, attempts: [], estimatedSeconds: 15 }],
    progress: { attemptedKeys: [], completedBlocks: 0, newItemsIntroduced: 0, activeSeconds: 0, elapsedSeconds: 0, activeSecondsSinceBreak: 0, timingQuality: 'estimated' } })
  assert.equal(r.blocks[0].activity.kind, 'vocabulary')
})
check('invented or stale-version content fails closed', () => {
  const c = buildReadingCandidates(reading)
  assert.equal(validateReadingSelection({ contentId: 'imaginary', contentVersion: 'v1' }, c.items).allowed, false)
  assert.equal(validateReadingSelection({ contentId: 'A', contentVersion: 'old' }, c.items).allowed, false)
})
check('budget, support, answer verification, demo and repeat policies are hard filters', () => {
  assert.equal(buildReadingCandidates({ ...reading, availableSeconds: 600 }).items.length, 0)
  assert.equal(buildReadingCandidates({ ...reading, availableSeconds: null }).items.length, 0)
  assert.equal(buildReadingCandidates({ ...reading, readingSupported: false }).items.length, 0)
  for (const invalid of [
    { ...entry('A'), answersVerified: false },
    { ...entry('A'), currentVersion: 'v2' },
    { ...entry('A'), passage: { ...entry('A').passage, recommendationEligible: false } },
    { ...entry('A'), completedAttempts: [{ id: 'done', occurredAt: now - day, version: 'v1' }] },
    { ...entry('A'), completedAttempts: null },
    { ...entry('A'), repeatPolicy: { kind: 'after_cooldown', seconds: 172800 }, completedAttempts: [{ id: 'done', occurredAt: now - day, version: 'v1' }] },
  ]) assert.equal(buildReadingCandidates({ ...reading, catalog: [invalid] }).items.length, 0)
})
check('deterministic under fact/catalog permutation, duplicates idempotent, conflicts rejected', () => {
  const a = fact('a', 'alpha', now - day, 1), b = fact('b', 'alpha', now, 0)
  const input = { ...base, wordFacts: [a, b, a], reading }
  const before = JSON.stringify(input)
  assert.deepEqual(buildCoachingContext(input), buildCoachingContext({ ...input, wordFacts: [b, a], reading: { ...reading, catalog: [...reading.catalog].reverse() } }))
  assert.equal(JSON.stringify(input), before)
  assert.equal(buildCoachingContext(input).derived.recentLearning.repeatedExposureAttempts7, 1)
  assert.throws(() => buildCoachingContext({ ...base, wordFacts: [a, { ...a, wrongCount: 0 }] }), /conflicting_fact_uuid/)
})
check('calendar boundary and future facts are honest', () => {
  const c = buildCoachingContext({ ...base, wordFacts: [fact('old', 'alpha', now - 6 * day - 1), fact('in', 'beta', now - 6 * day), fact('future', 'x', now + 1)] })
  assert.equal(c.derived.recentLearning.wordAttempts7, 1)
  assert.ok(c.snapshot.warnings.includes('future_fact_excluded'))
})
check('DST calendar days differ from fixed elapsed hours', () => {
  const c = buildCoachingContext({ ...base, now: Date.parse('2026-03-09T04:00:00Z'), timezone: 'America/New_York',
    wordFacts: [fact('a', 'a', Date.parse('2026-03-03T05:00:00Z')), fact('b', 'b', Date.parse('2026-03-03T04:59:59Z'))] })
  assert.equal(c.derived.recentLearning.wordAttempts7, 1)
})
check('missing core annotation is null and inflection is not semantic equivalence', () => {
  const e = entry('A', 'alphas')
  e.passage.vocabulary[0].lemma = 'alpha'
  assert.equal(buildReadingCandidates({ ...reading, catalog: [e] }).items[0].core.observedExposure, 0)
  e.passage.vocabulary = []
  assert.equal(buildReadingCandidates({ ...reading, catalog: [e] }).items[0].core.denominator, null)
})
check('bounded candidates report truncation; normal summary stays small', () => {
  const c = buildCoachingContext({ ...base, reading: { ...reading, purpose: 'stage_assessment', catalog: Array.from({ length: 20 }, (_, i) => entry(String(i))) } })
  assert.equal(c.derived.readingCandidates.items.length, 3)
  assert.equal(c.derived.readingCandidates.eligibleCount, 20)
  assert.equal(c.derived.readingCandidates.truncated, true)
  assert.ok(Buffer.byteLength(JSON.stringify(c)) < 24 * 1024)
})
check('invalid policy and conflicting reading UUIDs cannot silently pass', () => {
  assert.throws(() => buildReadingCandidates({ ...reading, stage: 'invented' }), /invalid_candidate_policy/)
  const e = { ...entry('A'), completedAttempts: [
    { id: 'x', version: 'v1', occurredAt: now - day }, { id: 'x', version: 'v1', occurredAt: now },
  ] }
  assert.throws(() => buildReadingCandidates({ ...reading, catalog: [e] }), /conflicting_reading_fact_uuid/)
})
console.log(`${count} coaching scenarios passed`)
