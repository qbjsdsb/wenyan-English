// Node 22.6+; no framework, packages, browser or real user data.
import assert from 'node:assert/strict'
import { buildSmartSession } from '../src/smart-session/planner.ts'

const now = 1_800_000_000_000
const day = 86_400_000
const word = (key, attempts = [], extra = {}) => ({
  kind: 'vocabulary', key, contentId: 'book/' + key, dictionaryId: 'kaoyan',
  ordinal: Number(key.replace(/\D/g, '')) || 0, attempts, estimatedSeconds: 60, ...extra,
})
const attempt = (id, days = 4, wrongCount = 0) => ({ id, occurredAt: now - days * day, wrongCount })
const fresh = Array.from({ length: 40 }, (_, i) => word('new' + String(i).padStart(2, '0')))
const input = {
  now, snapshotId: 'fixture-1', constraints: { focusDictionary: 'kaoyan' }, candidates: fresh,
  availableActivities: ['vocabulary'], newItemsToday: 0, coverage: 'complete',
  progress: { attemptedKeys: [], completedBlocks: 0, newItemsIntroduced: 0, activeSeconds: 0, elapsedSeconds: 0, activeSecondsSinceBreak: 0, timingQuality: 'measured' },
}
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log('PASS', name) }
const count = (r) => r.blocks.flatMap((b) => b.activity.items).length

check('pure, deterministic, open-ended sparse fallback', () => {
  const before = JSON.stringify(input)
  const a = buildSmartSession(input)
  assert.deepEqual(a, buildSmartSession(input))
  assert.equal(JSON.stringify(input), before)
  assert.equal(a.blocks[0].purpose, 'new')
  assert.equal(count(a), 6)
})
check('10 and 25 minutes are different structures', () => {
  assert.equal(count(buildSmartSession({ ...input, constraints: { targetMinutes: 10 } })), 3)
  assert.equal(count(buildSmartSession({ ...input, constraints: { targetMinutes: 25 } })), 6)
})
check('hard stop wins over a long target', () => {
  assert.equal(count(buildSmartSession({ ...input, constraints: { targetMinutes: 90, hardStopMinutes: 10 } })), 3)
})
check('zero does not become unlimited', () => {
  assert.equal(count(buildSmartSession({ ...input, constraints: { targetMinutes: 0 } })), 0)
  assert.equal(count(buildSmartSession({ ...input, constraints: { newWordCeiling: 0 } })), 0)
})
check('elapsed wall time and activity time have different meanings', () => {
  assert.equal(buildSmartSession({ ...input, constraints: { hardStopMinutes: 10 }, progress: { ...input.progress, elapsedSeconds: 600 } }).reason, 'budget_reached')
  assert.equal(buildSmartSession({ ...input, constraints: { targetMinutes: 10 }, progress: { ...input.progress, elapsedSeconds: 600 } }).disposition, 'continue')
})
check('repeated spelling errors beat unseen words initially', () => {
  const weak = word('weak', [attempt('w1', 2, 2), attempt('w2', 1, 1)])
  const r = buildSmartSession({ ...input, candidates: [...fresh, weak] })
  assert.equal(r.blocks[0].purpose, 'weak')
  assert.deepEqual(r.blocks[0].activity.items[0].evidenceRefs, ['w1', 'w2'])
})
check('duplicate source UUIDs and words do not double count', () => {
  const a = word('due', [attempt('same')])
  const b = { ...a, contentId: 'second/due', dictionaryId: 'cet4' }
  const r = buildSmartSession({ ...input, candidates: [b, a] })
  assert.equal(count(r), 1)
  assert.deepEqual(r.blocks[0].activity.items[0].evidenceRefs, ['same'])
  assert.deepEqual(r, buildSmartSession({ ...input, candidates: [a, b] }))
})
check('conflicting immutable evidence is rejected', () => {
  assert.throws(() => buildSmartSession({ ...input, candidates: [word('x', [attempt('same')]), word('x', [attempt('same', 4, 1)])] }))
})
check('session replay and recent practice are deferred', () => {
  const r = buildSmartSession({ ...input, candidates: [word('x', [attempt('a')]), word('y', [{ id: 'b', occurredAt: now - 1000, wrongCount: 4 }])], progress: { ...input.progress, attemptedKeys: ['x'] } })
  assert.equal(count(r), 0)
  assert.equal(r.deferred.length, 2)
})
check('long session cannot reset daily new-word ceiling', () => {
  assert.equal(count(buildSmartSession({ ...input, constraints: { targetMinutes: 90 }, newItemsToday: 20 })), 0)
})
check('three-day return conservatively caps new exposure', () => {
  assert.equal(count(buildSmartSession({ ...input, lastActivityAt: now - 3 * day })), 5)
})
check('backlog stays bounded and still allows a little forward progress', () => {
  const due = Array.from({ length: 30 }, (_, i) => word('due' + i, [attempt('d' + i)]))
  const r = buildSmartSession({ ...input, candidates: [...due, ...fresh], progress: { ...input.progress, completedBlocks: 1 } })
  assert.equal(r.blocks[0].purpose, 'new')
  assert.equal(count(r), 5)
  assert.ok(r.estimatedSeconds <= 360)
})
const reading = { kind: 'reading', key: 'passageA', contentId: 'exam/A/v1', estimatedSeconds: 900, recommendationRank: 0, reason: 'recent_core_exposure_overlap', evidenceRefs: ['real-word-event'] }
check('reading is capability-gated and indivisible', () => {
  assert.equal(count(buildSmartSession({ ...input, candidates: [reading] })), 0)
  assert.equal(count(buildSmartSession({ ...input, candidates: [reading], availableActivities: ['reading'], constraints: { targetMinutes: 10 } })), 0)
  const r = buildSmartSession({ ...input, candidates: [reading], availableActivities: ['reading'], constraints: { targetMinutes: 45 } })
  assert.equal(r.blocks[0].activity.kind, 'reading')
  assert.equal(r.estimatedSeconds, 900)
})
check('natural break and explicit continuation after break', () => {
  assert.equal(buildSmartSession({ ...input, progress: { ...input.progress, activeSecondsSinceBreak: 1500 } }).disposition, 'break')
  assert.equal(buildSmartSession({ ...input, progress: { ...input.progress, activeSeconds: 1500, activeSecondsSinceBreak: 0 } }).disposition, 'continue')
})
check('old errors do not imply permanent weakness', () => {
  const r = buildSmartSession({ ...input, candidates: [word('old', [attempt('old1', 30, 3), attempt('old2', 20, 2), attempt('clean', 1, 0)])] })
  assert.equal(count(r), 0)
})
check('invalid budgets and future facts are rejected', () => {
  assert.throws(() => buildSmartSession({ ...input, constraints: { targetMinutes: NaN } }))
  assert.throws(() => buildSmartSession({ ...input, candidates: [word('bad', [{ id: 'future', occurredAt: now + 1, wrongCount: 0 }])] }))
})
console.log(checks + ' deterministic scenario checks passed')
