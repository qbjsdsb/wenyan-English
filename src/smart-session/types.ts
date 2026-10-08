/** Pure planning data; never a learning-event write contract. Times are milliseconds unless named otherwise. */
export type ActivityKind = 'semantic_recall' | 'vocabulary' | 'reading' | 'dictation' | 'cloze' | 'translation' | 'writing' | 'grammar' | 'long_sentence' | 'new_question_type'
export type Purpose = 'semantic_recall' | 'review' | 'correction' | 'weak' | 'new' | 'reading'
export interface SessionConstraints {
  focusDictionary?: string
  targetMinutes?: number
  hardStopMinutes?: number
  newWordCeiling?: number
  reviewPreference?: 'balanced' | 'review_first'
  intensity?: 'gentle' | 'normal'
  preferredActivities?: readonly ActivityKind[]
}
export interface AttemptEvidence {
  id: string
  occurredAt: number
  wrongCount: number
}
export interface VocabularyCandidate {
  kind: 'vocabulary'
  /** Ability + exact normalized surface. Shared across dictionaries, not across abilities or inflections. */
  key: string
  contentId: string
  dictionaryId: string
  ordinal: number
  /** Spelling evidence only. Adapter preserves raw practice conditions separately. */
  attempts: readonly AttemptEvidence[]
  estimatedSeconds: number
  /** Derived scheduler output, not an AI assertion. */
  schedule?: { dueAt: number; algorithmVersion: string; evidenceRefs: readonly string[] }
}
export interface ReadingCandidate {
  kind: 'reading'
  key: string
  contentId: string
  estimatedSeconds: number
  /** Stable ordering from the future goal-aware recommender, not coverage alone. Lower is better. */
  recommendationRank: number
  reason: string
  evidenceRefs: readonly string[]
}
export interface SemanticCandidate {
  kind: 'semantic_recall'
  key: string
  contentId: string
  estimatedSeconds: number
  /** Candidate adapter has required an actual prior spelling observation and a valid reference. */
  lastAttemptAt?: number
  lastRating?: 'recalled' | 'partial' | 'not_recalled'
  evidenceRefs: readonly string[]
}
export type Candidate = VocabularyCandidate | ReadingCandidate | SemanticCandidate
export interface SessionProgress {
  /** Actual attempted keys, including partial blocks. Draft selection never enters this list. */
  attemptedKeys: readonly string[]
  completedBlocks: number
  newItemsIntroduced: number
  activeSeconds: number
  elapsedSeconds: number
  activeSecondsSinceBreak: number
  timingQuality: 'measured' | 'estimated'
}
export interface SmartSessionInput {
  now: number
  snapshotId: string
  constraints: SessionConstraints
  candidates: readonly Candidate[]
  availableActivities: readonly ActivityKind[]
  progress: SessionProgress
  /** Trusted adapter count for the user's calendar day, including this session. */
  newItemsToday: number
  lastActivityAt?: number
  coverage: 'complete' | 'partial' | 'unknown'
}
export interface SelectedItem {
  key: string
  contentId: string
  reason: string
  evidenceRefs: string[]
  estimatedSeconds: number
}
export interface SessionBlock {
  purpose: Purpose
  activity: { kind: 'vocabulary' | 'reading' | 'semantic_recall'; items: SelectedItem[] }
  estimatedSeconds: number
}
/** Ephemeral planner state. These counts describe what can execute now; they are not learning evidence or mastery. */
export interface ExecutionAvailability {
  status: 'evaluated' | 'not_evaluated'
  reviewEligibleCount: number
  weakEligibleCount: number
  correctionEligibleCount: number
  correctionCooldownCount: number
  newEligibleCount: number
  newWordCapacity: number
  semanticEligibleCount?: number
  readingEligibleCount: number
}
export interface SmartSessionDraft {
  algorithmVersion: 'elastic-v2'
  snapshotId: string
  blocks: SessionBlock[]
  estimatedSeconds: number
  disposition: 'continue' | 'break' | 'finish'
  reason: string
  /** Earliest safe retry for a currently cooling-down correction candidate. */
  retryAt?: number
  deferred: { key: string; reason: string }[]
  warnings: string[]
  /** Deterministic executor visibility only; never reinterpret these counts as mastery. */
  availability: ExecutionAvailability
}
