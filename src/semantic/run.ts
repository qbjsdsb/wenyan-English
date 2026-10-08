import type { SmartSessionRuntime } from '../smart-session/runtime'
import type { SemanticItem } from './core'

export interface SemanticRun {
  id: string
  sessionCheckpoint?: SmartSessionRuntime
  ownerUserId?: string
  sessionId: string
  dictionaryId: string
  startedAt: number
  hardStopAt?: number
  items: SemanticItem[]
  index: number
  revealedIndex?: number
  completedAt?: number
  endedAt?: number
}
