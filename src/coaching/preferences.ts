import type { LearningStage, StagePreference, StageReminderPreference } from './types'
import { supabase } from '@/supabase/client'
import { getAuthenticatedOwner } from '@/sync/authOwner'

export interface LearningPreferencesSnapshot {
  schemaVersion: 1
  learningStage: StagePreference
  stageReminder: StageReminderPreference | null
  confirmedAt: string | null
  updatedAt: string | null
}

export interface BrowserLearningPreferencesSnapshot extends LearningPreferencesSnapshot {
  ownerUserId: string
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

async function requireBrowserOwner() {
  const auth = await getAuthenticatedOwner()
  if (auth.status === 'signed-out') throw new Error('authentication_required')
  if (auth.status === 'failed') throw new Error(auth.message)
  return auth.userId
}

function bindOwner(snapshot: LearningPreferencesSnapshot, ownerUserId: string): BrowserLearningPreferencesSnapshot {
  return { ...snapshot, ownerUserId }
}

function browserOwnerError(message: string | undefined, fallback: string) {
  const value = message || fallback
  return value.includes('browser_owner_changed') ? 'learning_owner_changed' : value
}

export async function getLearningPreferences(): Promise<BrowserLearningPreferencesSnapshot> {
  const ownerUserId = await requireBrowserOwner()
  const { data, error } = await supabase.rpc('get_learning_preferences_for_owner', {
    p_expected_user_id: ownerUserId,
  })
  if (error) throw new Error(browserOwnerError(error.message, 'learning_preferences_unavailable'))
  if (!isSnapshot(data)) throw new Error('invalid_learning_preferences')
  return bindOwner(data, ownerUserId)
}

export async function confirmLearningStage(
  stage: LearningStage,
  loadedSnapshot: BrowserLearningPreferencesSnapshot,
): Promise<BrowserLearningPreferencesSnapshot> {
  const currentOwnerUserId = await requireBrowserOwner()
  if (currentOwnerUserId !== loadedSnapshot.ownerUserId) throw new Error('learning_owner_changed')

  const { data, error } = await supabase.rpc('confirm_learning_stage_for_owner', {
    p_expected_user_id: loadedSnapshot.ownerUserId,
    p_request_id: requestId('web-stage-confirm'),
    p_stage: stage,
    p_expected_revision: loadedSnapshot.learningStage.revision,
    p_change_reason: 'User explicitly confirmed the long-term learning stage in Wenyan.',
  })
  if (error) throw new Error(browserOwnerError(error.message, 'learning_stage_update_failed'))
  if (!isSnapshot(data)) throw new Error('invalid_learning_preferences')
  return bindOwner(data, loadedSnapshot.ownerUserId)
}
