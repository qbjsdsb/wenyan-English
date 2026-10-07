import type {
  ChapterCompletedPayload,
  LearningEventRecord,
  LearningEventSourceVersion,
  LearningEventType,
  LearningSyncCursor,
  PlanTaskFactContext,
  QuestionAttemptedPayload,
  ReadingCompletedPayload,
  WordAttemptedPayload,
} from '@/learning/types'
import type { WordDictationType } from '@/typings'
import { supabase } from '@/supabase/client'
import { db } from '@/utils/db'
import { setLocalLearningOwnerId } from './localLearningOwner'

export interface RemoteLearningEvent {
  id: string
  event_type: string
  occurred_at: string
  source: string
  source_version: number
  payload: unknown
  created_at: string
}

export type LearningPullResult =
  | { status: 'signed-out'; received: 0; inserted: 0 }
  | { status: 'idle'; received: 0; inserted: 0 }
  | { status: 'pulled'; received: number; inserted: number }
  | { status: 'failed'; received: 0; inserted: 0; message: string }

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式无效。`)
  return value as Record<string, unknown>
}

function asString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label}格式无效。`)
  return value
}

function asNullableString(value: unknown, label: string) {
  if (value === null) return null
  return asString(value, label)
}

function asOptionalString(value: unknown, label: string) {
  if (value === undefined) return undefined
  return asString(value, label)
}

function asNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}格式无效。`)
  return value
}

function asNonNegativeInteger(value: unknown, label: string) {
  const number = asNumber(value, label)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label}格式无效。`)
  return number
}

function asIntegerOrNull(value: unknown, label: string): number | null {
  if (value === null) return null
  const number = asNumber(value, label)
  if (!Number.isInteger(number)) throw new Error(`${label}格式无效。`)
  return number
}

function asBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label}格式无效。`)
  return value
}

function asStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${label}格式无效。`)
  return value as string[]
}

function parseMistakes(value: unknown) {
  const source = asObject(value, '错键记录')
  const mistakes: Record<number, string[]> = {}
  for (const [key, entries] of Object.entries(source)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || !Array.isArray(entries) || entries.some((entry) => typeof entry !== 'string')) {
      throw new Error('错键记录格式无效。')
    }
    mistakes[index] = entries as string[]
  }
  return mistakes
}

function parseDictationType(value: unknown): WordDictationType {
  if (value === 'hideAll' || value === 'hideVowel' || value === 'hideConsonant' || value === 'randomHide') return value
  throw new Error('默写显示方式格式无效。')
}

function parseTaskContext(payload: Record<string, unknown>): PlanTaskFactContext {
  const taskRunId = asOptionalString(payload.taskRunId, '任务运行 ID')
  const planId = asOptionalString(payload.planId, '计划 ID')
  const taskId = asOptionalString(payload.taskId, '任务 ID')
  const taskContextCount = [taskRunId, planId, taskId].filter(Boolean).length
  if (taskContextCount !== 0 && taskContextCount !== 3) throw new Error('任务关联记录格式无效。')
  return taskRunId && planId && taskId ? { taskRunId, planId, taskId } : {}
}

function parseWordPayload(value: unknown, sourceVersion: LearningEventSourceVersion): WordAttemptedPayload {
  const payload = asObject(value, '单词学习记录')
  if (!Array.isArray(payload.timing) || payload.timing.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new Error('单词计时记录格式无效。')
  }

  const base: WordAttemptedPayload = {
    word: asString(payload.word, '单词'),
    dict: asString(payload.dict, '词书'),
    chapter: asIntegerOrNull(payload.chapter, '章节'),
    reviewMode: asBoolean(payload.reviewMode, '复习模式'),
    wrongCount: asNumber(payload.wrongCount, '错误次数'),
    durationMs: asNumber(payload.durationMs, '键间耗时'),
    timing: payload.timing as number[],
    mistakes: parseMistakes(payload.mistakes),
  }

  if (sourceVersion === 1) return base
  return {
    ...base,
    dictationEnabled: asBoolean(payload.dictationEnabled, '默写开关'),
    dictationType: parseDictationType(payload.dictationType),
    ...parseTaskContext(payload),
  }
}

