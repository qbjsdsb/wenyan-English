import type { SemanticCandidate } from './types'
import type { SemanticItem, SemanticPayload, SemanticRun } from '@/semantic/core'
import { parseSemanticPayload, semanticKey } from '@/semantic/core'
import { semanticItem } from '@/semantic/provider'
import { buildSmartSession } from './planner'
import {
  type SmartSessionRuntime,
  beginSmartBlock,
  createSmartSessionId,
  loadSmartSessionRuntime,
  reconcileSmartRuntimeEvidence,
  runtimeProgress,
} from './runtime'
import type { SessionBlock, SessionConstraints, SmartSessionDraft, VocabularyCandidate } from './types'
import type { WordAttemptedPayload } from '@/learning/types'
import { idDictionaryMap } from '@/resources/dictionary'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import type { Word } from '@/typings'
import { db } from '@/utils/db'
import { ReviewRecord } from '@/utils/db/record'
import { wordListFetcher } from '@/utils/wordListFetcher'

const DAY = 86_400_000
const SHANGHAI_OFFSET = 8 * 60 * 60 * 1000
const DEFAULT_WORD_SECONDS = 15
const HARD_STOP_RESERVE_MS = 60_000

export function smartVocabularyKey(word: string) {
  return `spelling:${word.trim().toLocaleLowerCase()}`
}

function contentId(dictId: string, ordinal: number) {
  return `${dictId}:${String(ordinal).padStart(6, '0')}`
}

function startOfShanghaiDay(now: number) {
  return Math.floor((now + SHANGHAI_OFFSET) / DAY) * DAY - SHANGHAI_OFFSET
}

function visibleToCurrentOwner(ownerUserId: string | undefined, eventOwnerUserId: string | undefined) {
  return ownerUserId ? eventOwnerUserId === ownerUserId : !eventOwnerUserId
}

function wordAttemptPayload(value: unknown): WordAttemptedPayload | undefined {
  if (!value || typeof value !== 'object') return undefined
  const payload = value as Partial<WordAttemptedPayload>
  if (typeof payload.word !== 'string' || !payload.word.trim()) return undefined
  if (typeof payload.dict !== 'string' || !payload.dict) return undefined
  if (typeof payload.wrongCount !== 'number' || !Number.isInteger(payload.wrongCount) || payload.wrongCount < 0) return undefined
  return payload as WordAttemptedPayload
}

export type PreparedSmartSession =
  | { kind: 'semantic-resume'; runtime: SmartSessionRuntime; run: SemanticRun }
  | {
      kind: 'resume'
      runtime: SmartSessionRuntime
      record: ReviewRecord
    }
  | {
      kind: 'draft'
      runtime: SmartSessionRuntime
      draft: SmartSessionDraft
      wordsByContentId: Map<string, Word>
      semanticItems?: Map<string, SemanticItem>
    }

