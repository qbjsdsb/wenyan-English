import type { StoredStudyPlan, StudyPlanRun } from '@/plans/types'
import type { ChapterCompletedPayload, LearningEventRecord, WordAttemptedPayload } from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import { currentChapterAtom, currentDictIdAtom, isReviewModeAtom } from '@/store'
import type { Table } from 'dexie'
import Dexie from 'dexie'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'
import type { IChapterRecord, IReviewRecord, IRevisionDictRecord, IWordRecord, LetterMistakes } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'

class RecordDB extends Dexie {
  wordRecords!: Table<IWordRecord, number>
  chapterRecords!: Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord, number>

  revisionDictRecords!: Table<IRevisionDictRecord, number>
  revisionWordRecords!: Table<IWordRecord, number>

  learningEvents!: Table<LearningEventRecord, string>

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
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)

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
        await db.learningEvents.add(event)
        if (!taskRunId || isRevision) return
        const run = await db.studyPlanRuns.get(taskRunId)
        if (!run || run.completionEventId || event.occurredAt < run.startedAt) return
        const plan = await db.studyPlans.get(run.planId)
        const task = plan?.tasks.find((item) => item.id === run.taskId)
        // Switching dictionaries, reviewing, or skipping words cannot complete this task.
        const records = await db.wordRecords.bulkGet(wordRecordIds ?? [])
        const completedWords = new Map<string, number>()
        records.forEach((record) => {
          if (record && record.dict === dictID && record.chapter === chapter) completedWords.set(record.word, (completedWords.get(record.word) ?? 0) + 1)
        })
        const allWordsPractised = words.length > 0 && words.every((word) => {
          const count = completedWords.get(word.name) ?? 0
          completedWords.set(word.name, count - 1)
          return count > 0
        })
        if (task?.dictId !== dictID || task.chapterIndex !== chapter || !allWordsPractised) return
        const previous = await db.studyPlanRuns.where('planId').equals(run.planId).toArray()
        if (previous.some((item) => item.taskId === run.taskId && item.completionEventId)) return
        await db.studyPlanRuns.update(run.id, { completedAt: event.occurredAt, completionEventId: event.id })
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
      const wordRecord = new WordRecord(word, dictID, chapter, timing, wrongCount, letterMistake)

      let dbID = -1
      try {
        dbID = await db.wordRecords.add(wordRecord)
      } catch (e) {
        console.error(e)
      }

      if (dbID > 0) {
        const event = createLearningEvent<WordAttemptedPayload>('word_attempted', {
          word,
          dict: dictID,
          chapter,
          reviewMode: isRevision,
          wrongCount,
          durationMs: timing.reduce((total, value) => total + value, 0),
          timing,
          mistakes: letterMistake,
        })

        try {
          await db.learningEvents.add(event)
        } catch (error) {
          console.error('保存单词学习事件失败：', error)
        }
      }

      if (dispatch) {
        dbID > 0 && dispatch({ type: TypingStateActionType.ADD_WORD_RECORD_ID, payload: dbID })
        dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
      }
    },
    [currentChapter, dictID, dispatch, isRevision],
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
