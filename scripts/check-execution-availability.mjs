import assert from 'node:assert/strict'
import { buildSmartSession } from '../src/smart-session/planner.ts'

const now = 1_800_000_000_000
const minute = 60_000
const day = 86_400_000
const word = (key, attempts = [], ordinal = 0) => ({
  kind: 'vocabulary',
  key,
  contentId: `kaoyan/${key}`,
  dictionaryId: 'kaoyan',
  ordinal,
  attempts,
  estimatedSeconds: 60,
})
const base = {
  now,
  snapshotId: 'availability-fixture',
  constraints: { focusDictionary: 'kaoyan' },
  availableActivities: ['vocabulary'],
  newItemsToday: 0,
  coverage: 'complete',
  progress: {
    attemptedKeys: [],
    completedBlocks: 0,
    newItemsIntroduced: 0,
    activeSeconds: 0,
    elapsedSeconds: 0,
    activeSecondsSinceBreak: 0,
    timingQuality: 'measured',
  },
}

const recentError = word('cooldown', [{ id: 'cooldown-event', occurredAt: now - 5 * minute, wrongCount: 1 }], 1)
const correction = word('correction', [{ id: 'correction-event', occurredAt: now - 30 * minute, wrongCount: 1 }], 2)
const review = word('review', [{ id: 'review-event', occurredAt: now - 4 * day, wrongCount: 0 }], 3)
const fresh = word('fresh', [], 4)

const result = buildSmartSession({ ...base, candidates: [recentError, correction, review, fresh] })
assert.equal(result.availability.status, 'evaluated')
assert.equal(result.availability.correctionCooldownCount, 1)
assert.equal(result.availability.correctionEligibleCount, 1)
assert.equal(result.availability.reviewEligibleCount, 1)
assert.equal(result.availability.newEligibleCount, 1)
assert.equal(result.availability.newWordCapacity, 20)

const reviewOnly = buildSmartSession({
  ...base,
  candidates: [recentError, fresh],
  constraints: { focusDictionary: 'kaoyan', reviewPreference: 'review_first', newWordCeiling: 0 },
})
assert.equal(reviewOnly.reason, 'review_only_waiting_for_correction_cooldown')
assert.equal(reviewOnly.availability.correctionCooldownCount, 1)
assert.equal(reviewOnly.availability.newWordCapacity, 0)

const budgetReached = buildSmartSession({
  ...base,
  candidates: [review, fresh],
  constraints: { focusDictionary: 'kaoyan', hardStopMinutes: 10 },
  progress: { ...base.progress, elapsedSeconds: 600 },
})
assert.equal(budgetReached.reason, 'budget_reached')
assert.equal(budgetReached.availability.status, 'not_evaluated')

console.log('3 execution availability scenarios passed')
