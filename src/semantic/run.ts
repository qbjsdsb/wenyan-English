import type { SmartSessionRuntime } from '../smart-session/runtime'
import type { SemanticDiscriminationQuestion } from './discrimination'
import type { SemanticItem } from './core'

export interface SemanticRun {
  id: string
  /** Existing rows omit mode and are recall runs. */
  mode?: 'recall' | 'discrimination'
  /** Legacy rows remain Smart-compatible. Manual work never acquires Smart constraints. */
  origin?: 'manual'
  practiceChoices?: { pool: 'chapter' | 'learned' | 'errors' | 'uncertain'; limit: 6 | 12 }
  sessionCheckpoint?: SmartSessionRuntime
  ownerUserId?: string
  sessionId: string
  dictionaryId: string
  startedAt: number
  hardStopAt?: number
  items: SemanticItem[]
  discriminationQuestions?: SemanticDiscriminationQuestion[]
  index: number
  revealedIndex?: number
  completedAt?: number
  endedAt?: number
}
