import type { CoachingWordFact } from './types'

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const surface = (word: string) => word.trim().toLowerCase()

export interface LearningEvidenceWindow {
  calendarDays: 7
  activeDays: number
  wordAttempts: number
  zeroErrorAttempts: number
  spellingErrorAttempts: number
  uniqueObservedWords: number
  firstObservedWords: number
  repeatedExposureAttempts: number
  distinctSpellingErrorWords: number
}

export interface RepeatedSpellingErrorEvidence {
  surface: string
  errorAttempts: number
  totalAttempts: number
  lastObservedAt: number
  evidenceIds: string[]
}

export interface LearningEvidenceV1 {
  algorithmVersion: 'learning-evidence-v1'
  basis: 'word_attempted'
  windows: {
    current7: LearningEvidenceWindow
    previous7: LearningEvidenceWindow
    delta: {
      activeDays: number
      wordAttempts: number
      zeroErrorAttempts: number
      spellingErrorAttempts: number
      distinctSpellingErrorWords: number
    }
  }
  continuity: {
    latestObservedAt: number | null
    calendarDaysSinceLatest: number | null
    recentActiveDayStreak: number
  }
  repeatedSpellingErrors14: RepeatedSpellingErrorEvidence[]
  comparability: 'sparse' | 'complete_visible_history' | 'partial_visible_history'
  interpretation: {
    zeroErrorAttempts: 'attempts_with_no_recorded_spelling_error'
    spellingErrorAttempts: 'attempts_with_one_or_more_recorded_spelling_errors'
    repeatedSpellingErrors14: 'same_surface_with_at_least_two_error_attempts_in_calendar_14d'
  }
  uncertainties: string[]
}

interface LearningEvidenceInput {
  now: number
  today: number
  calendarDay: (time: number) => number
  facts: readonly CoachingWordFact[]
  firstFactIds: ReadonlySet<string>
  completeVisibleHistory: boolean
}

function summarizeWindow(
  facts: readonly CoachingWordFact[],
  firstFactIds: ReadonlySet<string>,
  calendarDay: (time: number) => number,
  fromDay: number,
  throughDay: number,
): LearningEvidenceWindow {
  const selected = facts.filter((fact) => {
    const day = calendarDay(fact.occurredAt)
    return day >= fromDay && day <= throughDay
  })
  const errorFacts = selected.filter((fact) => fact.wrongCount > 0)
  return {
    calendarDays: 7,
    activeDays: new Set(selected.map((fact) => calendarDay(fact.occurredAt))).size,
    wordAttempts: selected.length,
    zeroErrorAttempts: selected.filter((fact) => fact.wrongCount === 0).length,
    spellingErrorAttempts: errorFacts.length,
    uniqueObservedWords: new Set(selected.map((fact) => surface(fact.word))).size,
    firstObservedWords: selected.filter((fact) => firstFactIds.has(fact.id)).length,
    repeatedExposureAttempts: selected.filter((fact) => !firstFactIds.has(fact.id)).length,
    distinctSpellingErrorWords: new Set(errorFacts.map((fact) => surface(fact.word))).size,
  }
}

function activeDayStreak(days: readonly number[]) {
  if (!days.length) return 0
  const uniqueDays = Array.from(new Set(days)).sort((a, b) => a - b)
  let streak = 1
  for (let i = uniqueDays.length - 1; i > 0; i -= 1) {
    if (uniqueDays[i] - uniqueDays[i - 1] !== 1) break
    streak += 1
  }
  return streak
}

/**
 * Deterministic descriptive evidence only. This function does not infer mastery,
 * motivation, fatigue, recall speed, readiness or causality.
 */
export function buildLearningEvidenceV1(input: LearningEvidenceInput): LearningEvidenceV1 {
  const currentFrom = input.today - 6
  const previousFrom = input.today - 13
  const previousThrough = input.today - 7
  const current7 = summarizeWindow(input.facts, input.firstFactIds, input.calendarDay, currentFrom, input.today)
  const previous7 = summarizeWindow(input.facts, input.firstFactIds, input.calendarDay, previousFrom, previousThrough)

  const recent14 = input.facts.filter((fact) => input.calendarDay(fact.occurredAt) >= previousFrom)
  const grouped = new Map<string, CoachingWordFact[]>()
  for (const fact of recent14) {
    const key = surface(fact.word)
    const group = grouped.get(key) ?? []
    group.push(fact)
    grouped.set(key, group)
  }

  const repeatedSpellingErrors14 = Array.from(grouped, ([key, facts]) => {
    const errorFacts = facts.filter((fact) => fact.wrongCount > 0)
    if (errorFacts.length < 2) return null
    const ordered = [...facts].sort((a, b) => a.occurredAt - b.occurredAt || compare(a.id, b.id))
    return {
      surface: key,
      errorAttempts: errorFacts.length,
      totalAttempts: facts.length,
      lastObservedAt: ordered[ordered.length - 1].occurredAt,
      evidenceIds: errorFacts.slice(-4).map((fact) => fact.id),
    }
  })
    .filter((item): item is RepeatedSpellingErrorEvidence => item !== null)
    .sort((a, b) => b.errorAttempts - a.errorAttempts || b.totalAttempts - a.totalAttempts || b.lastObservedAt - a.lastObservedAt || compare(a.surface, b.surface))
    .slice(0, 8)

  const latestObservedAt = input.facts.length ? input.facts[input.facts.length - 1].occurredAt : null
  const observedDays = input.facts.map((fact) => input.calendarDay(fact.occurredAt))
  const comparability = input.facts.length === 0
    ? 'sparse'
    : input.completeVisibleHistory
      ? 'complete_visible_history'
      : 'partial_visible_history'

  return {
    algorithmVersion: 'learning-evidence-v1',
    basis: 'word_attempted',
    windows: {
      current7,
      previous7,
      delta: {
        activeDays: current7.activeDays - previous7.activeDays,
        wordAttempts: current7.wordAttempts - previous7.wordAttempts,
        zeroErrorAttempts: current7.zeroErrorAttempts - previous7.zeroErrorAttempts,
        spellingErrorAttempts: current7.spellingErrorAttempts - previous7.spellingErrorAttempts,
        distinctSpellingErrorWords: current7.distinctSpellingErrorWords - previous7.distinctSpellingErrorWords,
      },
    },
    continuity: {
      latestObservedAt,
      calendarDaysSinceLatest: latestObservedAt === null ? null : Math.max(0, input.today - input.calendarDay(latestObservedAt)),
      recentActiveDayStreak: activeDayStreak(observedDays),
    },
    repeatedSpellingErrors14,
    comparability,
    interpretation: {
      zeroErrorAttempts: 'attempts_with_no_recorded_spelling_error',
      spellingErrorAttempts: 'attempts_with_one_or_more_recorded_spelling_errors',
      repeatedSpellingErrors14: 'same_surface_with_at_least_two_error_attempts_in_calendar_14d',
    },
    uncertainties: [
      'spelling_evidence_is_not_semantic_mastery',
      'window_deltas_are_descriptive_not_causal',
      ...(input.completeVisibleHistory ? [] : ['visible_history_may_exclude_unsynced_learning']),
    ],
  }
}
