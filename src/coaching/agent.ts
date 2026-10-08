/** Operational guidance only. Never writes intents, changes stage, or labels learning completion. */
export function buildAgentExecutionGuidance(runtime: {
  status: string
  snapshot: null | { availabilityStatus: string; sessionKind: string; disposition: string; reason: string; retryAt: number | null; selectedItemCount: number }
}) {
  const state = runtime.snapshot
  const common = {
    contractVersion: 'agent-execution-v1',
    completionAuthority: 'immutable_learning_facts_only',
    writeProtocol: ['read_context', 'use_existing_intent_revision', 'revise_bounded_future_intent_if_needed', 'open_today_on_selected_online_device', 'poll_action_status', 'reread_fresh_executor_context', 'observe_new_learning_facts'],
    stability: 'Keep a valid baseline. Missing/stale evidence is not a reason to increase workload. For ordinary evidence-led changes require observations across multiple days; prefer one reversible day/session adjustment. User-stated constraints may apply immediately. Do not repeatedly resend unchanged blocked intent.',
  }
  if (runtime.status !== 'fresh' || !state) return { ...common, next: 'refresh_or_continue_local', reason: 'current_execution_capacity_unknown', retryAt: null,
    instruction: 'Do not use stale counts or claim the website is ready. Open Today only on an online authorized device; otherwise give the entry link. Local learning remains available.' }
  if (state.sessionKind === 'resume') return { ...common, next: 'resume', reason: 'unfinished_activity', retryAt: null,
    instruction: 'Offer to continue the unfinished activity before replacing its future arrangement. A resume candidate is not completed learning.' }
  if (state.disposition === 'break') return { ...common, next: 'offer_break', reason: state.reason, retryAt: null }
  if (state.disposition === 'continue' && state.selectedItemCount > 0) return { ...common, next: 'ready', reason: state.reason, retryAt: null,
    instruction: 'A candidate is available, not started or completed. Revalidate at start; count success only after website receipt and learning separately after facts.' }
  if (state.retryAt !== null) return { ...common, next: 'wait', reason: state.reason, retryAt: state.retryAt,
    instruction: 'Respect cooldown. Do not retry the same intent in a loop or silently lift the new-word ceiling.' }
  return { ...common, next: 'explain_or_revise', reason: state.reason, retryAt: null,
    instruction: 'Explain why no block fits. Keep hard constraints. A different supported activity or explicitly agreed budget change may help; ending early is valid. Do not infer mastery, fatigue or motivation.' }
}
