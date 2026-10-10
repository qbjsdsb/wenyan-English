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
import { studyTaskExecutionFingerprint } from '@/plans/fingerprint'
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
    // Learning facts grow for the lifetime of the app. Owner-aware compound
    // indexes keep high-frequency Today/Practice reads bounded to the active
    // account without changing event identity or rewriting historical facts.
    this.version(9).stores({
      learningEvents: '&id,eventType,occurredAt,syncState,ownerUserId,[syncState+occurredAt],[ownerUserId+eventType],[ownerUserId+occurredAt]',
    })
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)

function isOwnedReview(review: IReviewRecord | undefined) {
  return review?.origin === 'manual' || review?.origin === 'smart' || review?.origin === 'correction'
}

async function getActiveChapterTaskContext(
  taskRunId: string | null | undefined,
  occurredAt: number,
  dictId: string,
  chapter: number,
): Promise<{ run: StudyPlanRun; context: Required<Pick<PlanTaskFactContext, 'taskRunId' | 'planId' | 'taskId'>> & PlanTaskFactContext } | undefined> {
  if (!taskRunId) return undefined
  const run = await db.studyPlanRuns.get(taskRunId)
  if (!run || run.completionEventId || occurredAt < run.startedAt) return undefined

  const plan = await db.studyPlans.get(run.planId)
  const task = plan?.tasks.find((item) => item.id === run.taskId)
  if (!plan || !task || task.dictId !== dictId || task.chapterIndex !== chapter) return undefined

  const currentFingerprint = studyTaskExecutionFingerprint(task)
  if (run.taskFingerprint && run.taskFingerprint !== currentFingerprint) return undefined

  if (plan.origin === 'cloud') {
    const ownerUserId = getLocalLearningOwnerId()
    // New Cloud Plan runs must have explicit owner/version/target provenance.
    // Legacy in-flight cloud runs fail closed rather than attaching stale task
    // ids to new immutable facts after an upgrade or account change.
    if (
      !ownerUserId ||
      plan.ownerUserId !== ownerUserId ||
      run.ownerUserId !== ownerUserId ||
      plan.cloudStatus !== 'active' ||
      !run.planRevision ||
      !run.taskFingerprint
    ) return undefined
  }

  return {
    run,
    context: {
      taskRunId: run.id,
      planId: run.planId,
      taskId: run.taskId,
      ...(run.planRevision ? { planRevision: run.planRevision } : {}),
      ...(run.taskFingerprint ? { taskFingerprint: run.taskFingerprint } : {}),
    },
  }
}

export function useSaveChapterRecord() {
  const currentChapter = useAtomValue(currentChapterAtom)
  const isRevision = useAtomValue(isReviewModeAtom)
  const review = useAtomValue(reviewModeInfoAtom).reviewRecord
  const ownedReview = isRevision && isOwnedReview(review) ? review : undefined
  const dictID = useAtomValue(currentDictIdAtom)

  const saveChapterRecord = useCallback(
    async (typingState: TypingState, taskRunId?: string | null) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words, wordRecordIds },
        timerData: { time },
      } = typingState
      if (ownedReview && ownedReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')
      // Reaching the end by navigation/skips is not genuine completion for a normal chapter or an owner-bound review block.
      if ((!isRevision || ownedReview) && typingState.chapterData.completedWordIndexes.length !== words.length) {
        if (ownedReview?.id) await db.reviewRecords.update(ownedReview.id, { endedAt: Date.now() })
        if (typingState.checkpoint) {
          await db.transaction('rw', db.typingCheckpoints, async () => {
            const checkpoint = await db.typingCheckpoints.get(typingState.checkpoint!.id)
            if (checkpoint?.runId === typingState.runId) await db.typingCheckpoints.delete(checkpoint.id)
          })
        }
        return
      }

      // Owner-bound spelling runs are bounded execution, not dictionary chapters. Their word facts and
      // authoritative review cursor are sufficient evidence; never synthesize chapter_completed.
      if (ownedReview) return

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
            await db.studyPlanRuns.update(completedRun.id, { completionEventId: event.id })
          }
          if (typingState.checkpoint) {
            const checkpoint = await db.typingCheckpoints.get(typingState.checkpoint.id)
            if (checkpoint?.runId === typingState.runId) await db.typingCheckpoints.delete(checkpoint.id)
          }
        },
      )
    },
    [currentChapter, dictID, isRevision, ownedReview],
  )

  return saveChapterRecord
}

export function useSaveWordRecord() {
  const isRevision = useAtomValue(isReviewModeAtom)
  const review = useAtomValue(reviewModeInfoAtom).reviewRecord
  const ownedReview = isRevision && isOwnedReview(review) ? review : undefined
  const dictID = useAtomValue(currentDictIdAtom)
  const currentChapter = useAtomValue(currentChapterAtom)
  const loopWordConfig = useAtomValue(loopWordConfigAtom)
  const wordDictationConfig = useAtomValue(wordDictationConfigAtom)
  const { state, dispatch } = useContext(TypingContext)!

  return useCallback(
    async (inputState: TypingState, wordIndex: number) => {
      const word = inputState.chapterData.words[wordIndex]
      const inputLog = inputState.chapterData.userInputLogs[wordIndex]
      if (!word || !inputLog) throw new Error('当前单词记录不可用。')
      if (ownedReview && ownedReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')

      const chapter = isRevision ? -1 : currentChapter
      const wordRecord = new WordRecord(
        word.name,
        inputLog.timing,
        inputLog.LetterMistakes as LetterMistakes,
        dictID,
        chapter,
        inputLog.wrongCount,
      )
      const event = createLearningEvent<WordAttemptedPayload>('word_attempted', {
        word: word.name,
        dict: dictID,
        chapter,
        reviewMode: isRevision,
        wrongCount: inputLog.wrongCount,
        durationMs: inputLog.timing.reduce((sum, item) => sum + item, 0),
        timing: inputLog.timing,
        mistakes: inputLog.LetterMistakes,
        dictationEnabled: wordDictationConfig.isOpen,
        dictationType: wordDictationConfig.type,
      }, 2)

      let recordId: number | undefined
      await db.transaction('rw', [db.wordRecords, db.learningEvents, db.reviewRecords, db.typingCheckpoints], async () => {
        if (ownedReview && ownedReview.ownerUserId !== getLocalLearningOwnerId()) throw new Error('学习账号已变化，请重新打开练习。')
        recordId = await db.wordRecords.add(wordRecord)
        await db.learningEvents.add(event)
        if (ownedReview?.id) {
          await advanceCommittedWord(db.reviewRecords, ownedReview.id, wordIndex, ownedReview.ownerUserId)
        }
        if (inputState.checkpoint) {
          const checkpoint = await db.typingCheckpoints.get(inputState.checkpoint.id)
          if (checkpoint?.runId === inputState.runId) {
            await db.typingCheckpoints.update(checkpoint.id, {
              committedIndex: wordIndex,
              updatedAt: Date.now(),
            })
          }
        }
      })

      if (typeof recordId === 'number') {
        dispatch({ type: TypingStateActionType.SET_WORD_RECORD_ID, index: wordIndex, recordId })
      }
      if (loopWordConfig.isOpen && state.loopData.wordIndex === wordIndex) {
        dispatch({ type: TypingStateActionType.INCREMENT_LOOP_COUNT })
      }
    },
    [currentChapter, dictID, dispatch, isRevision, loopWordConfig.isOpen, ownedReview, state.loopData.wordIndex, wordDictationConfig.isOpen, wordDictationConfig.type],
  )
}
