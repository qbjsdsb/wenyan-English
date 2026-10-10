import type { PracticeMode, PracticePool } from '@/semantic/practice'
import { practiceChoicesStorageKey, type PracticeChoices } from '@/semantic/practiceChoices'
import { supabase } from '@/supabase/client'

export type WorkspaceState = {
  schemaVersion: 1
  dictId: string
  chapterIndex: number
  practiceMode: PracticeMode
  practicePool: PracticePool
  practiceLimit: 6 | 12
  updatedAt: string
}

export type WorkspaceStateInput = Omit<WorkspaceState, 'schemaVersion' | 'updatedAt'>

export type WorkspaceRequestTicket = {
  generation: number
  ownerUserId?: string
}

export function createWorkspaceRequestGate() {
  let generation = 0
  return {
    begin(ownerUserId?: string): WorkspaceRequestTicket {
      generation += 1
      return { generation, ownerUserId }
    },
    invalidate() {
      generation += 1
    },
    accepts(ticket: WorkspaceRequestTicket, currentOwnerUserId?: string) {
      return ticket.generation === generation && ticket.ownerUserId === currentOwnerUserId
    },
  }
}

type LocalWorkspaceSnapshot = {
  dictId: string | null
  chapterIndex: string | null
  practiceChoices: string | null
}

export type LocalWorkspacePersistenceResult =
  | { ok: true; snapshot: LocalWorkspaceSnapshot }
  | { ok: false; snapshot: LocalWorkspaceSnapshot; rollbackOk: boolean }

const CURRENT_DICT_STORAGE_KEY = 'currentDict'
const CURRENT_CHAPTER_STORAGE_KEY = 'currentChapter'

function snapshotLocalWorkspace(ownerUserId: string): LocalWorkspaceSnapshot {
  return {
    dictId: localStorage.getItem(CURRENT_DICT_STORAGE_KEY),
    chapterIndex: localStorage.getItem(CURRENT_CHAPTER_STORAGE_KEY),
    practiceChoices: localStorage.getItem(practiceChoicesStorageKey(ownerUserId)),
  }
}

function replaceStorageValue(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key)
  else localStorage.setItem(key, value)
  return localStorage.getItem(key) === value
}

export function restoreLocalWorkspaceSnapshot(ownerUserId: string, snapshot: LocalWorkspaceSnapshot) {
  try {
    const results = [
      replaceStorageValue(CURRENT_DICT_STORAGE_KEY, snapshot.dictId),
      replaceStorageValue(CURRENT_CHAPTER_STORAGE_KEY, snapshot.chapterIndex),
      replaceStorageValue(practiceChoicesStorageKey(ownerUserId), snapshot.practiceChoices),
    ]
    return results.every(Boolean)
  } catch {
    return false
  }
}

export function persistLocalWorkspace(ownerUserId: string, state: WorkspaceState): LocalWorkspacePersistenceResult {
  const snapshot = snapshotLocalWorkspace(ownerUserId)
  const choices: PracticeChoices = {
    mode: state.practiceMode,
    pool: state.practicePool,
    limit: state.practiceLimit,
  }

  try {
    const writes = [
      replaceStorageValue(CURRENT_DICT_STORAGE_KEY, JSON.stringify(state.dictId)),
      replaceStorageValue(CURRENT_CHAPTER_STORAGE_KEY, JSON.stringify(state.chapterIndex)),
      replaceStorageValue(practiceChoicesStorageKey(ownerUserId), JSON.stringify(choices)),
    ]
    if (writes.every(Boolean)) return { ok: true, snapshot }
  } catch {
    // The rollback below owns failure reporting.
  }

  return { ok: false, snapshot, rollbackOk: restoreLocalWorkspaceSnapshot(ownerUserId, snapshot) }
}

function isPracticeMode(value: unknown): value is PracticeMode {
  return value === 'spelling' || value === 'recall' || value === 'discrimination'
}

function isPracticePool(value: unknown): value is PracticePool {
  return value === 'chapter' || value === 'learned' || value === 'errors' || value === 'uncertain'
}

export function parseWorkspaceState(value: unknown): WorkspaceState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  if (row.schemaVersion !== 1) return undefined
  if (typeof row.dictId !== 'string' || !row.dictId.trim()) return undefined
  if (!Number.isInteger(row.chapterIndex) || (row.chapterIndex as number) < 0) return undefined
  if (!isPracticeMode(row.practiceMode) || !isPracticePool(row.practicePool)) return undefined
  if (row.practiceLimit !== 6 && row.practiceLimit !== 12) return undefined
  if (typeof row.updatedAt !== 'string' || !row.updatedAt) return undefined
  return {
    schemaVersion: 1,
    dictId: row.dictId,
    chapterIndex: row.chapterIndex as number,
    practiceMode: row.practiceMode,
    practicePool: row.practicePool,
    practiceLimit: row.practiceLimit,
    updatedAt: row.updatedAt,
  }
}

export async function getWorkspaceState(expectedUserId: string): Promise<WorkspaceState | undefined> {
  const { data, error } = await supabase.rpc('get_wenyan_workspace_state', {
    p_expected_user_id: expectedUserId,
  })
  if (error) throw error
  if (data == null) return undefined
  const state = parseWorkspaceState(data)
  if (!state) throw new Error('云端学习位置格式无法识别。')
  return state
}

export async function saveWorkspaceState(expectedUserId: string, input: WorkspaceStateInput): Promise<WorkspaceState> {
  const { data, error } = await supabase.rpc('save_wenyan_workspace_state', {
    p_expected_user_id: expectedUserId,
    p_dict_id: input.dictId,
    p_chapter_index: input.chapterIndex,
    p_practice_mode: input.practiceMode,
    p_practice_pool: input.practicePool,
    p_practice_limit: input.practiceLimit,
  })
  if (error) throw error
  const state = parseWorkspaceState(data)
  if (!state) throw new Error('云端没有返回有效的学习位置。')
  return state
}

export function workspaceStateInput(dictId: string, chapterIndex: number, choices: PracticeChoices): WorkspaceStateInput {
  return {
    dictId,
    chapterIndex,
    practiceMode: choices.mode,
    practicePool: choices.pool,
    practiceLimit: choices.limit,
  }
}
