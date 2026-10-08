import type { Candidate, Purpose, SmartSessionDraft, SmartSessionInput, VocabularyCandidate } from './types'

const DAY = 86_400_000
const RECENT_PRACTICE_COOLDOWN = 20 * 60_000
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const finite = (n: number) => Number.isFinite(n) && n >= 0

/** No I/O, random state, wall clock, or mutation of the caller's data. One block is the commitment horizon. */
export function buildSmartSession(input: SmartSessionInput): SmartSessionDraft {
  const { constraints: c, progress: p } = input
  const numbers = [input.now, input.newItemsToday, p.completedBlocks, p.newItemsIntroduced, p.activeSeconds, p.elapsedSeconds, p.activeSecondsSinceBreak]
  const optional = [c.targetMinutes, c.hardStopMinutes, c.newWordCeiling, input.lastActivityAt]
  if (!numbers.every(finite) || !optional.every((n) => n === undefined || finite(n))) throw new Error('Invalid planner numbers')
  if ((c.targetMinutes ?? 0) > 240 || (c.hardStopMinutes ?? 0) > 240 || (c.newWordCeiling ?? 0) > 50) {
    throw new Error('Constraint exceeds planner bounds')
  }
  if (![input.newItemsToday, p.completedBlocks, p.newItemsIntroduced, c.newWordCeiling ?? 0].every(Number.isInteger)) {
    throw new Error('Counts must be integers')
  }
  if (input.lastActivityAt !== undefined && input.lastActivityAt > input.now) throw new Error('Future activity timestamp')
  const warnings = input.coverage === 'complete' ? [] : ['History coverage is incomplete; unseen means unobserved, not unknown to the learner.']
  if (p.timingQuality === 'estimated') warnings.push('Session time is an estimate, not measured active learning time.')
  const result: SmartSessionDraft = {
    algorithmVersion: 'elastic-v2',
    snapshotId: input.snapshotId,
    blocks: [],
    estimatedSeconds: 0,
    disposition: 'finish',
    reason: 'no_eligible_content',
    deferred: [],
    warnings,
    availability: {
      status: 'not_evaluated',
      reviewEligibleCount: 0,
      weakEligibleCount: 0,
      correctionEligibleCount: 0,
      correctionCooldownCount: 0,
      newEligibleCount: 0,
      newWordCapacity: 0,
      readingEligibleCount: 0,
    },
  }

  // Merge duplicate canonical words, union evidence UUIDs, and choose a stable focus-book content locator.
  const grouped = new Map<string, Candidate>()
  const eventOwners = new Map<string, string>()
  const sorted = [...input.candidates].sort((a, b) => {
    const focus = (x: Candidate) => (x.kind === 'vocabulary' && x.dictionaryId === c.focusDictionary ? 0 : 1)
    return compare(a.key, b.key) || focus(a) - focus(b) || compare(a.contentId, b.contentId)
  })
  sorted.forEach((item) => {
    if (!item.key || !item.contentId || !finite(item.estimatedSeconds) || item.estimatedSeconds === 0) throw new Error('Invalid candidate')
    if (item.kind === 'reading' && !finite(item.recommendationRank)) throw new Error('Invalid reading rank')
    if (item.kind === 'vocabulary') {
      if (!finite(item.ordinal) || !Number.isInteger(item.ordinal)) throw new Error('Invalid vocabulary ordinal')
      item.attempts.forEach((a) => {
        if (!a.id || !finite(a.occurredAt) || a.occurredAt > input.now || !finite(a.wrongCount) || !Number.isInteger(a.wrongCount)) {
          throw new Error('Invalid attempt evidence')
        }
        const owner = eventOwners.get(a.id)
        if (owner && owner !== item.key) throw new Error('Evidence UUID belongs to multiple items')
        eventOwners.set(a.id, item.key)
      })
      if (item.schedule && (!finite(item.schedule.dueAt) || !item.schedule.algorithmVersion || !item.schedule.evidenceRefs.length)) {
        throw new Error('Invalid derived schedule')
      }
    }
    const existing = grouped.get(item.key)
    if (existing && (existing.kind !== item.kind || item.kind === 'reading')) throw new Error('Conflicting canonical item')
    if (item.kind === 'vocabulary') {
      const prior = existing as VocabularyCandidate | undefined
      if (prior && JSON.stringify(prior.schedule) !== JSON.stringify(item.schedule)) throw new Error('Conflicting derived schedules')
      const attempts = new Map<string, (typeof item.attempts)[number]>()
      ;[...(prior?.attempts ?? []), ...item.attempts].forEach((a) => {
        const previous = attempts.get(a.id)
        if (previous && (previous.occurredAt !== a.occurredAt || previous.wrongCount !== a.wrongCount)) {
          throw new Error('Conflicting immutable evidence')
        }
        attempts.set(a.id, { ...a })
      })
      grouped.set(item.key, {
        ...(prior ?? item),
        estimatedSeconds: Math.max(prior?.estimatedSeconds ?? 0, item.estimatedSeconds),
        attempts: Array.from(attempts.values()).sort((a, b) => a.occurredAt - b.occurredAt || compare(a.id, b.id)),
      })
    } else grouped.set(item.key, { ...item, evidenceRefs: [...item.evidenceRefs] })
  })
  const items = Array.from(grouped.values())
  const finish = (reason: string, disposition: 'finish' | 'break' = 'finish') => {
    result.reason = reason
    result.disposition = disposition
    result.deferred = items.map((item) => ({ key: item.key, reason }))
    return result
  }
  const remaining = Math.min(
    c.targetMinutes === undefined ? Infinity : c.targetMinutes * 60 - p.activeSeconds,
    c.hardStopMinutes === undefined ? Infinity : c.hardStopMinutes * 60 - p.elapsedSeconds,
  )
  if (remaining <= 60) return finish('budget_reached')
  if (p.activeSecondsSinceBreak >= 25 * 60) return finish('natural_break', 'break')

  const blockSeconds = Math.min(c.intensity === 'gentle' ? 240 : 360, remaining - 60)
  const horizon = Math.min(c.targetMinutes ?? Infinity, c.hardStopMinutes ?? Infinity)
  const sessionCeiling = horizon <= 12 ? 3 : horizon <= 30 ? 8 : 20
  const seen = new Set(p.attemptedKeys)
  type Ranked = { item: Candidate; purpose: Purpose; score: number; refs: string[]; reason: string }
  const eligible: Ranked[] = []
  const deferred = new Map<string, string>()
  let nextCorrectionRetryAt: number | undefined
  let correctionCooldownCount = 0
  items.forEach((item) => {
    if (!input.availableActivities.includes(item.kind)) return void deferred.set(item.key, 'unsupported_activity')
    if (seen.has(item.key)) return void deferred.set(item.key, 'already_attempted_in_session')
    if (item.kind === 'reading') {
      eligible.push({ item, purpose: 'reading', score: -item.recommendationRank, refs: [...item.evidenceRefs], reason: item.reason })
      return
    }
    const last = item.attempts[item.attempts.length - 1]
    if (!last) {
      if (c.focusDictionary && item.dictionaryId !== c.focusDictionary) return void deferred.set(item.key, 'outside_new_word_focus')
      eligible.push({ item, purpose: 'new', score: -item.ordinal, refs: [], reason: 'no_observed_exposure_in_current_history' })
      return
    }

    const recent = item.attempts.filter((a) => input.now - a.occurredAt <= 14 * DAY).slice(-3)
    const errors = recent.filter((a) => a.wrongCount > 0).length
    const latestErrorNeedsCorrection = last.wrongCount > 0 && input.now - last.occurredAt < DAY
    const needsCorrectionAfterCooldown = latestErrorNeedsCorrection || errors >= 2
    if (input.now - last.occurredAt < RECENT_PRACTICE_COOLDOWN) {
      deferred.set(item.key, 'recent_practice_cooldown')
      if (needsCorrectionAfterCooldown) {
        correctionCooldownCount += 1
        const retryAt = last.occurredAt + RECENT_PRACTICE_COOLDOWN
        nextCorrectionRetryAt = nextCorrectionRetryAt === undefined ? retryAt : Math.min(nextCorrectionRetryAt, retryAt)
      }
      return
    }

    const due = item.schedule?.dueAt ?? last.occurredAt + (last.wrongCount > 0 ? DAY : 3 * DAY)
    const purpose: Purpose | undefined = errors >= 2
      ? 'weak'
      : latestErrorNeedsCorrection
        ? 'correction'
        : due <= input.now
          ? 'review'
          : undefined
    if (!purpose) return void deferred.set(item.key, 'not_due_and_no_recent_spelling_error')
    const score = Math.min(7, Math.max(0, (input.now - due) / DAY)) + errors * 2 + last.wrongCount + (item.dictionaryId === c.focusDictionary ? 1 : 0)
    const refs = Array.from(new Set([...recent.map((a) => a.id), last.id, ...(item.schedule?.evidenceRefs ?? [])])).sort(compare)
    const reason = purpose === 'weak'
      ? 'repeated_recent_spelling_errors'
      : purpose === 'correction'
        ? 'recent_spelling_error_needs_correction'
        : item.schedule
          ? 'scheduler_due'
          : 'heuristic_revisit_window'
    eligible.push({ item, purpose, score, refs, reason })
  })
  const reviewSeconds = eligible.filter((x) => x.purpose === 'review' || x.purpose === 'correction' || x.purpose === 'weak')
    .reduce((n, x) => n + x.item.estimatedSeconds, 0)
  const pressure = reviewSeconds > 2 * blockSeconds
  const returning = input.lastActivityAt !== undefined && input.now - input.lastActivityAt >= 3 * DAY
  const dailyCeiling = Math.min(c.newWordCeiling ?? (c.intensity === 'gentle' ? 8 : 20), pressure || returning ? 5 : Infinity)
  let newSlots = Math.max(0, Math.min(dailyCeiling - input.newItemsToday, sessionCeiling - p.newItemsIntroduced))
  result.availability = {
    status: 'evaluated',
    reviewEligibleCount: eligible.filter((x) => x.purpose === 'review').length,
    weakEligibleCount: eligible.filter((x) => x.purpose === 'weak').length,
    correctionEligibleCount: eligible.filter((x) => x.purpose === 'correction').length,
    correctionCooldownCount,
    newEligibleCount: eligible.filter((x) => x.purpose === 'new').length,
    newWordCapacity: newSlots,
    readingEligibleCount: eligible.filter((x) => x.purpose === 'reading').length,
  }
  const pattern: Purpose[] = horizon <= 12 ? ['review', 'weak', 'new'] : horizon <= 30 ? ['review', 'new', 'weak', 'review'] : horizon <= 60 ? ['review', 'new', 'reading', 'weak', 'review'] : ['review', 'new', 'weak', 'reading', 'review']
  if (c.reviewPreference === 'review_first') pattern.splice(1, 0, 'weak')
  let preferred = pattern[p.completedBlocks % pattern.length]
  if (p.completedBlocks > 0 && c.preferredActivities?.includes('reading')) preferred = 'reading'
  const order = Array.from(new Set([preferred, 'weak', 'correction', 'review', 'new', 'reading'] as Purpose[]))
  const ranked = [...eligible].sort((a, b) => order.indexOf(a.purpose) - order.indexOf(b.purpose) || b.score - a.score || compare(a.item.key, b.item.key))
  let purpose: Purpose | undefined
  const selected: Ranked[] = []
  let total = 0
  ranked.forEach((entry) => {
    if (entry.purpose === 'new' && newSlots <= 0) return void deferred.set(entry.item.key, 'new_word_ceiling')
    if (purpose && purpose !== entry.purpose) return void deferred.set(entry.item.key, 'next_block_reconsider')
    // Reading is atomic and may exceed a vocabulary block, but never the remaining session budget.
    const capacity = entry.purpose === 'reading' ? Math.min(25 * 60 - p.activeSecondsSinceBreak, remaining - 60) : blockSeconds
    if ((entry.purpose === 'reading' && selected.length > 0) || total + entry.item.estimatedSeconds > capacity) {
      return void deferred.set(entry.item.key, 'does_not_fit_block_or_budget')
    }
    purpose = entry.purpose
    selected.push(entry)
    total += entry.item.estimatedSeconds
    if (entry.purpose === 'new') newSlots--
  })
  if (selected.length && purpose) {
    result.blocks = [{
      purpose,
      activity: {
        kind: selected[0].item.kind,
        items: selected.map((x) => ({ key: x.item.key, contentId: x.item.contentId, reason: x.reason, evidenceRefs: x.refs, estimatedSeconds: x.item.estimatedSeconds })),
      },
      estimatedSeconds: total,
    }]
    result.disposition = 'continue'
    result.reason = pressure ? 'bounded_review_pressure' : returning ? 'gentle_return' : 'next_useful_block'
    result.estimatedSeconds = total
  } else {
    const reasons = new Set(deferred.values())
    const newWordsBlocked = reasons.has('new_word_ceiling')
    if (nextCorrectionRetryAt !== undefined) {
      result.retryAt = nextCorrectionRetryAt
      result.reason = newWordsBlocked ? 'review_only_waiting_for_correction_cooldown' : 'waiting_for_correction_cooldown'
    } else if (newWordsBlocked) {
      result.reason = 'new_word_ceiling_no_review'
    } else if (reasons.has('not_due_and_no_recent_spelling_error')) {
      result.reason = 'nothing_due_yet'
    }
  }
  result.deferred = Array.from(deferred, ([key, reason]) => ({ key, reason })).sort((a, b) => compare(a.key, b.key))
  return result
}
