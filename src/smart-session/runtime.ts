import type { Purpose, SessionProgress } from './types'
import { db } from '@/utils/db'

const STORAGE_KEY = 'wenyanSmartSessionRuntimeV1'
const MAX_IDLE_MS = 6 * 60 * 60 * 1000

export interface SmartBlockRuntime {
  id: string
  reviewRecordId?: number
  semanticRunId?: string
  purpose: Purpose
  keys: string[]
  estimatedSeconds: number
  startedAt: number
}

export interface SmartSessionRuntime {
  schemaVersion: 1
  id: string
  /** Missing only for legacy/anonymous local sessions. Authenticated sessions never reuse another owner's runtime. */
  ownerUserId?: string
  focusDictionary: string
  /** Runtime creation timestamp; retained for old state compatibility. */
  startedAt: number
  /** First real Smart Block start. Budget clocks use this, not page-open time. */
  executionStartedAt?: number
  updatedAt: number
  /** Bound before start, converted into hardStopAt on the first real block. */
  hardStopMinutes?: number
  hardStopAt?: number
  completedBlocks: number
  attemptedKeys: string[]
  newItemsIntroduced: number
  estimatedActiveSeconds: number
  estimatedActiveSecondsSinceBreak: number
  currentBlock?: SmartBlockRuntime
}

interface RuntimeOptions {
  ownerUserId?: string
  hardStopMinutes?: number
  sessionId?: string
}

