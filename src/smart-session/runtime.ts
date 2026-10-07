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
  focusDictionary: string
  startedAt: number
  updatedAt: number
  completedBlocks: number
  attemptedKeys: string[]
  newItemsIntroduced: number
  estimatedActiveSeconds: number
  estimatedActiveSecondsSinceBreak: number
  currentBlock?: SmartBlockRuntime
}

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `smart-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function freshRuntime(focusDictionary: string, now = Date.now()): SmartSessionRuntime {
  return {
    schemaVersion: 1,
    id: uuid(),
    focusDictionary,
    startedAt: now,
    updatedAt: now,
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
    if (!Number.isFinite(value.startedAt) || !Number.isFinite(value.updatedAt)) return undefined
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

export async function loadSmartSessionRuntime(focusDictionary: string, now = Date.now()) {
  let state = readStored()
  if (!state || state.focusDictionary !== focusDictionary || now - state.updatedAt > MAX_IDLE_MS) {
    state = freshRuntime(focusDictionary, now)
    persist(state)
    return state
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
