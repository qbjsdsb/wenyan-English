import type { IChapterRecord, IReviewRecord, IRevisionDictRecord, IWordRecord, LetterMistakes } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'
import type {
  ChapterCompletedPayload,
  LearningEventRecord,
  LearningSyncCursor,
  PlanTaskFactContext,
  WordAttemptedPayload,
} from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { advanceCommittedWord } from '@/pages/Typing/checkpoint'
import type { TypingCheckpoint } from '@/pages/Typing/checkpoint'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import type { StoredStudyPlan, StudyPlanRun } from '@/plans/types'
import type { SemanticRun } from '@/semantic/run'
import { currentChapterAtom, currentDictIdAtom, isReviewModeAtom, loopWordConfigAtom, reviewModeInfoAtom, wordDictationConfigAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import type { Table } from 'dexie'
import Dexie from 'dexie'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

class RecordDB extends Dexie {
  typingCheckpoints!: Table<TypingCheckpoint, string>
  semanticRuns!: Table<SemanticRun, string>
  wordRecords!: Table<IWordRecord, number>
  chapterRecords!: Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord, number>

  revisionDictRecords!: Table<IRevisionDictRecord, number>
  revisionWordRecords!: Table<IWordRecord, number>

  learningEvents!: Table<LearningEventRecord, string>
  learningSyncCursors!: Table<LearningSyncCursor, string>

  studyPlans!: Table<StoredStudyPlan, string>
  studyPlanRuns!: Table<StudyPlanRun, string>

  constructor() {
    super('RecordDB')
    this.version(1).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,errorCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(2).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(3).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
    })
    this.version(4).stores({
      learningEvents: '&id,eventType,occurredAt,syncState,[syncState+occurredAt]',
    })
    this.version(5).stores({
      studyPlans: '&id,importedAt',
      studyPlanRuns: '&id,planId,taskId,startedAt',
    })
    this.version(7).stores({ semanticRuns: '&id,sessionId,startedAt' })
    this.version(6).stores({
      learningSyncCursors: '&userId',
    })
    this.version(8).stores({ typingCheckpoints: '&id,updatedAt' })
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)

async function getActiveChapterTaskContext(
  taskRunId: string | null | undefined,
  occurredAt: number,
  dictId: string,
  chapter: number,
): Promise<{ run: StudyPlanRun; context: Required<PlanTaskFactContext> } | undefined> {
  if (!taskRunId) return undefined
  const run = await db.studyPlanRuns.get(taskRunId)
  if (!run || run.completionEventId || occurredAt < run.startedAt) return undefined

  const plan = await db.studyPlans.get(run.planId)
  const task = plan?.tasks.find((item) => item.id === run.taskId)
  if (!task || task.dictId !== dictId || task.chapterIndex !== chapter) return undefined

  return {
    run,
    context: {
      taskRunId: run.id,
      planId: run.planId,
      taskId: run.taskId,
    },
  }
}

export function useSaveChapterRecord() {
  const currentChapter = useAtomValue(currentChapterAtom)
  const isRevision = useAtomValue(isReviewModeAtom)
  const review = useAtomValue(reviewModeInfoAtom).reviewRecord
  const manualReview = isRevision && review?.origin === 'manual' ? review : undefined
  const dictID = useAtomValue(currentDictIdAtom)

  const saveChapterRecord = useCallback(
    async (typingState: TypingState, taskRunId?: string | null) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words, wordRecordIds },
        timerData: { time },
      } = typingState
      if (manualReview && manualReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')
      // Reaching the end by navigation/skips is not genuine chapter completion.
      if ((!isRevision || manualReview) && typingState.chapterData.completedWordIndexes.length !== words.length) {
        if (typingState.checkpoint) {
          await db.transaction('rw', db.typingCheckpoints, async () => {
            const checkpoint = await db.typingCheckpoints.get(typingState.checkpoint!.id)
            if (checkpoint?.runId === typingState.runId) await db.typingCheckpoints.delete(checkpoint.id)
          })
        }
        return
      }
      const correctWordIndexes = userInputLogs
        .filter((log) => typingState.chapterData.completedWordIndexes.includes(log.index) && log.wrongCount === 0)
        .map((log) => log.index)

      const chapter = isRevision ? -1 : currentChapter
      const chapterRecord = new ChapterRecord(
        dictID,
        chapter,
        time,
        correctCount,
        wrongCount,
        wordCount,
        correctWordIndexes,
        words.length,
        wordRecordIds ?? [],
      )

      const event = createLearningEvent<ChapterCompletedPayload>('chapter_completed', {
        dict: dictID,
        chapter,
        reviewMode: isRevision,
        durationSeconds: time,
        correctCount,
        wrongCount,
        wordCount,
        wordNumber: words.length,
        firstTryCorrectCount: correctWordIndexes.length,
      })

      await db.transaction(
        'rw',
        [db.chapterRecords, db.learningEvents, db.wordRecords, db.studyPlans, db.studyPlanRuns, db.typingCheckpoints],
        async () => {
          if (manualReview && manualReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')
          if (typingState.checkpoint && typingState.checkpoint.ownerUserId !== getLocalLearningOwnerId())
            throw new Error('学习账号已变化，请重新打开练习。')
          await db.chapterRecords.add(chapterRecord)

          let completedRun: StudyPlanRun | undefined
          if (!isRevision && chapter >= 0) {
            const taskContext = await getActiveChapterTaskContext(taskRunId, event.occurredAt, dictID, chapter)
            if (taskContext) {
              const records = await db.wordRecords.bulkGet(wordRecordIds ?? [])
              const completedWords = new Map<string, number>()
              records.forEach((record) => {
                if (record && record.dict === dictID && record.chapter === chapter) {
                  completedWords.set(record.word, (completedWords.get(record.word) ?? 0) + 1)
                }
              })
              const allWordsPractised =
                words.length > 0 &&
                words.every((word) => {
                  const count = completedWords.get(word.name) ?? 0
                  completedWords.set(word.name, count - 1)
                  return count > 0
                })
              const previous = await db.studyPlanRuns.where('planId').equals(taskContext.run.planId).toArray()
              const alreadyCompleted = previous.some((item) => item.taskId === taskContext.run.taskId && item.completionEventId)
              if (allWordsPractised && !alreadyCompleted) {
                event.sourceVersion = 2
                event.payload = { ...event.payload, ...taskContext.context }
                completedRun = taskContext.run
              }
            }
          }

          await db.learningEvents.add(event)
          if (completedRun) {
            await db.studyPlanRuns.update(completedRun.id, { completedAt: event.occurredAt, completionEventId: event.id })
          }
          if (typingState.checkpoint) {
            const checkpoint = await db.typingCheckpoints.get(typingState.checkpoint.id)
            if (checkpoint?.runId === typingState.runId) await db.typingCheckpoints.delete(checkpoint.id)
          }
        },
      )
    },
    [currentChapter, dictID, isRevision, manualReview],
  )

  return saveChapterRecord
}

