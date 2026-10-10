import type { PracticeChoices } from '@/semantic/practiceChoices'
import type { PracticeMode, PracticePool } from '@/semantic/practice'
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

export async function getWorkspaceState(): Promise<WorkspaceState | undefined> {
  const { data, error } = await supabase.rpc('get_wenyan_workspace_state')
  if (error) throw error
  if (data == null) return undefined
  const state = parseWorkspaceState(data)
  if (!state) throw new Error('云端学习位置格式无法识别。')
  return state
}

export async function saveWorkspaceState(input: WorkspaceStateInput): Promise<WorkspaceState> {
  const { data, error } = await supabase.rpc('save_wenyan_workspace_state', {
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