function parseChapterPayload(value: unknown, sourceVersion: LearningEventSourceVersion): ChapterCompletedPayload {
  const payload = asObject(value, '章节学习记录')
  const base: ChapterCompletedPayload = {
    dict: asString(payload.dict, '词书'),
    chapter: asIntegerOrNull(payload.chapter, '章节'),
    reviewMode: asBoolean(payload.reviewMode, '复习模式'),
    durationSeconds: asNumber(payload.durationSeconds, '章节耗时'),
    correctCount: asNumber(payload.correctCount, '正确次数'),
    wrongCount: asNumber(payload.wrongCount, '错误次数'),
    wordCount: asNumber(payload.wordCount, '练习词数'),
    wordNumber: asNumber(payload.wordNumber, '章节词数'),
    firstTryCorrectCount: asNumber(payload.firstTryCorrectCount, '首次无错词数'),
  }
  return sourceVersion === 1 ? base : { ...base, ...parseTaskContext(payload) }
}

function parseQuestionPayload(value: unknown, sourceVersion: LearningEventSourceVersion): QuestionAttemptedPayload {
  if (sourceVersion < 3) throw new Error('答题记录版本无效。')
  const payload = asObject(value, '答题记录')
  if (payload.questionType !== 'single_choice') throw new Error('题型记录格式无效。')
  const isCorrect = payload.isCorrect === null ? null : asBoolean(payload.isCorrect, '答题结果')
  return {
    attemptId: asString(payload.attemptId, '阅读尝试 ID'),
    passageId: asString(payload.passageId, '文章 ID'),
    passageVersion: asString(payload.passageVersion, '文章版本'),
    questionId: asString(payload.questionId, '题目 ID'),
    questionType: 'single_choice',
    selectedOptionId: asNullableString(payload.selectedOptionId, '用户选项'),
    correctOptionId: asString(payload.correctOptionId, '正确选项'),
    answered: asBoolean(payload.answered, '是否作答'),
    isCorrect,
    answerChangeCount: asNonNegativeInteger(payload.answerChangeCount, '改答案次数'),
    questionTags: asStringArray(payload.questionTags, '题目标签'),
  }
}

function parseReadingCompletedPayload(value: unknown, sourceVersion: LearningEventSourceVersion): ReadingCompletedPayload {
  if (sourceVersion < 3) throw new Error('阅读完成记录版本无效。')
  const payload = asObject(value, '阅读完成记录')
  const sourceKind = payload.sourceKind
  if (sourceKind !== 'wenyan-original' && sourceKind !== 'private-import' && sourceKind !== 'public-domain') {
    throw new Error('阅读来源格式无效。')
  }
  return {
    attemptId: asString(payload.attemptId, '阅读尝试 ID'),
    passageId: asString(payload.passageId, '文章 ID'),
    passageVersion: asString(payload.passageVersion, '文章版本'),
    sourceKind,
    durationMs: asNonNegativeInteger(payload.durationMs, '阅读耗时'),
    questionCount: asNonNegativeInteger(payload.questionCount, '题目数'),
    answeredCount: asNonNegativeInteger(payload.answeredCount, '作答数'),
    correctCount: asNonNegativeInteger(payload.correctCount, '答对数'),
  }
}

function parseEventType(value: string): LearningEventType {
  if (value === 'word_attempted' || value === 'chapter_completed' || value === 'question_attempted' || value === 'reading_completed') return value
  throw new Error(`云端包含当前版本不支持的学习事件：${value}。请更新 Wenyan 后再同步。`)
}

function parseSourceVersion(value: number): LearningEventSourceVersion {
  if (value === 1 || value === 2 || value === 3) return value
  throw new Error('云端包含当前版本不支持的 Wenyan 学习记录。请更新应用后再同步。')
}

