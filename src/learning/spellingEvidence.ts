import type { LearningEventRecord, WordAttemptedPayload } from './types'

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
}

export interface SpellingErrorGroup {
  word: string
  dict: string
  records: SpellingAttemptRecord[]
  wrongCount: number
  latestOccurredAt: number
}

const normalizeWord = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase()

export function eventVisibleToOwner(event: LearningEventRecord, ownerUserId?: string) {
  return ownerUserId ? event.ownerUserId === ownerUserId : event.ownerUserId === undefined
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
  }
}

export function visibleSpellingAttempts(events: readonly LearningEventRecord[], ownerUserId?: string) {
  return events
    .filter((event) => eventVisibleToOwner(event, ownerUserId))
    .map(parseWordAttemptEvent)
    .filter((record): record is SpellingAttemptRecord => Boolean(record))
}

/**
 * Error-book semantics: a word is currently unresolved only when its latest
 * spelling attempt for this owner/dictionary still contains an error.
 * Historical attempts stay available inside the group but are never deleted.
 */
export function buildActiveSpellingErrors(events: readonly LearningEventRecord[], ownerUserId?: string): SpellingErrorGroup[] {
  const attempts = visibleSpellingAttempts(events, ownerUserId)
    .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
  const latest = new Map<string, SpellingAttemptRecord>()
  const history = new Map<string, SpellingAttemptRecord[]>()

  for (const attempt of attempts) {
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
      }
    })
    .sort((a, b) => b.latestOccurredAt - a.latestOccurredAt || a.word.localeCompare(b.word))
}
