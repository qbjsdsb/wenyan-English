export type ReadingQuestionType = 'single_choice'

export interface ReadingSource {
  kind: 'wenyan-original' | 'private-import' | 'public-domain'
  label: string
  reference?: string
}

export interface ReadingOption {
  id: string
  text: string
}

export interface ReadingQuestion {
  id: string
  type: ReadingQuestionType
  stem: string
  options: readonly ReadingOption[]
  correctOptionId: string
  explanation?: string
  tags?: readonly string[]
}

export interface ReadingVocabularyHint {
  surface: string
  lemma: string
  core?: boolean
}

export interface ReadingPassage {
  id: string
  version: string
  title: string
  source: ReadingSource
  paragraphs: readonly string[]
  estimatedMinutes: number
  questions: readonly ReadingQuestion[]
  vocabulary?: readonly ReadingVocabularyHint[]
  /** Demo / smoke-test content is never eligible for automatic exam recommendation. */
  recommendationEligible: boolean
}

export interface ReadingAnswerDraft {
  questionId: string
  selectedOptionId?: string
  answerChangeCount: number
}

export interface ReadingAttemptSummary {
  attemptId: string
  passageId: string
  passageVersion: string
  durationMs: number
  questionCount: number
  answeredCount: number
  correctCount: number
}
