import type { CoachingContextInput, CoachingWordFact, ReadingCandidateContext, ReadingCandidateInput, StageReminderPreference } from './types'

const DAY = 86_400_000
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const surface = (word: string) => word.trim().toLowerCase()
const finiteTime = (value: number) => Number.isFinite(value) && value >= 0 && value <= 8.64e15
const unique = (items: readonly string[]) => Array.from(new Set(items)).sort(compare)

interface LearningEvidenceWindow {
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

interface RepeatedSpellingErrorEvidence {
  surface: string
  errorAttempts: number
  totalAttempts: number
  lastObservedAt: number
  evidenceIds: string[]
}

function summarizeLearningWindow(
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

/** Deterministic descriptive evidence only; never mastery/readiness/fatigue inference. */
function buildLearningEvidenceV1(input: {
  today: number
  calendarDay: (time: number) => number
  facts: readonly CoachingWordFact[]
  firstFactIds: ReadonlySet<string>
  completeVisibleHistory: boolean
}) {
  const facts = [...input.facts].sort((a, b) => a.occurredAt - b.occurredAt || compare(a.id, b.id))
  const currentFrom = input.today - 6
  const previousFrom = input.today - 13
  const previousThrough = input.today - 7
  const current7 = summarizeLearningWindow(facts, input.firstFactIds, input.calendarDay, currentFrom, input.today)
  const previous7 = summarizeLearningWindow(facts, input.firstFactIds, input.calendarDay, previousFrom, previousThrough)

  const recent14 = facts.filter((fact) => input.calendarDay(fact.occurredAt) >= previousFrom)
  const grouped = new Map<string, CoachingWordFact[]>()
  for (const fact of recent14) {
    const key = surface(fact.word)
    const group = grouped.get(key) ?? []
    group.push(fact)
    grouped.set(key, group)
  }

  const repeatedSpellingErrors14 = Array.from(grouped, ([key, groupFacts]) => {
    const errorFacts = groupFacts.filter((fact) => fact.wrongCount > 0)
    if (errorFacts.length < 2) return null
    return {
      surface: key,
      errorAttempts: errorFacts.length,
      totalAttempts: groupFacts.length,
      lastObservedAt: groupFacts[groupFacts.length - 1].occurredAt,
      evidenceIds: errorFacts.slice(-4).map((fact) => fact.id),
    }
  })
    .filter((item): item is RepeatedSpellingErrorEvidence => item !== null)
    .sort((a, b) => b.errorAttempts - a.errorAttempts || b.totalAttempts - a.totalAttempts || b.lastObservedAt - a.lastObservedAt || compare(a.surface, b.surface))
    .slice(0, 8)

  const latestObservedAt = facts.length ? facts[facts.length - 1].occurredAt : null
  const observedDays = facts.map((fact) => input.calendarDay(fact.occurredAt))
  const comparability = facts.length === 0
    ? 'sparse'
    : input.completeVisibleHistory
      ? 'complete_visible_history'
      : 'partial_visible_history'

  return {
    algorithmVersion: 'learning-evidence-v1' as const,
    basis: 'word_attempted' as const,
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
      zeroErrorAttempts: 'attempts_with_no_recorded_spelling_error' as const,
      spellingErrorAttempts: 'attempts_with_one_or_more_recorded_spelling_errors' as const,
      repeatedSpellingErrors14: 'same_surface_with_at_least_two_error_attempts_in_calendar_14d' as const,
    },
    uncertainties: [
      'spelling_evidence_is_not_semantic_mastery',
      'window_deltas_are_descriptive_not_causal',
      ...(input.completeVisibleHistory ? [] : ['visible_history_may_exclude_unsynced_learning']),
    ],
  }
}

/** No readiness score. Catalog validity is independent from permission to execute now. */
export function buildReadingCandidates(input: ReadingCandidateInput) {
  if (!['vocabulary', 'mixed', 'exam_practice'].includes(input.stage) || !['execution', 'stage_assessment'].includes(input.purpose)) throw new Error('invalid_candidate_policy')
  if (!finiteTime(input.now) || !finiteTime(input.recentSince) || input.recentSince > input.now) throw new Error('invalid_snapshot_time')
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 5) throw new Error('invalid_candidate_limit')
  if (input.availableSeconds !== null && (!Number.isFinite(input.availableSeconds) || input.availableSeconds < 0)) {
    throw new Error('invalid_remaining_budget')
  }
  const words = new Map(input.words.map((word) => [word.surface, word]))
  const ids = new Set<string>()
  const items: ReadingCandidateContext[] = []
  for (const entry of [...input.catalog].sort((a, b) => compare(a.passage.id, b.passage.id) || compare(a.passage.version, b.passage.version))) {
    const p = entry.passage
    if (ids.has(p.id)) throw new Error('duplicate_catalog_content')
    ids.add(p.id)
    if (!p.id || !p.version || p.version !== entry.currentVersion || !entry.providerRef || !entry.loadable || !entry.contentComplete ||
      !entry.answersVerified || !p.recommendationEligible || !Number.isFinite(p.estimatedMinutes) || p.estimatedMinutes <= 0 ||
      !p.paragraphs.length || p.paragraphs.some((text) => !text.trim()) || !p.questions.length ||
      new Set(p.questions.map((q) => q.id)).size !== p.questions.length ||
      p.questions.some((q) => !q.id || !q.stem.trim() || q.options.length < 2 || q.options.some((o) => !o.id || !o.text.trim()) ||
        new Set(q.options.map((o) => o.id)).size !== q.options.length || !q.options.some((o) => o.id === q.correctOptionId))) continue
    if (!entry.repeatPolicy || !['never_same_version', 'allowed', 'after_cooldown'].includes(entry.repeatPolicy.kind)) continue
    if (entry.repeatPolicy.kind === 'after_cooldown' && (!Number.isFinite(entry.repeatPolicy.seconds) || entry.repeatPolicy.seconds < 0)) continue
    const attempts = entry.completedAttempts
    if (attempts?.some((a) => !a.id || !finiteTime(a.occurredAt) || a.occurredAt > input.now || !a.version)) continue
    const attemptsById = new Map<string, { occurredAt: number; version: string }>()
    for (const attempt of attempts ?? []) {
      const prior = attemptsById.get(attempt.id)
      if (prior && (prior.occurredAt !== attempt.occurredAt || prior.version !== attempt.version)) throw new Error('conflicting_reading_fact_uuid')
      attemptsById.set(attempt.id, attempt)
    }
    const previous = attempts === null ? null : Array.from(new Map(attempts.filter((a) => a.version === p.version).map((a) => [a.id, a])).values())
    const blockers: string[] = []
    if (input.stage === 'vocabulary') blockers.push('stage_vocabulary_locked')
    if (!input.readingSupported) blockers.push('automatic_reading_executor_unavailable')
    if (input.availableSeconds === null) blockers.push('remaining_budget_unknown')
    else if (p.estimatedMinutes * 60 > input.availableSeconds) blockers.push('does_not_fit_remaining_budget')
    if (previous === null) blockers.push('attempt_history_unknown')
    else if (previous.length) {
      if (entry.repeatPolicy.kind === 'never_same_version') blockers.push('same_version_repeat_disallowed')
      if (entry.repeatPolicy.kind === 'after_cooldown' && input.now - Math.max(...previous.map((a) => a.occurredAt)) < entry.repeatPolicy.seconds * 1000) {
        blockers.push('repeat_cooldown')
      }
    }
    if (input.purpose === 'execution' && blockers.length) continue
    const core = unique((p.vocabulary ?? []).filter((v) => v.core).map((v) => surface(v.surface)).filter(Boolean))
    const observed = core.filter((key) => words.has(key))
    const denominator = core.length || null
    items.push({
      contentId: p.id, contentVersion: p.version, providerRef: entry.providerRef,
      estimatedMinutes: p.estimatedMinutes, estimateBasis: entry.estimateBasis,
      core: {
        denominator,
        observedExposure: denominator === null ? null : observed.length,
        recentExposure14: denominator === null ? null : observed.filter((key) => (words.get(key)?.lastObservedAt ?? 0) >= input.recentSince).length,
        recentSpellingErrorOverlap: denominator === null ? null : observed.filter((key) => words.get(key)?.recentError).length,
        unobserved: denominator === null ? null : core.length - observed.length,
        matching: 'exact_surface',
      },
      previousAttempts: previous?.length ?? null,
      questionTags: unique(p.questions.flatMap((q) => q.tags ?? [])).slice(0, 8),
      executableNow: blockers.length === 0, blockers,
      uncertainties: ['exposure_is_not_reading_ability', 'duration_is_provider_estimate', ...(denominator === null ? ['core_annotation_unavailable'] : [])],
    })
  }
  return { items: items.slice(0, input.limit), eligibleCount: items.length, truncated: items.length > input.limit, order: 'content_id' as const }
}

