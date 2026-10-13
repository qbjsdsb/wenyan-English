/** Pure, deterministic reading evidence. No content provider, storage, clock or model dependency. */
export interface ReadingEvidenceEvent {
  id: string
  ownerUserId?: string
  eventType: string
  sourceVersion?: number
  occurredAt: number
  payload: unknown
}

export interface ReadingEvidenceInput {
  ownerUserId: string | undefined
  events: readonly ReadingEvidenceEvent[]
  snapshotId: string
  window: { since: number; through: number; timezone: string }
  coverage: {
    /** Only coverage of this owner-scoped event query, never all learning. */
    queryCompleteness: 'complete' | 'partial' | 'unknown'
    inputTruncated: boolean
    localOnlyPossible: boolean
    receivedThrough: number | null
    queryRef: string
  }
}

type Completion = {
  attemptId: string; passageId: string; passageVersion: string; sourceKind: string
  durationMs: number; questionCount: number; answeredCount: number; correctCount: number
}
type Question = {
  attemptId: string; passageId: string; passageVersion: string; questionId: string
  selectedOptionId: string | null; correctOptionId: string; answered: boolean
  isCorrect: boolean | null; answerChangeCount: number
}
type Parsed = { id: string; occurredAt: number } & ({ kind: 'completion'; value: Completion } | { kind: 'question'; value: Question })
const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

function parse(event: ReadingEvidenceEvent): Parsed | undefined {
  if (!identifier(event.id) || event.sourceVersion !== 3 || !count(event.occurredAt)) return undefined
  const p = record(event.payload)
  if (!p || !identifier(p.attemptId) || !identifier(p.passageId) || !identifier(p.passageVersion)) return undefined
  const shared = { attemptId: p.attemptId, passageId: p.passageId, passageVersion: p.passageVersion }
  if (event.eventType === 'reading_completed') {
    if (!count(p.durationMs) || !count(p.questionCount) || !p.questionCount || p.questionCount > 200 ||
      !count(p.answeredCount) || !count(p.correctCount) || p.correctCount > p.answeredCount || p.answeredCount > p.questionCount ||
      !['wenyan-original', 'private-import', 'public-domain'].includes(String(p.sourceKind))) return undefined
    return { id: event.id, occurredAt: event.occurredAt, kind: 'completion', value: { ...shared,
      sourceKind: String(p.sourceKind), durationMs: p.durationMs, questionCount: p.questionCount,
      answeredCount: p.answeredCount, correctCount: p.correctCount } }
  }
  if (event.eventType !== 'question_attempted' || p.questionType !== 'single_choice' || !identifier(p.questionId) ||
    !identifier(p.correctOptionId) || !(p.selectedOptionId === null || identifier(p.selectedOptionId)) || !count(p.answerChangeCount) ||
    p.answered !== (p.selectedOptionId !== null) || p.isCorrect !== (p.selectedOptionId === null ? null : p.selectedOptionId === p.correctOptionId)) return undefined
  return { id: event.id, occurredAt: event.occurredAt, kind: 'question', value: { ...shared, questionId: p.questionId,
    selectedOptionId: p.selectedOptionId, correctOptionId: p.correctOptionId, answered: p.answered as boolean,
    isCorrect: p.isCorrect as boolean | null, answerChangeCount: p.answerChangeCount } }
}

