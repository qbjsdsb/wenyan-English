import type { LearningEventRecord, WordAttemptedPayload } from './types'
import type { IWordRecord } from '@/utils/db/record'

export interface SpellingAttemptRecord {
  id: string
  word: string
  dict: string
  chapter: number | null
  occurredAt: number
  timeStamp: number
  reviewMode: boolean
  timing: number[]
  wrongCount: number
  mistakes: Record<number, string[]>
  /** Inter-key timing only; this is not full study duration or recall latency. */
  totalTime: number
  /** Legacy rows are display-only compatibility evidence and are never uploaded or rewritten as facts. */
  source: 'fact' | 'legacy'
}

export interface SpellingErrorGroup {
  word: string
  dict: string
  records: SpellingAttemptRecord[]
  wrongCount: number
  latestOccurredAt: number
  latestSource: SpellingAttemptRecord['source']
}

const normalizeWord = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase()

export function eventVisibleToOwner(event: LearningEventRecord, ownerUserId?: string) {
  return ownerUserId ? event.ownerUserId === ownerUserId : event.ownerUserId === undefined
}

function normalizeMistakes(value: Record<number, string[]> | undefined) {
  const normalized: Array<[number, string[]]> = []
  if (!value) return normalized
  Object.entries(value).forEach(([rawIndex, rawValues]) => {
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index < 0 || !Array.isArray(rawValues)) return
    normalized.push([index, rawValues.filter((item): item is string => typeof item === 'string')])
  })
  return normalized.sort(([a], [b]) => a - b)
}

function spellingShape(record: Pick<SpellingAttemptRecord, 'word' | 'dict' | 'chapter' | 'wrongCount' | 'timing' | 'mistakes'>) {
  return JSON.stringify([
    record.dict,
    normalizeWord(record.word),
    record.chapter,
    record.wrongCount,
    record.timing,
    normalizeMistakes(record.mistakes),
  ])
}

export function parseWordAttemptEvent(event: LearningEventRecord): SpellingAttemptRecord | undefined {
  if (event.eventType !== 'word_attempted' || !Number.isFinite(event.occurredAt) || event.occurredAt < 0) return undefined
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return undefined
  const payload = event.payload as Partial<WordAttemptedPayload>
  if (typeof payload.word !== 'string' || !payload.word.trim() || typeof payload.dict !== 'string' || !payload.dict.trim()) return undefined
  if (typeof payload.wrongCount !== 'number' || !Number.isInteger(payload.wrongCount) || payload.wrongCount < 0) return undefined

  const timing = Array.isArray(payload.timing)
    ? payload.timing.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    : []
  const durationMs = typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs) && payload.durationMs >= 0
    ? payload.durationMs
    : timing.reduce((total, value) => total + value, 0)
  const rawMistakes = payload.mistakes && typeof payload.mistakes === 'object' && !Array.isArray(payload.mistakes)
    ? payload.mistakes
    : {}
  const mistakes: Record<number, string[]> = {}
  Object.entries(rawMistakes).forEach(([index, values]) => {
    const numeric = Number(index)
    if (!Number.isInteger(numeric) || numeric < 0 || !Array.isArray(values)) return
    mistakes[numeric] = values.filter((value): value is string => typeof value === 'string')
  })

  return {
    id: event.id,
    word: payload.word.trim(),
    dict: payload.dict,
    chapter: typeof payload.chapter === 'number' || payload.chapter === null ? payload.chapter : null,
    occurredAt: event.occurredAt,
    timeStamp: Math.floor(event.occurredAt / 1000),
    reviewMode: Boolean(payload.reviewMode),
    timing,
    wrongCount: payload.wrongCount,
    mistakes,
    totalTime: durationMs,
    source: 'fact',
  }
}

export function visibleSpellingAttempts(events: readonly LearningEventRecord[], ownerUserId?: string) {
  return events
    .filter((event) => eventVisibleToOwner(event, ownerUserId))
    .map(parseWordAttemptEvent)
    .filter((record): record is SpellingAttemptRecord => Boolean(record))
}

/**
 * Add only genuinely pre-fact WordRecords as compatibility evidence. New WordRecords
 * are written in the same transaction as word_attempted, so a shape/time companion
 * across any owner removes them from the legacy fallback instead of leaking another
 * account's newer activity into this view.
 */