/** Call with a FRESH trusted eligibility pool at start, not a cached AI snapshot. No side effects. */
export function validateReadingSelection(selection: { contentId: string; contentVersion: string }, freshCandidates: readonly ReadingCandidateContext[]) {
  const item = freshCandidates.find((candidate) => candidate.contentId === selection.contentId && candidate.contentVersion === selection.contentVersion)
  if (!item) return { allowed: false as const, reason: 'content_not_eligible' }
  if (!item.executableNow || item.blockers.length) return { allowed: false as const, reason: 'execution_blocked' }
  return { allowed: true as const, contentId: item.contentId, contentVersion: item.contentVersion }
}

/** This only permits reconsideration. It never changes stage or sends a reminder. */
export function stageReminderStatus(preference: StageReminderPreference | null, now: number, additionalActiveDays: number, complete: boolean) {
  if (!finiteTime(now) || !Number.isInteger(additionalActiveDays) || additionalActiveDays < 0) throw new Error('invalid_reminder_input')
  if (!preference) return 'no_decline_recorded' as const
  if (!finiteTime(preference.declinedAt) || preference.declinedAt > now) return 'suppressed' as const
  if (preference.revisit.kind === 'user_reopens') return 'suppressed' as const
  if (!finiteTime(preference.revisit.notBefore) || !Number.isInteger(preference.revisit.additionalActiveDays) || preference.revisit.additionalActiveDays < 1) return 'suppressed' as const
  if (!complete || now < preference.revisit.notBefore || additionalActiveDays < preference.revisit.additionalActiveDays) return 'suppressed' as const
  return 'may_reconsider' as const
}

