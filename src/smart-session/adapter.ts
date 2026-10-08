import { buildSmartSession } from './planner'
import {
  type SmartSessionRuntime,
  beginSmartBlock,
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
    const record = await db.reviewRecords.get(runtime.currentBlock.reviewRecordId)
    if (record && !record.isFinished) return { kind: 'resume', runtime, record: record as ReviewRecord }
  }

  const [words, rawEvents] = await Promise.all([
    wordListFetcher(dictionary.url),
    db.learningEvents.where('eventType').equals('word_attempted').toArray(),
  ])
  const visibleEvents = rawEvents
    .filter((event) => visibleToCurrentOwner(ownerUserId, event.ownerUserId))
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
  attemptsByKey.forEach((attempts, key) => {
    if (attempts.some((attempt) => attempt.occurredAt >= runtime.startedAt)) sessionAttemptedKeys.add(key)
    if (attempts[0]?.occurredAt >= runtime.startedAt) sessionNewItems += 1
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

  const draft = buildSmartSession({
    now,
    snapshotId: `${dictId}:${visibleEvents.length}:${lastActivityAt ?? 0}`,
    constraints: {
      ...constraints,
      focusDictionary: dictId,
      preferredActivities: ['vocabulary'],
    },
    candidates,
    availableActivities: ['vocabulary'],
    progress: runtimeProgress(runtime, now),
    newItemsToday,
    lastActivityAt,
    coverage: visibleEvents.length > 0 ? 'partial' : 'unknown',
  })

  return { kind: 'draft', runtime, draft, wordsByContentId }
}

export async function startPreparedVocabularyBlock(
  prepared: Extract<PreparedSmartSession, { kind: 'draft' }>,
  now = Date.now(),
): Promise<{ runtime: SmartSessionRuntime; record: ReviewRecord }> {
  const block: SessionBlock | undefined = prepared.draft.blocks[0]
  if (!block || block.activity.kind !== 'vocabulary' || block.activity.items.length === 0) {
    throw new Error('smart_session_has_no_vocabulary_block')
  }
  if (prepared.runtime.hardStopAt !== undefined) {
    if (now >= prepared.runtime.hardStopAt) throw new Error('smart_session_hard_stop_reached')
    if (now + block.estimatedSeconds * 1000 + HARD_STOP_RESERVE_MS > prepared.runtime.hardStopAt) {
      throw new Error('smart_session_hard_stop_would_be_exceeded')
    }
  }

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
