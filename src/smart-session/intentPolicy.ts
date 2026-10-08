export type LearningIntentScope = 'ongoing' | 'day' | 'session'
export type IntentRuntimeSource = 'cloud' | 'cached-cloud'

export interface IntentApplicabilityInput {
  scope: LearningIntentScope
  timezone: string
  effectiveFrom: number
  expiresAt: number | null
  boundSessionId: string | null
}

export interface IntentApplicabilityResult {
  active: boolean
  warning?:
    | 'day_intent_outside_effective_calendar_day'
    | 'session_intent_bound_elsewhere'
    | 'unbound_cached_session_intent_ignored'
}

export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

export function calendarDay(time: number, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(time)
}

/** Pure policy: decide whether one already-validated Intent may affect this runtime now. */
export function evaluateIntentApplicability(
  intent: IntentApplicabilityInput,
  now: number,
  source: IntentRuntimeSource,
  runtimeSessionId?: string,
): IntentApplicabilityResult {
  if (intent.effectiveFrom > now || (intent.expiresAt !== null && now >= intent.expiresAt)) return { active: false }

  if (intent.scope === 'day' && calendarDay(intent.effectiveFrom, intent.timezone) !== calendarDay(now, intent.timezone)) {
    return { active: false, warning: 'day_intent_outside_effective_calendar_day' }
  }

  if (intent.scope === 'session') {
    if (intent.boundSessionId !== null && intent.boundSessionId !== runtimeSessionId) {
      return { active: false, warning: 'session_intent_bound_elsewhere' }
    }
    // A cached unbound session Intent may have been claimed by another device while
    // this browser was offline. Only live cloud state may claim it for a new runtime.
    if (source === 'cached-cloud' && intent.boundSessionId === null) {
      return { active: false, warning: 'unbound_cached_session_intent_ignored' }
    }
  }

  return { active: true }
}