function parsePayload(eventType: LearningEventType, payload: unknown, sourceVersion: LearningEventSourceVersion) {
  if (eventType === 'word_attempted') return parseWordPayload(payload, sourceVersion)
  if (eventType === 'chapter_completed') return parseChapterPayload(payload, sourceVersion)
  if (eventType === 'question_attempted') return parseQuestionPayload(payload, sourceVersion)
  return parseReadingCompletedPayload(payload, sourceVersion)
}

function toLocalEvent(row: RemoteLearningEvent, userId: string): LearningEventRecord {
  if (row.source !== 'wenyan-english') {
    throw new Error('云端包含当前版本不支持的 Wenyan 学习记录。请更新应用后再同步。')
  }

  const sourceVersion = parseSourceVersion(row.source_version)
  const eventType = parseEventType(row.event_type)
  const occurredAt = Date.parse(row.occurred_at)
  const createdAt = Date.parse(row.created_at)
  if (!Number.isFinite(occurredAt) || !Number.isFinite(createdAt)) throw new Error('云端学习记录时间格式无效。')

  return {
    id: asString(row.id, '事件 ID'),
    eventType,
    occurredAt,
    sourceVersion,
    syncState: 'synced',
    syncAttempts: 0,
    ownerUserId: userId,
    payload: parsePayload(eventType, row.payload, sourceVersion),
  }
}

export async function storePulledLearningEventPage(userId: string, rows: RemoteLearningEvent[]) {
  if (rows.length === 0) return 0

  const localEvents = rows.map((row) => toLocalEvent(row, userId))
  const last = rows[rows.length - 1]
  const cursor: LearningSyncCursor = {
    userId,
    createdAt: last.created_at,
    eventId: last.id,
    updatedAt: Date.now(),
  }

  return db.transaction('rw', db.learningEvents, db.learningSyncCursors, async () => {
    const existing = await db.learningEvents.bulkGet(localEvents.map((event) => event.id))
    let inserted = 0

    existing.forEach((event) => {
      if (event?.ownerUserId && event.ownerUserId !== userId) {
        throw new Error('检测到跨账号学习事件 ID 冲突，已停止恢复且未推进游标。')
      }
    })

    existing.forEach((event) => {
      if (!event) inserted += 1
    })
    await db.learningEvents.bulkPut(localEvents)
    await db.learningSyncCursors.put(cursor)
    return inserted
  })
}

export async function pullLearningEvents(pageSize = 100, maxPages = 5): Promise<LearningPullResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return { status: 'signed-out', received: 0, inserted: 0 }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { status: 'failed', received: 0, inserted: 0, message: userError?.message ?? '无法确认当前登录账号。' }
    }

    const userId = userData.user.id
    setLocalLearningOwnerId(userId)
    const safePageSize = Math.min(500, Math.max(1, Math.floor(pageSize)))
    const safeMaxPages = Math.min(50, Math.max(1, Math.floor(maxPages)))
    let received = 0
    let inserted = 0

    for (let page = 0; page < safeMaxPages; page += 1) {
      const cursor = await db.learningSyncCursors.get(userId)
      const { data, error } = await supabase.rpc('pull_learning_events', {
        p_after_created_at: cursor?.createdAt ?? null,
        p_after_id: cursor?.eventId ?? null,
        p_limit: safePageSize,
      })

      if (error) return { status: 'failed', received: 0, inserted: 0, message: error.message }
      const rows = (data ?? []) as RemoteLearningEvent[]
      if (rows.length === 0) break

      inserted += await storePulledLearningEventPage(userId, rows)
      received += rows.length
      if (rows.length < safePageSize) break
    }

    return received > 0 ? { status: 'pulled', received, inserted } : { status: 'idle', received: 0, inserted: 0 }
  } catch (error) {
    return {
      status: 'failed',
      received: 0,
      inserted: 0,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