/** Completion time selects the window. Associated question rows may predate its lower boundary. */
export function buildReadingEvidence(input: ReadingEvidenceInput) {
  const { since, through, timezone } = input.window
  if (!count(since) || !count(through) || since > through || !identifier(input.snapshotId) || !identifier(input.coverage.queryRef) ||
    !['complete', 'partial', 'unknown'].includes(input.coverage.queryCompleteness) || typeof input.coverage.inputTruncated !== 'boolean' ||
    typeof input.coverage.localOnlyPossible !== 'boolean' || !(input.coverage.receivedThrough === null || count(input.coverage.receivedThrough)) ||
    input.events.length > 20000) throw new Error('invalid_reading_evidence_input')
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(through) } catch { throw new Error('invalid_reading_evidence_timezone') }
  const byId = new Map<string, Parsed>()
  const blocked = new Set<string>()
  let invalidRows = 0
  let futureRows = 0
  let duplicateRows = 0
  for (const event of input.events) {
    if (event.ownerUserId !== input.ownerUserId) throw new Error('reading_evidence_owner_mismatch')
    if (!['reading_completed', 'question_attempted'].includes(event.eventType)) continue
    if (count(event.occurredAt) && event.occurredAt > through) { futureRows++; continue }
    const parsed = parse(event)
    if (!parsed) {
      invalidRows++
      const attemptId = record(event.payload)?.attemptId
      if (identifier(attemptId)) blocked.add(attemptId)
      continue
    }
    const previous = byId.get(parsed.id)
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(parsed)) throw new Error('conflicting_reading_fact_uuid')
      duplicateRows++
    } else byId.set(parsed.id, parsed)
  }
  const groups = new Map<string, Parsed[]>()
  for (const event of Array.from(byId.values())) {
    const group = groups.get(event.value.attemptId) ?? []
    group.push(event)
    groups.set(event.value.attemptId, group)
  }
  const reconciled: Array<{
    attemptId: string; passageId: string; passageVersion: string; sourceKind: string; occurredAt: number
    questions: number; answered: number; unanswered: number; correct: number; incorrect: number
    changedAnswerQuestions: number; answerChanges: number; wallClockDurationMs: number
    completionRef: string; questionRefSample: string[]; questionRefsOmitted: number
  }> = []
  let observedCompletionRows = 0
  let incompleteAttempts = 0
  let rejectedAttempts = 0
  let orphanQuestionRows = 0
  for (const [attemptId, group] of Array.from(groups.entries())) {
    const completions = group.filter((event): event is Parsed & { kind: 'completion' } => event.kind === 'completion')
    const selected = completions.filter((event) => event.occurredAt >= since)
    observedCompletionRows += selected.length
    if (!completions.length) { orphanQuestionRows += group.filter((event) => event.occurredAt >= since).length; continue }
    if (!selected.length) continue
    if (completions.length !== 1 || blocked.has(attemptId)) { rejectedAttempts++; continue }
    const completion = selected[0]
    const p = completion.value
    const questions = group.filter((event): event is Parsed & { kind: 'question' } => event.kind === 'question')
    const ids = new Set(questions.map((event) => event.value.questionId))
    if (ids.size !== questions.length || questions.length > p.questionCount || questions.some((event) =>
      event.occurredAt > completion.occurredAt || event.value.passageId !== p.passageId || event.value.passageVersion !== p.passageVersion)) {
      rejectedAttempts++; continue
    }
    if (questions.length < p.questionCount) { incompleteAttempts++; continue }
    const answered = questions.filter((event) => event.value.answered).length
    const correct = questions.filter((event) => event.value.isCorrect === true).length
    if (answered !== p.answeredCount || correct !== p.correctCount) { rejectedAttempts++; continue }
    const refs = questions.map((event) => event.id).sort(compare)
    const answerChanges = questions.reduce((sum, event) => sum + event.value.answerChangeCount, 0)
    if (!Number.isSafeInteger(answerChanges)) throw new Error('reading_evidence_count_overflow')
    reconciled.push({ attemptId, passageId: p.passageId, passageVersion: p.passageVersion, sourceKind: p.sourceKind,
      occurredAt: completion.occurredAt, questions: p.questionCount, answered, unanswered: p.questionCount - answered,
      correct, incorrect: answered - correct, changedAnswerQuestions: questions.filter((event) => event.value.answerChangeCount > 0).length,
      answerChanges, wallClockDurationMs: p.durationMs, completionRef: completion.id,
      questionRefSample: refs.slice(0, 3), questionRefsOmitted: Math.max(0, refs.length - 3) })
  }
  reconciled.sort((a, b) => b.occurredAt - a.occurredAt || compare(a.attemptId, b.attemptId))
  const sum = (key: 'questions' | 'answered' | 'unanswered' | 'correct' | 'incorrect' | 'answerChanges' | 'changedAnswerQuestions' | 'wallClockDurationMs') => {
    const value = reconciled.reduce((n, attempt) => n + attempt[key], 0)
    if (!Number.isSafeInteger(value)) throw new Error('reading_evidence_count_overflow')
    return value
  }
  const versions = new Set(reconciled.map((attempt) => JSON.stringify([attempt.passageId, attempt.passageVersion])))
  const complete = input.coverage.queryCompleteness === 'complete' && !input.coverage.inputTruncated && !invalidRows && !futureRows &&
    !incompleteAttempts && !rejectedAttempts && !orphanQuestionRows
  return {
    contractVersion: 'reading-evidence-v1' as const,
    activity: 'reading' as const,
    measurement: 'versioned_reference_single_choice' as const,
    snapshotId: input.snapshotId,
    window: { ...input.window, selection: 'completion_occurred_at_inclusive' as const },
    coverage: { ...input.coverage, reconciliation: complete ? 'complete_visible_query' : 'partial_visible_query',
      observedCompletionRows, reconciledAttempts: reconciled.length, incompleteAttempts, rejectedAttempts,
      orphanQuestionRows, invalidRows, futureRows, duplicateRows },
    observations: {
      attempts: reconciled.length, distinctPassages: new Set(reconciled.map((a) => a.passageId)).size,
      distinctPassageVersions: versions.size, repeatAttemptsWithinWindow: reconciled.length - versions.size,
      questions: sum('questions'), answered: sum('answered'), unanswered: sum('unanswered'), correct: sum('correct'), incorrect: sum('incorrect'),
      changedAnswerQuestions: sum('changedAnswerQuestions'), answerChanges: sum('answerChanges'), wallClockDurationMs: sum('wallClockDurationMs'),
    },
    recentAttempts: reconciled.slice(0, 5),
    omittedRecentAttempts: Math.max(0, reconciled.length - 5),
    tagObservations: null,
    evidence: { queryRef: input.coverage.queryRef, refsAreSamples: true, replayAvailable: false },
    uncertainty: [
      'reference_answers_and_content_not_independently_verified',
      'counts_describe_reconciled_visible_attempts_not_mastery_or_all_learning',
      'repeats_are_window_local_not_first_ever_exposure_or_comparable_gain',
      'wall_clock_is_not_active_time_speed_attention_or_per_question_time',
      'answer_changes_do_not_measure_confidence_or_error_cause',
      'provider_tag_provenance_unavailable_no_tag_diagnosis',
    ],
  }
}

export type ReadingEvidence = ReturnType<typeof buildReadingEvidence>