export async function prepareSmartVocabularySession(
  dictId: string,
  constraints: SessionConstraints = {},
  now = Date.now(),
  runtimeSessionId?: string,
): Promise<PreparedSmartSession> {
  const dictionary = idDictionaryMap[dictId]
  if (!dictionary || dictionary.language !== 'en') throw new Error('smart_session_requires_english_dictionary')

  const ownerUserId = getLocalLearningOwnerId()
  let runtime = await loadSmartSessionRuntime(dictId, now, {
    ownerUserId,
    hardStopMinutes: constraints.hardStopMinutes,
    sessionId: runtimeSessionId,
  })
  if (runtime.currentBlock) {
    if (runtime.currentBlock.semanticRunId) {
      const run = await db.semanticRuns.get(runtime.currentBlock.semanticRunId)
      if (run && run.ownerUserId === ownerUserId && run.completedAt === undefined && run.endedAt === undefined) return { kind: 'semantic-resume', runtime, run }
    }
    const record = runtime.currentBlock.reviewRecordId === undefined ? undefined : await db.reviewRecords.get(runtime.currentBlock.reviewRecordId)
    if (record && !record.isFinished) return { kind: 'resume', runtime, record: record as ReviewRecord }
  }

  const [words, rawEvents, semanticEvents] = await Promise.all([
    wordListFetcher(dictionary.url),
    db.learningEvents.where('eventType').equals('word_attempted').toArray(),
    db.learningEvents.where('eventType').equals('semantic_recall_attempted').toArray(),
  ])
  const visibleEvents = rawEvents
    .filter((event) => visibleToCurrentOwner(ownerUserId, event.ownerUserId) && event.occurredAt <= now)
    .map((event) => ({ event, payload: wordAttemptPayload(event.payload) }))
    .filter((entry): entry is { event: (typeof rawEvents)[number]; payload: WordAttemptedPayload } => Boolean(entry.payload))

  const attemptsByKey = new Map<string, { id: string; occurredAt: number; wrongCount: number }[]>()
  for (const { event, payload } of visibleEvents) {
    const key = smartVocabularyKey(payload.word)
    const attempts = attemptsByKey.get(key) ?? []
    attempts.push({ id: event.id, occurredAt: event.occurredAt, wrongCount: payload.wrongCount })
    attemptsByKey.set(key, attempts)
  }
  attemptsByKey.forEach((attempts) => attempts.sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id)))

  const sessionAttemptedKeys = new Set<string>()
  let sessionNewItems = 0
  const evidenceSince = runtime.executionStartedAt ?? now
  attemptsByKey.forEach((attempts, key) => {
    if (attempts.some((attempt) => attempt.occurredAt >= evidenceSince)) sessionAttemptedKeys.add(key)
    if (runtime.executionStartedAt !== undefined && attempts[0]?.occurredAt >= runtime.executionStartedAt) sessionNewItems += 1
  })
  runtime = reconcileSmartRuntimeEvidence(runtime, Array.from(sessionAttemptedKeys), sessionNewItems, now)

  const wordsByContentId = new Map<string, Word>()
  const candidates: VocabularyCandidate[] = words.map((word, ordinal) => {
    const id = contentId(dictId, ordinal)
    wordsByContentId.set(id, word)
    return {
      kind: 'vocabulary',
      key: smartVocabularyKey(word.name),
      contentId: id,
      dictionaryId: dictId,
      ordinal,
      attempts: attemptsByKey.get(smartVocabularyKey(word.name)) ?? [],
      // Planning heuristic only. This is deliberately not derived from durationMs,
      // which is inter-key timing rather than study duration or recall latency.
      estimatedSeconds: DEFAULT_WORD_SECONDS,
    }
  })

  const dayStart = startOfShanghaiDay(now)
  let newItemsToday = 0
  let lastActivityAt: number | undefined
  attemptsByKey.forEach((attempts) => {
    const first = attempts[0]
    const latest = attempts[attempts.length - 1]
    if (first && first.occurredAt >= dayStart && first.occurredAt < dayStart + DAY) newItemsToday += 1
    if (latest && (lastActivityAt === undefined || latest.occurredAt > lastActivityAt)) lastActivityAt = latest.occurredAt
  })

  const semanticItems = new Map<string, SemanticItem>()
  const latestSemantic = new Map<string, { id: string; occurredAt: number; payload: SemanticPayload }>()
  for (const event of semanticEvents) {
    if (!visibleToCurrentOwner(ownerUserId, event.ownerUserId) || event.occurredAt > now) continue
    try {
      const payload = parseSemanticPayload(event.payload)
      const key = semanticKey(payload.dictionaryId, payload.word)
      if (payload.sessionId === runtime.id) sessionAttemptedKeys.add(key)
      const previous = latestSemantic.get(key)
      if (!previous || previous.occurredAt < event.occurredAt || (previous.occurredAt === event.occurredAt && previous.id < event.id)) {
        latestSemantic.set(key, { id: event.id, occurredAt: event.occurredAt, payload })
      }
    } catch { /* Unknown measurement is excluded, never reinterpreted as success. */ }
  }
  runtime = reconcileSmartRuntimeEvidence(runtime, Array.from(sessionAttemptedKeys), sessionNewItems, now)
  // Only actually observed words are eligible. Missing semantic evidence must not create new-word exposure.
  // Bound hashing work; candidates are deterministic, oldest semantic observation first.
  const pool = words.filter((word) => attemptsByKey.has(smartVocabularyKey(word.name)))
    .sort((a, b) => (latestSemantic.get(semanticKey(dictId, a.name))?.occurredAt ?? 0)
      - (latestSemantic.get(semanticKey(dictId, b.name))?.occurredAt ?? 0) || a.name.localeCompare(b.name)).slice(0, 120)
  const semanticCandidates: SemanticCandidate[] = []
  for (const word of pool) {
    const item = await semanticItem(dictId, word)
    if (!item || semanticItems.has(item.contentId)) continue
    semanticItems.set(item.contentId, item)
    const prior = latestSemantic.get(item.key)
    const matching = prior?.payload.contentVersion === item.contentVersion ? prior : undefined
    semanticCandidates.push({ kind: 'semantic_recall', key: item.key, contentId: item.contentId, estimatedSeconds: 25,
      lastAttemptAt: matching?.occurredAt, lastRating: matching?.payload.rating, evidenceRefs: matching ? [matching.id] : [] })
  }

  const draft = buildSmartSession({
    now,
    snapshotId: `${dictId}:${visibleEvents.length}:${lastActivityAt ?? 0}`,
    constraints: {
      ...constraints,
      focusDictionary: dictId,
      preferredActivities: constraints.preferredActivities ?? ['vocabulary'],
    },
    candidates: [...candidates, ...semanticCandidates],
    availableActivities: ['vocabulary', 'semantic_recall'],
    progress: runtimeProgress(runtime, now),
    newItemsToday,
    lastActivityAt,
    coverage: visibleEvents.length > 0 ? 'partial' : 'unknown',
  })

  if (ownerUserId !== getLocalLearningOwnerId()) throw new Error('账号已经改变，请重新安排。')
  return { kind: 'draft', runtime, draft, wordsByContentId, semanticItems }
}

