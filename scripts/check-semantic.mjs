import assert from 'node:assert/strict'
import { buildSemanticEvidence, parseSemanticPayload } from '../src/semantic/core.ts'
import { buildSmartSession } from '../src/smart-session/planner.ts'
import { buildAgentExecutionGuidance } from '../src/coaching/agent.ts'
const now = 1800000000000
const day = 86400000
const payload = { domain: 'english', activity: 'semantic_recall', measurement: 'self_report_after_reveal', direction: 'en_to_meaning',
  contentId: 'semantic:fixture:alpha', contentVersion: `sha256:${'a'.repeat(64)}`, dictionaryId: 'fixture', word: 'alpha',
  sessionId: 'session', blockId: 'block', cue: 'word_only', responseMode: 'mental_recall', answerRevealed: true, resumedAfterReveal: false, rating: 'partial' }
assert.throws(() => parseSemanticPayload({ ...payload, measurement: 'objective_correctness' }))
assert.throws(() => parseSemanticPayload({ ...payload, contentVersion: 'mutable-latest' }))
assert.throws(() => parseSemanticPayload({ ...payload, answerRevealed: false }))
const fact = { id: 'one', occurredAt: now - day, payload }
const evidence = buildSemanticEvidence([fact, fact, { ...fact, id: 'future', occurredAt: now + 1 }], now)
assert.equal(evidence.attempts, 1)
assert.equal(evidence.selfReported.partial, 1)
assert.equal(evidence.excluded, 1)
assert.equal(evidence.revisit[0].evidenceId, 'one')
assert.ok(!('mastery' in evidence))
assert.equal(buildSemanticEvidence([], now).attempts, 0)
const progress = { attemptedKeys: [], completedBlocks: 0, newItemsIntroduced: 0, activeSeconds: 0, elapsedSeconds: 0, activeSecondsSinceBreak: 0, timingQuality: 'estimated' }
const semantic = { kind: 'semantic_recall', key: 'semantic:fixture:alpha', contentId: 'semantic:fixture:alpha', estimatedSeconds: 25, evidenceRefs: [] }
const input = { now, snapshotId: 'fixture', constraints: { newWordCeiling: 0, preferredActivities: ['semantic_recall'] }, candidates: [semantic], availableActivities: ['semantic_recall'], progress, newItemsToday: 0, coverage: 'partial' }
let draft = buildSmartSession(input)
assert.equal(draft.blocks[0].activity.kind, 'semantic_recall')
assert.equal(draft.availability.semanticEligibleCount, 1)
assert.equal(draft.availability.newWordCapacity, 0)
assert.equal(buildSmartSession({ ...input, availableActivities: [] }).blocks.length, 0)
assert.equal(buildSmartSession({ ...input, constraints: { ...input.constraints, hardStopMinutes: 1 } }).blocks.length, 0)
assert.equal(buildSmartSession({ ...input, progress: { ...progress, attemptedKeys: [semantic.key] } }).blocks.length, 0)
assert.equal(buildSmartSession({ ...input, candidates: [{ ...semantic, lastAttemptAt: now - day / 2, lastRating: 'partial' }] }).blocks.length, 0)
assert.equal(buildSmartSession({ ...input, candidates: [{ ...semantic, lastAttemptAt: now - day * 2, lastRating: 'recalled' }] }).blocks.length, 0)
assert.equal(buildSmartSession({ ...input, candidates: [{ ...semantic, lastAttemptAt: now - day * 2, lastRating: 'partial' }] }).blocks.length, 1)
assert.throws(() => buildSmartSession({ ...input, candidates: [{ ...semantic, lastAttemptAt: now + 1 }] }))
draft = buildSmartSession({ ...input, candidates: Array.from({ length: 12 }, (_, i) => ({ ...semantic, key: `semantic:${i}`, contentId: `semantic:${i}` })) })
assert.equal(draft.blocks[0].activity.items.length, 6)
const snapshot = { availabilityStatus: 'evaluated', sessionKind: 'draft', disposition: 'finish', reason: 'cooldown', retryAt: now + 10000, selectedItemCount: 0 }
assert.equal(buildAgentExecutionGuidance({ status: 'fresh', snapshot }).next, 'wait')
assert.equal(buildAgentExecutionGuidance({ status: 'stale', snapshot }).next, 'refresh_or_continue_local')
assert.equal(buildAgentExecutionGuidance({ status: 'fresh', snapshot: { ...snapshot, sessionKind: 'resume' } }).next, 'resume')
assert.equal(buildAgentExecutionGuidance({ status: 'fresh', snapshot: { ...snapshot, retryAt: null } }).next, 'explain_or_revise')
console.log('PASS semantic measurement, deduplication, coverage, budget, spacing, replay and agent self-correction')
