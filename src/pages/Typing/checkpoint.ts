import type { TypingState } from './store/type'
import type { WordWithIndex } from '@/typings'
import { current, isDraft } from 'immer'

/** Mutable, device-local execution state. Never a learning fact or cloud completion. */
export type TypingCheckpointIdentity = {
  id: string
  runId: string
  ownerUserId?: string
  dictId: string
  chapter: number
  taskRunId: string | null
  contentSignature: string
}

export type TypingCheckpoint = TypingCheckpointIdentity & {
  schemaVersion: 1
  updatedAt: number
  state: TypingState
}

export function typingCheckpointId(ownerUserId: string | undefined, dictId: string, chapter: number, taskRunId: string | null) {
  return JSON.stringify([ownerUserId ?? null, dictId, chapter, taskRunId])
}

export function typingContentSignature(words: WordWithIndex[]) {
  return JSON.stringify(
    [...words]
      .sort((a, b) => a.index - b.index)
      .map((word) => [word.index, word.name, word.trans, word.usphone ?? '', word.ukphone ?? '', word.notation ?? '']),
  )
}

/** The same advancement is used by the UI and the atomic persisted boundary. */
export function advanceCommittedWord(state: TypingState, loopTimes: number): TypingState {
  const next = structuredClone(isDraft(state) ? current(state) : state)
  const lastExercise = state.wordExerciseCount >= loopTimes - 1
  next.chapterData.wordCount++
  if (!next.chapterData.completedWordIndexes.includes(state.chapterData.index))
    next.chapterData.completedWordIndexes.push(state.chapterData.index)
  next.isShowSkip = false
  next.isSavingRecord = false
  if (!lastExercise) {
    next.wordExerciseCount++
  } else if (state.chapterData.index >= state.chapterData.words.length - 1) {
    next.isTyping = false
    next.isFinished = true
    next.wordExerciseCount = 0
  } else {
    next.chapterData.index++
    next.wordExerciseCount = 0
  }
  return next
}

export function isValidTypingCheckpoint(value: TypingCheckpoint, words: WordWithIndex[], ownerUserId?: string) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    value.ownerUserId !== ownerUserId ||
    value.contentSignature !== typingContentSignature(words) ||
    !value.runId ||
    !value.state
  )
    return false
  const { state } = value
  const data = state.chapterData
  const count = (n: number) => Number.isSafeInteger(n) && n >= 0
  if (
    !data ||
    !Array.isArray(data.words) ||
    data.words.length !== words.length ||
    words.length === 0 ||
    typingContentSignature(data.words) !== value.contentSignature ||
    new Set(data.words.map((word) => word.index)).size !== words.length ||
    !count(data.index) ||
    data.index >= words.length ||
    !count(data.wordCount) ||
    !count(data.correctCount) ||
    !count(data.wrongCount) ||
    !count(state.wordExerciseCount) ||
    !state.timerData ||
    !count(state.timerData.time) ||
    !Array.isArray(data.wordRecordIds) ||
    data.wordRecordIds.length !== data.wordCount ||
    !data.wordRecordIds.every((id) => count(id) && id > 0) ||
    !Array.isArray(data.userInputLogs) ||
    data.userInputLogs.length !== words.length ||
    !Array.isArray(data.completedWordIndexes) ||
    !data.completedWordIndexes.every((index) => count(index) && index < words.length) ||
    !data.userInputLogs.every((log, index) => log.index === index && count(log.correctCount) && count(log.wrongCount))
  )
    return false
  return state.checkpoint?.id === value.id && state.runId === value.runId
}