export function createSmartSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `smart-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function validateHardStopMinutes(value: number | undefined) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 0 || value > 240) throw new Error('invalid_smart_session_hard_stop')
  return value
}

function freshRuntime(focusDictionary: string, options: RuntimeOptions = {}, now = Date.now()): SmartSessionRuntime {
  return {
    schemaVersion: 1,
    id: options.sessionId ?? createSmartSessionId(),
    ownerUserId: options.ownerUserId,
    focusDictionary,
    startedAt: now,
    updatedAt: now,
    hardStopMinutes: validateHardStopMinutes(options.hardStopMinutes),
    completedBlocks: 0,
    attemptedKeys: [],
    newItemsIntroduced: 0,
    estimatedActiveSeconds: 0,
    estimatedActiveSecondsSinceBreak: 0,
  }
}

function readStored(): SmartSessionRuntime | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as SmartSessionRuntime | null
    if (!value || value.schemaVersion !== 1 || typeof value.id !== 'string' || typeof value.focusDictionary !== 'string') return undefined
    if (value.ownerUserId !== undefined && typeof value.ownerUserId !== 'string') return undefined
    if (!Number.isFinite(value.startedAt) || !Number.isFinite(value.updatedAt)) return undefined
    if (value.executionStartedAt !== undefined && !Number.isFinite(value.executionStartedAt)) return undefined
    if (value.hardStopMinutes !== undefined && (!Number.isInteger(value.hardStopMinutes) || value.hardStopMinutes < 0 || value.hardStopMinutes > 240)) return undefined
    if (value.hardStopAt !== undefined && !Number.isFinite(value.hardStopAt)) return undefined
    if (!Number.isFinite(value.completedBlocks) || !Number.isFinite(value.newItemsIntroduced)) return undefined
    if (!Number.isFinite(value.estimatedActiveSeconds) || !Number.isFinite(value.estimatedActiveSecondsSinceBreak)) return undefined
    if (!Array.isArray(value.attemptedKeys)) return undefined
    // Older persisted sessions had no executionStartedAt. If they have execution evidence,
    // their historical startedAt is the safest available approximation.
    if (value.executionStartedAt === undefined && (value.currentBlock || value.completedBlocks > 0 || value.attemptedKeys.length > 0)) {
      value.executionStartedAt = value.startedAt
    }
    return value
  } catch {
    return undefined
  }
}

function persist(state: SmartSessionRuntime) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Runtime recovery is helpful, but storage failure must never block learning.
  }
}

function sameOwner(state: SmartSessionRuntime, ownerUserId: string | undefined) {
  return ownerUserId ? state.ownerUserId === ownerUserId : state.ownerUserId === undefined
}

export function getCurrentSmartSessionId(ownerUserId?: string, now = Date.now()) {
  const state = readStored()
  if (!state || !sameOwner(state, ownerUserId) || now - state.updatedAt > MAX_IDLE_MS) return undefined
  return state.id
}

/**
 * Keep an unfinished Smart Block recoverable even when a newer cloud intent
 * changes the focus dictionary while the learner is away. Authenticated owners
 * never recover a legacy/other-account runtime.
 */
export async function getRecoverableSmartSessionFocusDictionary(ownerUserId?: string, now = Date.now()) {
  const pending = await db.semanticRuns.orderBy('startedAt').reverse().filter((run) =>
    run.ownerUserId === ownerUserId && run.completedAt === undefined && run.endedAt === undefined).first()
  if (pending) return pending.dictionaryId
  const state = readStored()
  if (!state?.currentBlock || !sameOwner(state, ownerUserId) || now - state.updatedAt > MAX_IDLE_MS) return undefined
  const record = state.currentBlock.semanticRunId
    ? await db.semanticRuns.get(state.currentBlock.semanticRunId).then((run) => run && ({ isFinished: run.completedAt !== undefined || run.endedAt !== undefined, abandoned: run.endedAt !== undefined && run.completedAt === undefined }))
    : state.currentBlock.reviewRecordId === undefined ? undefined : await db.reviewRecords.get(state.currentBlock.reviewRecordId)
  return record && !record.isFinished ? state.focusDictionary : undefined
}

export async function loadSmartSessionRuntime(
  focusDictionary: string,
  now = Date.now(),
  options: RuntimeOptions = {},
) {
  let state = readStored()
  if (
    !state
    || !sameOwner(state, options.ownerUserId)
    || state.focusDictionary !== focusDictionary
    || now - state.updatedAt > MAX_IDLE_MS
  ) {
    const pending = await db.semanticRuns.orderBy('startedAt').reverse().filter((run) =>
      run.ownerUserId === options.ownerUserId && run.dictionaryId === focusDictionary && run.completedAt === undefined && run.endedAt === undefined).first()
    state = pending ? {
      ...freshRuntime(focusDictionary, { ...options, sessionId: pending.sessionId }, now),
      executionStartedAt: pending.startedAt, hardStopAt: pending.hardStopAt,
      currentBlock: { id: pending.id, semanticRunId: pending.id, purpose: 'semantic_recall',
        keys: pending.items.map((item) => item.key), estimatedSeconds: pending.items.length * 25, startedAt: pending.startedAt },
    } : freshRuntime(focusDictionary, options, now)
    persist(state)
    return state
  }

  // Before the first real block starts, a newer live Intent may still replace the
  // pending hard-stop minutes. Once execution starts, the deadline is immutable.
  if (state.executionStartedAt === undefined) {
    const nextHardStop = validateHardStopMinutes(options.hardStopMinutes)
    if (state.hardStopMinutes !== nextHardStop) {
      state = { ...state, hardStopMinutes: nextHardStop, updatedAt: now }
      persist(state)
    }
  }

  if (state.currentBlock) {
    const record = state.currentBlock.semanticRunId
    ? await db.semanticRuns.get(state.currentBlock.semanticRunId).then((run) => run && ({ isFinished: run.completedAt !== undefined || run.endedAt !== undefined, abandoned: run.endedAt !== undefined && run.completedAt === undefined }))
    : state.currentBlock.reviewRecordId === undefined ? undefined : await db.reviewRecords.get(state.currentBlock.reviewRecordId)
    if (!record) {
      state = { ...state, currentBlock: undefined, updatedAt: now }
      persist(state)
    } else if (record.isFinished) {
      state = {
        ...state,
        completedBlocks: state.completedBlocks + ('abandoned' in record && record.abandoned ? 0 : 1),
        estimatedActiveSeconds: state.estimatedActiveSeconds + state.currentBlock.estimatedSeconds,
        estimatedActiveSecondsSinceBreak: state.estimatedActiveSecondsSinceBreak + state.currentBlock.estimatedSeconds,
        currentBlock: undefined,
        updatedAt: now,
      }
      persist(state)
    }
  }

  return state
}

export function reconcileSmartRuntimeEvidence(
  state: SmartSessionRuntime,
  attemptedKeys: readonly string[],
  newItemsIntroduced: number,
  now = Date.now(),
) {
  const merged = new Set([...state.attemptedKeys, ...attemptedKeys])
  const next: SmartSessionRuntime = {
    ...state,
    attemptedKeys: Array.from(merged),
    newItemsIntroduced: Math.max(state.newItemsIntroduced, newItemsIntroduced),
    updatedAt: now,
  }
  persist(next)
  return next
}

export function beginSmartBlock(
  state: SmartSessionRuntime,
  block: Omit<SmartBlockRuntime, 'id' | 'startedAt'>,
  now = Date.now(),
) {
  if (state.hardStopAt !== undefined && now >= state.hardStopAt) throw new Error('smart_session_hard_stop_reached')
  const executionStartedAt = state.executionStartedAt ?? now
  const hardStopAt = state.hardStopAt ?? (
    state.hardStopMinutes === undefined ? undefined : executionStartedAt + state.hardStopMinutes * 60_000
  )
  const next: SmartSessionRuntime = {
    ...state,
    executionStartedAt,
    hardStopAt,
    updatedAt: now,
    currentBlock: { ...block, id: createSmartSessionId(), startedAt: now },
  }
  persist(next)
  return next
}

export function acknowledgeSmartBreak(state: SmartSessionRuntime, now = Date.now()) {
  const next: SmartSessionRuntime = {
    ...state,
    estimatedActiveSecondsSinceBreak: 0,
    updatedAt: now,
  }
  persist(next)
  return next
}

/** Hard stop is enforced at safe word boundaries; it never fabricates block/chapter completion. */
export function isSmartSessionHardStopReached(sessionId: string, now = Date.now()) {
  const state = readStored()
  return Boolean(state && state.id === sessionId && state.hardStopAt !== undefined && now >= state.hardStopAt)
}

export function runtimeProgress(state: SmartSessionRuntime, now = Date.now()): SessionProgress {
  return {
    attemptedKeys: state.attemptedKeys,
    completedBlocks: state.completedBlocks,
    newItemsIntroduced: state.newItemsIntroduced,
    activeSeconds: state.estimatedActiveSeconds,
    elapsedSeconds: state.executionStartedAt === undefined ? 0 : Math.max(0, Math.floor((now - state.executionStartedAt) / 1000)),
    activeSecondsSinceBreak: state.estimatedActiveSecondsSinceBreak,
    timingQuality: 'estimated',
  }
}

export function readCurrentSmartRuntime(ownerUserId?: string) {
  const state = readStored()
  return state && sameOwner(state, ownerUserId) ? state : undefined
}
