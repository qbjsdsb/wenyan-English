import type { ReadingPassage } from '../reading/types'
import type { AttemptEvidence, SessionConstraints } from '../smart-session/types'

export type LearningStage = 'vocabulary' | 'mixed' | 'exam_practice'
/** Owner-scoped, validated projection of word_attempted. Never accepted from Coach writes. */
export interface CoachingWordFact extends AttemptEvidence {
  word: string
  dictionaryId: string
  reviewMode: boolean
}
export interface StagePreference {
  current: LearningStage
  revision: number
  provenance: { kind: 'product_default' | 'user_confirmation'; ref: string; since: number | null }
}
export interface IntentReference {
  id: string
  revision: number
  scope: 'ongoing' | 'day' | 'session'
  effectiveFrom: number
  expiresAt: number | null
  constraints: SessionConstraints
}
export interface StageReminderPreference {
  target: LearningStage
  declinedAt: number
  provenanceRef: string
  revisit: { kind: 'user_reopens' } | { kind: 'after'; notBefore: number; additionalActiveDays: number }
}
export interface ReadingCatalogEntry {
  passage: ReadingPassage
  providerRef: string
  currentVersion: string
  loadable: boolean
  contentComplete: boolean
  answersVerified: boolean
  estimateBasis: string
  repeatPolicy: { kind: 'never_same_version' | 'allowed' } | { kind: 'after_cooldown'; seconds: number }
  /** null is unknown, [] is an explicitly complete observed attempt history. */
  completedAttempts: readonly { id: string; occurredAt: number; version: string }[] | null
}
export interface WordObservation {
  surface: string
  lastObservedAt: number
  recentError: boolean
}
export interface ReadingCandidateContext {
  contentId: string
  contentVersion: string
  providerRef: string
  estimatedMinutes: number
  estimateBasis: string
  core: {
    denominator: number | null
    observedExposure: number | null
    recentExposure14: number | null
    recentSpellingErrorOverlap: number | null
    unobserved: number | null
    matching: 'exact_surface'
  }
  previousAttempts: number | null
  questionTags: string[]
  executableNow: boolean
  blockers: string[]
  uncertainties: string[]
}
export interface ReadingCandidateInput {
  now: number
  recentSince: number
  stage: LearningStage
  readingSupported: boolean
  /** Net atomic-activity budget, after reserve/break/hard-stop; null means unavailable. */
  availableSeconds: number | null
  purpose: 'execution' | 'stage_assessment'
  limit: number
  words: readonly WordObservation[]
  catalog: readonly ReadingCatalogEntry[]
}
export interface CoachingContextInput {
  now: number
  snapshotId: string
  timezone: string
  wordFacts: readonly CoachingWordFact[]
  coverage: {
    historyCompleteness: 'complete' | 'partial' | 'unknown'
    historyFrom: number | null
    cloudReceivedThrough: number | null
    localOnlyPossible: boolean
    wordHistoryTruncated: boolean
  }
  stage: StagePreference
  vocabularyProvider: { status: 'available' | 'unavailable'; ref: string | null }
  intents: readonly IntentReference[]
  reminder: StageReminderPreference | null
  reading?: Omit<ReadingCandidateInput, 'now' | 'recentSince' | 'stage' | 'words'>
}