export type WordKeyLogger = {
  letterTimeArray: number[]
  letterMistake: LetterMistakes
}

export function useSaveWordRecord() {
  const isRevision = useAtomValue(isReviewModeAtom)
  const review = useAtomValue(reviewModeInfoAtom).reviewRecord
  const manualReview = isRevision && review?.origin === 'manual' ? review : undefined
  const currentChapter = useAtomValue(currentChapterAtom)
  const dictID = useAtomValue(currentDictIdAtom)
  const wordDictationConfig = useAtomValue(wordDictationConfigAtom)
  const { times: loopTimes } = useAtomValue(loopWordConfigAtom)

  const { state, dispatch } = useContext(TypingContext) ?? {}

  const saveWordRecord = useCallback(
    async ({
      word,
      wrongCount,
      letterTimeArray,
      letterMistake,
    }: {
      word: string
      wrongCount: number
      letterTimeArray: number[]
      letterMistake: LetterMistakes
    }) => {
      if (manualReview && manualReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')
      const timing = []
      for (let i = 1; i < letterTimeArray.length; i++) {
        const diff = letterTimeArray[i] - letterTimeArray[i - 1]
        timing.push(diff)
      }

      const chapter = isRevision ? -1 : currentChapter
      const taskRunId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('taskRun')
      const wordRecord = new WordRecord(word, dictID, chapter, timing, wrongCount, letterMistake)
      const event = createLearningEvent<WordAttemptedPayload>(
        'word_attempted',
        {
          word,
          dict: dictID,
          chapter,
          reviewMode: isRevision,
          wrongCount,
          durationMs: timing.reduce((total, value) => total + value, 0),
          timing,
          mistakes: letterMistake,
          dictationEnabled: wordDictationConfig.isOpen,
          dictationType: wordDictationConfig.type,
        },
        2,
      )

      let dbID = -1
      try {
        dbID = await db.transaction(
          'rw',
          [db.wordRecords, db.learningEvents, db.studyPlans, db.studyPlanRuns, db.typingCheckpoints, db.reviewRecords],
          async () => {
            if (manualReview && manualReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')
            if (state?.checkpoint && state.checkpoint.ownerUserId !== getLocalLearningOwnerId())
              throw new Error('学习账号已变化，请重新打开练习。')
            const wordRecordId = await db.wordRecords.add(wordRecord)
            if (!isRevision && chapter >= 0) {
              const taskContext = await getActiveChapterTaskContext(taskRunId, event.occurredAt, dictID, chapter)
              if (taskContext) event.payload = { ...event.payload, ...taskContext.context }
            }
            await db.learningEvents.add(event)
            if (manualReview?.id && state) {
              const current = await db.reviewRecords.get(manualReview.id)
              if (!current || current.ownerUserId !== manualReview.ownerUserId || current.index !== manualReview.index || current.isFinished) {
                throw new Error('练习进度已变化，请重新打开这一段。')
              }
              const next = advanceCommittedWord(state, loopTimes)
              await db.reviewRecords.update(manualReview.id, { index: next.chapterData.index, isFinished: next.isFinished })
            }
            if (state?.checkpoint) {
              const next = advanceCommittedWord(state, loopTimes)
              next.chapterData.wordRecordIds.push(wordRecordId)
              await db.typingCheckpoints.put({ ...state.checkpoint, schemaVersion: 1, updatedAt: Date.now(), state: next })
            }
            return wordRecordId
          },
        )
      } catch (error) {
        console.error('保存单词记录与学习事实失败：', error)
        throw error
      }

      if (dispatch) {
        dbID > 0 && dispatch({ type: TypingStateActionType.ADD_WORD_RECORD_ID, payload: dbID })
        dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
      }
    },
    [currentChapter, dictID, dispatch, isRevision, wordDictationConfig.isOpen, wordDictationConfig.type, loopTimes, state, manualReview],
  )

  return saveWordRecord
}

export function useDeleteWordRecord() {
  const deleteWordRecord = useCallback(async (word: string, dict: string) => {
    try {
      const deletedCount = await db.wordRecords.where({ word, dict }).delete()
      return deletedCount
    } catch (error) {
      console.error(`删除单词记录时出错：`, error)
    }
  }, [])

  return { deleteWordRecord }
}