/** Validated owner-bound facts in; bounded descriptive evidence out. No I/O or implicit clock. */
export function buildCoachingContext(input: CoachingContextInput) {
  if (!finiteTime(input.now) || !input.snapshotId) throw new Error('invalid_snapshot')
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const calendarDay = (time: number) => {
    const parts = formatter.formatToParts(time)
    const part = (name: string) => Number(parts.find((p) => p.type === name)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY
  }
  const today = calendarDay(input.now)
  const warnings: string[] = []
  const byId = new Map<string, CoachingWordFact>()
  for (const fact of input.wordFacts) {
    if (!fact.id || !surface(fact.word) || !fact.dictionaryId || !finiteTime(fact.occurredAt) || !Number.isInteger(fact.wrongCount) ||
      fact.wrongCount < 0 || typeof fact.reviewMode !== 'boolean') throw new Error('invalid_word_fact')
    const old = byId.get(fact.id)
    if (old && (old.word !== fact.word || old.dictionaryId !== fact.dictionaryId || old.occurredAt !== fact.occurredAt ||
      old.wrongCount !== fact.wrongCount || old.reviewMode !== fact.reviewMode)) throw new Error('conflicting_fact_uuid')
    byId.set(fact.id, fact)
  }
  const facts = Array.from(byId.values()).filter((fact) => {
    if (fact.occurredAt <= input.now) return true
    warnings.push('future_fact_excluded')
    return false
  }).sort((a, b) => a.occurredAt - b.occurredAt || compare(a.id, b.id))
  const since7 = today - 6
  const since14 = today - 13
  const recent7 = facts.filter((f) => calendarDay(f.occurredAt) >= since7)
  const recent14 = facts.filter((f) => calendarDay(f.occurredAt) >= since14)
  const groups = new Map<string, CoachingWordFact[]>()
  facts.forEach((fact) => { const key = surface(fact.word); const group = groups.get(key) ?? []; group.push(fact); groups.set(key, group) })
  const firstIds = new Set(Array.from(groups.values(), (group) => group[0].id))
  const errorWords = unique(recent14.filter((fact) => fact.wrongCount > 0).map((fact) => surface(fact.word)))
  const errorSet = new Set(errorWords)
  const words = Array.from(groups, ([key, group]) => ({ surface: key, lastObservedAt: group[group.length - 1].occurredAt, recentError: errorSet.has(key) }))
  let recentSince = input.now
  let low = Math.max(0, input.now - 15 * DAY)
  while (low < recentSince) {
    const mid = Math.floor((low + recentSince) / 2)
    if (calendarDay(mid) < since14) low = mid + 1
    else recentSince = mid
  }
  const coverage = input.coverage
  const complete = coverage.historyCompleteness === 'complete' && !coverage.wordHistoryTruncated && !coverage.localOnlyPossible
  if (!complete) warnings.push('visible_history_is_not_all_learning')
  if (!facts.length) warnings.push('evidence_sparse')
  const learningEvidence = buildLearningEvidenceV1({
    today,
    calendarDay,
    facts,
    firstFactIds: firstIds,
    completeVisibleHistory: complete,
  })
  const intents = [...input.intents].filter((intent) => intent.effectiveFrom <= input.now && (intent.expiresAt === null || input.now < intent.expiresAt))
    .sort((a, b) => ['ongoing', 'day', 'session'].indexOf(a.scope) - ['ongoing', 'day', 'session'].indexOf(b.scope))
  if (intents.some((i) => i.scope !== 'ongoing' && i.expiresAt === null) || new Set(intents.map((i) => i.scope)).size !== intents.length) {
    throw new Error('invalid_intent_scopes')
  }
  const reading = input.reading ? buildReadingCandidates({ ...input.reading, now: input.now, recentSince, stage: input.stage.current, words }) : null
  const declinedAt = input.reminder?.declinedAt
  const extraDays = declinedAt === undefined ? 0 : new Set(facts.filter((f) => f.occurredAt > declinedAt).map((f) => calendarDay(f.occurredAt))).size
  return {
    schemaVersion: 1 as const,
    snapshot: { id: input.snapshotId, generatedAt: input.now, timezone: input.timezone, algorithmVersion: 'coaching-v1' as const,
      coverageQuality: facts.length === 0 ? 'sparse' : complete ? 'complete_visible_history' : 'partial', warnings: unique(warnings) },
    preferences: {
      exam: { type: '考研英语一', targetYear: 2027, date: null },
      learningStage: input.stage,
      stageReminder: { preference: input.reminder, status: stageReminderStatus(input.reminder, input.now, extraDays, complete) },
      vocabularyRoute: { desiredSource: '红宝书', providerStatus: input.vocabularyProvider.status, providerRef: input.vocabularyProvider.ref, observedProgress: null },
      currentIntent: intents,
    },
    derived: {
      recentLearning: {
        activityBasis: 'word_attempted', activeDays7: new Set(recent7.map((f) => calendarDay(f.occurredAt))).size,
        activeDays14: new Set(recent14.map((f) => calendarDay(f.occurredAt))).size,
        wordAttempts7: recent7.length, firstObservedWords7: recent7.filter((f) => firstIds.has(f.id)).length,
        reviewModeAttempts7: recent7.filter((f) => f.reviewMode).length,
        repeatedExposureAttempts7: recent7.filter((f) => !firstIds.has(f.id)).length,
        recentSpellingErrorWordCount: errorWords.length, interruptions: null,
      },
      learningEvidence,
      reviewPressure: { scheduledDueCount: null, basis: 'not_measured' },
      readingCandidates: reading,
    },
    dataCoverage: { ...coverage },
    executionCapabilities: { vocabulary: true, reading: input.reading?.readingSupported ?? false },
    evidence: {
      window: { through: input.now, calendarDays: 14, timezone: input.timezone },
      refs: [{ id: `${input.snapshotId}:word_attempted:visible-history`, kind: 'derived_query', algorithmVersion: 'coaching-v1', eventType: 'word_attempted', since: coverage.historyFrom, through: input.now }, { id: `${input.snapshotId}:word_attempted:14d`, kind: 'derived_query', algorithmVersion: 'coaching-v1', eventType: 'word_attempted', since: recentSince, through: input.now }],
      sampleFactIds: recent14.slice(-6).map((f) => f.id),
      samplesAreExhaustive: recent14.length <= 6,
    },
    uncertainty: ['spelling_evidence_is_not_semantic_mastery', 'unobserved_is_not_unknown', 'duration_is_not_recall_latency',
      'review_due_and_interruptions_not_measured', 'reading_exposure_is_not_reading_ability'],
  }
}

export type CoachingContext = ReturnType<typeof buildCoachingContext>
