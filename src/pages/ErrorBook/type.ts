import type { SpellingAttemptRecord } from '@/learning/spellingEvidence'

export type groupedWordRecords = {
  word: string
  dict: string
  records: SpellingAttemptRecord[]
  wrongCount: number
  latestOccurredAt: number
}