function assertHardStopAllowsBlock(runtime: SmartSessionRuntime, block: SessionBlock, now: number) {
  if (runtime.hardStopAt !== undefined) {
    if (now >= runtime.hardStopAt) throw new Error('smart_session_hard_stop_reached')
    if (now + block.estimatedSeconds * 1000 + HARD_STOP_RESERVE_MS > runtime.hardStopAt) {
      throw new Error('smart_session_hard_stop_would_be_exceeded')
    }
    return
  }
  if (
    runtime.hardStopMinutes !== undefined
    && block.estimatedSeconds * 1000 + HARD_STOP_RESERVE_MS > runtime.hardStopMinutes * 60_000
  ) {
    throw new Error('smart_session_hard_stop_would_be_exceeded')
  }
}

export function assertPreparedVocabularyBlockStartable(
  prepared: Extract<PreparedSmartSession, { kind: 'draft' }>,
  now = Date.now(),
) {
  const block: SessionBlock | undefined = prepared.draft.blocks[0]
  if (!block || !['vocabulary', 'semantic_recall'].includes(block.activity.kind) || block.activity.items.length === 0) {
    throw new Error('smart_session_has_no_vocabulary_block')
  }
  assertHardStopAllowsBlock(prepared.runtime, block, now)
  return block
}

export async function startPreparedVocabularyBlock(
  prepared: Extract<PreparedSmartSession, { kind: 'draft' }>,
  now = Date.now(),
): Promise<{ runtime: SmartSessionRuntime; record: ReviewRecord }> {
  if (prepared.runtime.ownerUserId !== getLocalLearningOwnerId()) throw new Error('账号已经改变，请重新安排。')
  const block = assertPreparedVocabularyBlockStartable(prepared, now)

  if (block.activity.kind !== 'vocabulary') throw new Error('vocabulary_block_required')
  const words = block.activity.items.map((item) => {
    const word = prepared.wordsByContentId.get(item.contentId)
    if (!word || smartVocabularyKey(word.name) !== item.key) throw new Error('smart_session_content_mismatch')
    return word
  })
  const record = new ReviewRecord(prepared.runtime.focusDictionary, words)
  const reviewRecordId = await db.reviewRecords.add(record)
  record.id = reviewRecordId

  const runtime = beginSmartBlock(
    prepared.runtime,
    {
      reviewRecordId,
      purpose: block.purpose,
      keys: block.activity.items.map((item) => item.key),
      estimatedSeconds: block.estimatedSeconds,
    },
    now,
  )

  return { runtime, record }
}

/** Separate activity storage: semantic attempts cannot complete a spelling chapter or Cloud Plan chapter task. */
export async function startPreparedSemanticBlock(prepared: Extract<PreparedSmartSession, { kind: 'draft' }>, now = Date.now()) {
  if (prepared.runtime.ownerUserId !== getLocalLearningOwnerId()) throw new Error('账号已经改变，请重新安排。')
  const block = assertPreparedVocabularyBlockStartable(prepared, now)
  if (block.activity.kind !== 'semantic_recall') throw new Error('semantic_block_required')
  if (prepared.runtime.ownerUserId !== getLocalLearningOwnerId()) throw new Error('账号已经改变，请重新安排。')
  const items = block.activity.items.map((item) => {
    const content = prepared.semanticItems?.get(item.contentId)
    if (!content || content.key !== item.key) throw new Error('semantic_content_mismatch')
    return content
  })
  const id = createSmartSessionId()
  const hardStopAt = prepared.runtime.hardStopAt ?? (prepared.runtime.hardStopMinutes === undefined ? undefined
    : (prepared.runtime.executionStartedAt ?? now) + prepared.runtime.hardStopMinutes * 60000)
  const run: SemanticRun = { id, ownerUserId: prepared.runtime.ownerUserId, sessionId: prepared.runtime.id,
    dictionaryId: prepared.runtime.focusDictionary, startedAt: now, hardStopAt, items, index: 0 }
  await db.semanticRuns.add(run)
  const runtime = beginSmartBlock(prepared.runtime, { semanticRunId: id, purpose: 'semantic_recall',
    keys: items.map((item) => item.key), estimatedSeconds: block.estimatedSeconds }, now)
  return { runtime, run }
}
