import type { Purpose, SessionProgress } from './types'
import { db } from '@/utils/db'

const STORAGE_KEY = 'wenyanSmartSessionRuntimeV1'
const MAX_IDLE_MS = 6 * 60 * 60 * 1000

export interface SmartBlockRuntime {
  id: string
  reviewRecordId: number
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
  startedAt: number
  updatedAt: number
  /** Elapsed-time ceiling fixed when this runtime first adopts a hard-stop constraint. */
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
}

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `smart-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hardStopAt(startedAt: number, hardStopMinutes: number | undefined) {
  if (hardStopMinutes === undefined) return undefined
  if (!Number.isInteger(hardStopMinutes) || hardStopMinutes < 0 || hardStopMinutes > 240) throw new Error('invalid_smart_session_hard_stop')
  return startedAt + hardStopMinutes * 60_000
}

function freshRuntime(focusDictionary: string, options: RuntimeOptions = {}, now = Date.now()): SmartSessionRuntime {
  return {
    schemaVersion: 1,
    id: uuid(),
    ownerUserId: options.ownerUserId,
    focusDictionary,
    startedAt: now,
    updatedAt: now,
    hardStopAt: hardStopAt(now, options.hardStopMinutes),
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
    if (value.hardStopAt !== undefined && !Number.isFinite(value.hardStopAt)) return undefined
    if (!Number.isFinite(value.completedBlocks) || !Number.isFinite(value.newItemsIntroduced)) return undefined
    if (!Number.isFinite(value.estimatedActiveSeconds) || !Number.isFinite(value.estimatedActiveSecondsSinceBreak)) return undefined
    if (!Array.isArray(value.attemptedKeys)) return undefined
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

/**
 * Keep an unfinished Smart Block recoverable even when a newer cloud intent
 * changes the focus dictionary while the learner is away. Authenticated owners
 * never recover a legacy/other-account runtime.
 */
export async function getRecoverableSmartSessionFocusDictionary(ownerUserId?: string, now = Date.now()) {
  const state = readStored()
  if (!state?.currentBlock || !sameOwner(state, ownerUserId) || now - state.updatedAt > MAX_IDLE_MS) return undefined
  const record = await db.reviewRecords.get(state.currentBlock.reviewRecordId)
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
    state = freshRuntime(focusDictionary, options, now)
    persist(state)
    return state
  }

  // A hard stop becomes part of the session runtime the first time it is seen.
  // Expiring/cloud-unavailable Intent cannot silently remove that already-adopted ceiling.
  if (state.hardStopAt === undefined && options.hardStopMinutes !== undefined) {
    state = { ...state, hardStopAt: hardStopAt(state.startedAt, options.hardStopMinutes), updatedAt: now }
    persist(state)
  }

  if (state.currentBlock) {
    const record = await db.reviewRecords.get(state.currentBlock.reviewRecordId)
    if (!record) {
      state = { ...state, currentBlock: undefined, updatedAt: now }
      persist(state)
    } else if (record.isFinished) {
      state = {
        ...state,
        completedBlocks: state.completedBlocks + 1,
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
  const next: SmartSessionRuntime = {
    ...state,
    updatedAt: now,
    currentBlock: { ...block, id: uuid(), startedAt: now },
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
    elapsedSeconds: Math.max(0, Math.floor((now - state.startedAt) / 1000)),
    activeSecondsSinceBreak: state.estimatedActiveSecondsSinceBreak,
    timingQuality: 'estimated',
  }
}
