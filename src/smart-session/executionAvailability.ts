import type { PreparedSmartSession } from './adapter'
import { supabase } from '@/supabase/client'

/**
 * Short-lived executor context for the Coach. This is derived runtime state,
 * never a learning fact, and reporting failure must never block local study.
 */
export function executionAvailabilityReport(prepared: PreparedSmartSession) {
  if (prepared.kind === 'resume') {
    return {
      p_algorithm_version: 'elastic-v2',
      p_focus_dictionary: prepared.runtime.focusDictionary,
      p_planner_snapshot_id: `runtime:${prepared.runtime.id}`,
      p_availability_status: 'not_evaluated',
      p_session_kind: 'resume',
      p_disposition: 'continue',
      p_reason: 'resume_unfinished_block',
      p_retry_at: null,
      p_review_eligible_count: 0,
      p_weak_eligible_count: 0,
      p_correction_eligible_count: 0,
      p_correction_cooldown_count: 0,
      p_new_eligible_count: 0,
      p_new_word_capacity: 0,
      p_reading_eligible_count: 0,
      p_selected_purpose: prepared.runtime.currentBlock?.purpose ?? null,
      p_selected_item_count: prepared.record.words.length,
      p_coverage: 'unknown',
    }
  }

  const selected = prepared.draft.blocks[0]
  const availability = prepared.draft.availability
  return {
    p_algorithm_version: prepared.draft.algorithmVersion,
    p_focus_dictionary: prepared.runtime.focusDictionary,
    p_planner_snapshot_id: prepared.draft.snapshotId,
    p_availability_status: availability.status,
    p_session_kind: 'draft',
    p_disposition: prepared.draft.disposition,
    p_reason: prepared.draft.reason,
    p_retry_at: prepared.draft.retryAt === undefined ? null : new Date(prepared.draft.retryAt).toISOString(),
    p_review_eligible_count: availability.reviewEligibleCount,
    p_weak_eligible_count: availability.weakEligibleCount,
    p_correction_eligible_count: availability.correctionEligibleCount,
    p_correction_cooldown_count: availability.correctionCooldownCount,
    p_new_eligible_count: availability.newEligibleCount,
    p_new_word_capacity: availability.newWordCapacity,
    p_reading_eligible_count: availability.readingEligibleCount,
    p_selected_purpose: selected?.purpose ?? null,
    p_selected_item_count: selected?.activity.items.length ?? 0,
    // Local history is intentionally treated conservatively here. Coaching Context
    // carries its own cloud-history coverage separately.
    p_coverage: 'unknown',
  }
}

export async function reportSmartSessionExecutionAvailability(prepared: PreparedSmartSession) {
  try {
    const { error } = await supabase.rpc('report_execution_availability', executionAvailabilityReport(prepared))
    return !error
  } catch {
    return false
  }
}