export function visibleSpellingAttemptsWithLegacy(
  events: readonly LearningEventRecord[],
  wordRecords: readonly IWordRecord[],
  ownerUserId?: string,
) {
  const visibleFacts = visibleSpellingAttempts(events, ownerUserId)
  const companionBuckets = new Map<string, number[]>()
  events.map(parseWordAttemptEvent).filter((record): record is SpellingAttemptRecord => Boolean(record)).forEach((record) => {
    const key = spellingShape(record)
    const times = companionBuckets.get(key) ?? []
    times.push(record.timeStamp)
    companionBuckets.set(key, times)
  })
  companionBuckets.forEach((times) => times.sort((a, b) => a - b))

  const legacy: SpellingAttemptRecord[] = []
  wordRecords.forEach((record, index) => {
    if (
      typeof record.word !== 'string' || !record.word.trim() ||
      typeof record.dict !== 'string' || !record.dict.trim() ||
      typeof record.timeStamp !== 'number' || !Number.isFinite(record.timeStamp) ||
      typeof record.wrongCount !== 'number' || !Number.isInteger(record.wrongCount) || record.wrongCount < 0
    ) return
    const timing = Array.isArray(record.timing)
      ? record.timing.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
      : []
    const mistakes = Object.fromEntries(normalizeMistakes(record.mistakes)) as Record<number, string[]>
    const candidate: SpellingAttemptRecord = {
      id: `legacy:${record.timeStamp}:${record.dict}:${normalizeWord(record.word)}:${index}`,
      word: record.word.trim(),
      dict: record.dict,
      chapter: typeof record.chapter === 'number' || record.chapter === null ? record.chapter : null,
      occurredAt: record.timeStamp * 1000,
      timeStamp: record.timeStamp,
      reviewMode: record.chapter === null || (typeof record.chapter === 'number' && record.chapter < 0),
      timing,
      wrongCount: record.wrongCount,
      mistakes,
      totalTime: timing.reduce((total, value) => total + value, 0),
      source: 'legacy',
    }
    const key = spellingShape(candidate)
    const times = companionBuckets.get(key) ?? []
    const companionIndex = times.findIndex((seconds) => Math.abs(seconds - record.timeStamp) <= 1)
    if (companionIndex >= 0) {
      times.splice(companionIndex, 1)
      return
    }
    legacy.push(candidate)
  })

  return {
    records: [...visibleFacts, ...legacy].sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id)),
    legacyCount: legacy.length,
  }
}

export function buildActiveSpellingErrorsFromAttempts(attempts: readonly SpellingAttemptRecord[]): SpellingErrorGroup[] {
  const recentFirst = [...attempts].sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
  const latest = new Map<string, SpellingAttemptRecord>()
  const history = new Map<string, SpellingAttemptRecord[]>()

  for (const attempt of recentFirst) {
    const key = JSON.stringify([attempt.dict, normalizeWord(attempt.word)])
    if (!latest.has(key)) latest.set(key, attempt)
    const records = history.get(key) ?? []
    records.push(attempt)
    history.set(key, records)
  }

  return Array.from(latest.entries())
    .filter(([, attempt]) => attempt.wrongCount > 0)
    .map(([key, attempt]) => {
      const records = history.get(key) ?? [attempt]
      return {
        word: attempt.word,
        dict: attempt.dict,
        records,
        wrongCount: records.reduce((total, record) => total + record.wrongCount, 0),
        latestOccurredAt: attempt.occurredAt,
        latestSource: attempt.source,
      }
    })
    .sort((a, b) => b.latestOccurredAt - a.latestOccurredAt || a.word.localeCompare(b.word))
}

/**
 * Error-book semantics: a word is currently unresolved only when its latest
 * spelling attempt for this owner/dictionary still contains an error.
 * Historical attempts stay available inside the group but are never deleted.
 */
export function buildActiveSpellingErrors(events: readonly LearningEventRecord[], ownerUserId?: string): SpellingErrorGroup[] {
  return buildActiveSpellingErrorsFromAttempts(visibleSpellingAttempts(events, ownerUserId))
}
