const COMPARABILITY = new Set(['sparse', 'complete_visible_history', 'partial_visible_history'])

/**
 * Product-policy guardrails for ChatGPT reasoning.
 *
 * This does not diagnose the learner, score readiness, or choose an action.
 * It only states how much longitudinal evidence is visible and which classes of
 * future changes are reversible versus user-confirmed.
 */
export function buildCoachDecisionSupportV1(input) {
  if (!input || typeof input !== 'object' || !COMPARABILITY.has(input.comparability)) {
    throw new Error('invalid_decision_comparability')
  }
  if (
    !input.current7 || !input.previous7 ||
    !Number.isInteger(input.current7.activeDays) || input.current7.activeDays < 0 ||
    !Number.isInteger(input.current7.wordAttempts) || input.current7.wordAttempts < 0 ||
    !Number.isInteger(input.previous7.activeDays) || input.previous7.activeDays < 0 ||
    !Number.isInteger(input.previous7.wordAttempts) || input.previous7.wordAttempts < 0 ||
    !Number.isInteger(input.repeatedSpellingErrorCount14) || input.repeatedSpellingErrorCount14 < 0 ||
    typeof input.coverageComplete !== 'boolean'
  ) throw new Error('invalid_decision_evidence')

  const currentObserved = input.current7.wordAttempts > 0
  const previousObserved = input.previous7.wordAttempts > 0
  const bothWindowsObserved = currentObserved && previousObserved
  const multiDayBothWindows = input.current7.activeDays >= 2 && input.previous7.activeDays >= 2

  const longitudinalUse = !bothWindowsObserved
    ? 'not_available'
    : !multiDayBothWindows
      ? 'limited_descriptive_only'
      : input.coverageComplete
        ? 'bounded_descriptive_only'
        : 'partial_descriptive_only'

  const evidenceStatus = !currentObserved && !previousObserved
    ? 'sparse'
    : !bothWindowsObserved
      ? 'single_window_observed'
      : input.coverageComplete
        ? 'two_windows_complete_visible_history'
        : 'two_windows_partial_visible_history'

  const observedSignals = []
  if (currentObserved) observedSignals.push('current_window_activity_observed')
  if (previousObserved) observedSignals.push('previous_window_activity_observed')
  if (input.repeatedSpellingErrorCount14 > 0) observedSignals.push('repeated_spelling_errors_observed')

  const uncertainties = []
  if (input.comparability === 'partial_visible_history') uncertainties.push('visible_history_may_exclude_unsynced_learning')
  if (!bothWindowsObserved) uncertainties.push('longitudinal_comparison_needs_observations_in_both_windows')
  if (bothWindowsObserved && !multiDayBothWindows) uncertainties.push('few_active_days_limit_longitudinal_interpretation')

  return {
    algorithmVersion: 'coach-decision-support-v1',
    evidenceStatus,
    longitudinalComparison: {
      use: longitudinalUse,
      currentActiveDays: input.current7.activeDays,
      previousActiveDays: input.previous7.activeDays,
      currentAttempts: input.current7.wordAttempts,
      previousAttempts: input.previous7.wordAttempts,
      note: 'window_deltas_are_descriptive_not_causal',
    },
    observedSignals,
    productPolicy: {
      reversibleFutureIntent: {
        scopes: ['session', 'day', 'ongoing'],
        fields: [
          'targetMinutes',
          'hardStopMinutes',
          'newWordCeiling',
          'reviewPreference',
          'intensity',
          'preferredActivities',
          'focusDictionary',
        ],
        rationaleMustDeclareBasis: true,
      },
      learningStage: {
        coachMayRecommend: true,
        writeRequiresUserConfirmation: true,
      },
      forbiddenClaims: [
        'semantic_mastery_from_spelling',
        'causal_change_from_window_delta',
        'fatigue_from_typing_duration',
        'learning_completion_from_command_status',
      ],
    },
    uncertainties,
  }
}
