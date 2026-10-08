import type { LearningStage, StagePreference, StageReminderPreference } from './types'
import { supabase } from '@/supabase/client'

export interface LearningPreferencesSnapshot {
  schemaVersion: 1
  learningStage: StagePreference
  stageReminder: StageReminderPreference | null
  confirmedAt: string | null
  updatedAt: string | null
}

function requestId(prefix: string) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${id}`
}

function isSnapshot(value: unknown): value is LearningPreferencesSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const snapshot = value as Partial<LearningPreferencesSnapshot>
  const stage = snapshot.learningStage
  return snapshot.schemaVersion === 1
    && Boolean(stage)
    && ['vocabulary', 'mixed', 'exam_practice'].includes(String(stage?.current))
    && typeof stage?.revision === 'number'
    && Number.isInteger(stage.revision)
    && stage.revision >= 0
}

export async function getLearningPreferences() {
  const { data, error } = await supabase.rpc('get_learning_preferences')
  if (error) throw new Error(error.message || 'learning_preferences_unavailable')
  if (!isSnapshot(data)) throw new Error('invalid_learning_preferences')
  return data
}

export async function confirmLearningStage(stage: LearningStage, expectedRevision: number) {
  const { data, error } = await supabase.rpc('confirm_learning_stage', {
    p_request_id: requestId('web-stage-confirm'),
    p_stage: stage,
    p_expected_revision: expectedRevision,
    p_change_reason: 'User explicitly confirmed the long-term learning stage in Wenyan.',
  })
  if (error) throw new Error(error.message || 'learning_stage_update_failed')
  if (!isSnapshot(data)) throw new Error('invalid_learning_preferences')
  return data
}
