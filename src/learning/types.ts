import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'

export type LearningEventType = 'word_attempted' | 'chapter_completed'

export type LearningEventSyncState = 'pending' | 'synced' | 'failed'

export interface LearningEventRecord<TPayload = unknown> {
  id: string
  eventType: LearningEventType
  occurredAt: number
  syncState: LearningEventSyncState
  syncAttempts: number
  ownerUserId?: string
  nextSyncAttemptAt?: number
  lastSyncError?: string
  payload: TPayload
}

export interface LearningSyncCursor {
  userId: string
  createdAt: string
  eventId: string
  updatedAt: number
}

export interface WordAttemptedPayload {
  word: string
  dict: string
  chapter: number | null
  reviewMode: boolean
  wrongCount: number
  durationMs: number
  timing: number[]
  mistakes: Record<number, string[]>
}

export interface ChapterCompletedPayload {
  dict: string
  chapter: number | null
  reviewMode: boolean
  durationSeconds: number
  correctCount: number
  wrongCount: number
  wordCount: number
  wordNumber: number
  firstTryCorrectCount: number
}

function createUuidV4() {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex
    .slice(10, 16)
    .join('')}`
}

export function createLearningEvent<TPayload>(eventType: LearningEventType, payload: TPayload): LearningEventRecord<TPayload> {
  return {
    id: createUuidV4(),
    eventType,
    occurredAt: Date.now(),
    syncState: 'pending',
    syncAttempts: 0,
    ownerUserId: getLocalLearningOwnerId(),
    payload,
  }
}
