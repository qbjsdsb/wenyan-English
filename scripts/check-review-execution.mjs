import assert from 'node:assert/strict'
import {
  isLegacyReviewRecord,
  isOwnerBoundReviewForOwner,
  isOwnerBoundReviewOrigin,
  isOwnerBoundReviewRecord,
  ownerBoundReviewReturnPath,
} from '../src/review/execution.ts'

const legacy = { dict: 'kaoyan', words: [], createTime: 1, index: 0, isFinished: false }
assert.equal(isLegacyReviewRecord(legacy), true)
assert.equal(isOwnerBoundReviewRecord(legacy), false)

for (const origin of ['manual', 'smart', 'correction']) {
  const record = { ...legacy, id: 7, origin, ownerUserId: 'owner-a' }
  assert.equal(isOwnerBoundReviewOrigin(origin), true)
  assert.equal(isOwnerBoundReviewRecord(record), true)
  assert.equal(isOwnerBoundReviewForOwner(record, 'owner-a'), true)
  assert.equal(isOwnerBoundReviewForOwner(record, 'owner-b'), false)
}

assert.equal(isOwnerBoundReviewRecord({ ...legacy, origin: 'manual', ownerUserId: 'owner-a' }), false)
assert.equal(isOwnerBoundReviewRecord({ ...legacy, id: 7, origin: 'manual' }), false)
assert.equal(isOwnerBoundReviewOrigin('legacy'), false)
assert.equal(ownerBoundReviewReturnPath('manual'), '/practice?mode=spelling')
assert.equal(ownerBoundReviewReturnPath('smart'), '/today')
assert.equal(ownerBoundReviewReturnPath('correction'), '/error-book')

console.log('review execution contract scenarios passed')
