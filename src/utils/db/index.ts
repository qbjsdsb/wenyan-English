import type { SemanticRun } from '@/semantic/run'
import type { ChapterCompletedPayload, LearningEventRecord, LearningSyncCursor, PlanTaskFactContext, WordAttemptedPayload } from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import type { StoredStudyPlan, StudyPlanRun } from '@/plans/types'
import { currentChapterAtom, currentDictIdAtom, isReviewModeAtom, wordDictationConfigAtom } from '@/store'
import type { Table } from 'dexie'
import Dexie from 'dexie'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'
import type { IChapterRecord, IReviewRecord, IRevisionDictRecord, IWordRecord, LetterMistakes } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'

class RecordDB extends Dexie {
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
  const dictID = useAtomValue(currentDictIdAtom)

  const saveChapterRecord = useCallback(
    async (typingState: TypingState, taskRunId?: string | null) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words, wordRecordIds },
        timerData: { time },
      } = typingState
      const correctWordIndexes = userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).map((log) => log.index)

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

      await db.transaction('rw', db.chapterRecords, db.learningEvents, db.wordRecords, db.studyPlans, db.studyPlanRuns, async () => {
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
            const allWordsPractised = words.length > 0 && words.every((word) => {
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
      })
    },
    [currentChapter, dictID, isRevision],
  )

  return saveChapterRecord
}

export type WordKeyLogger = {
  letterTimeArray: number[]
  letterMistake: LetterMistakes
}

export function useSaveWordRecord() {
  const isRevision = useAtomValue(isReviewModeAtom)
  const currentChapter = useAtomValue(currentChapterAtom)
  const dictID = useAtomValue(currentDictIdAtom)
  const wordDictationConfig = useAtomValue(wordDictationConfigAtom)

  const { dispatch } = useContext(TypingContext) ?? {}

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
        dbID = await db.transaction('rw', db.wordRecords, db.learningEvents, db.studyPlans, db.studyPlanRuns, async () => {
          const wordRecordId = await db.wordRecords.add(wordRecord)
          if (!isRevision && chapter >= 0) {
            const taskContext = await getActiveChapterTaskContext(taskRunId, event.occurredAt, dictID, chapter)
            if (taskContext) event.payload = { ...event.payload, ...taskContext.context }
          }
          await db.learningEvents.add(event)
          return wordRecordId
        })
      } catch (error) {
        console.error('保存单词记录与学习事实失败：', error)
        throw error
      } finally {
        dispatch?.({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
      }

      if (dispatch) {
        dbID > 0 && dispatch({ type: TypingStateActionType.ADD_WORD_RECORD_ID, payload: dbID })
      }
    },
    [currentChapter, dictID, dispatch, isRevision, wordDictationConfig.isOpen, wordDictationConfig.type],
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
