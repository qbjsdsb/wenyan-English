import { idDictionaryMap } from '@/resources/dictionary'
import { supabase } from '@/supabase/client'
import { db } from '@/utils/db'
import type { CloudTaskCompletion, StoredStudyPlan, StudyTask } from './types'

export type CloudPlanSyncResult =
  | { status: 'signed-out' }
  | { status: 'none' }
  | { status: 'synced'; planId: string; revision: number; executableTasks: number; deferredTasks: number }
  | { status: 'failed'; message: string }

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function mapChapterTask(value: unknown): { task?: StudyTask; completion?: CloudTaskCompletion } {
  const row = asObject(value)
  if (!row || row.kind !== 'chapter') return {}

  const config = asObject(row.config)
  const id = asText(row.id)
  const title = asText(row.title)
  const dueDate = asText(row.dueDate)
  const dictId = asText(config?.dictId)
  const chapterIndex = asInteger(config?.chapterIndex)
  const estimatedMinutes = asInteger(row.estimatedMinutes)
  const dict = dictId && Object.prototype.hasOwnProperty.call(idDictionaryMap, dictId) ? idDictionaryMap[dictId] : undefined

  if (
    !id ||
    !title ||
    !dueDate ||
    !validDate(dueDate) ||
    !dictId ||
    !dict ||
    dict.language !== 'en' ||
    chapterIndex == null ||
    chapterIndex < 0 ||
    chapterIndex >= dict.chapterCount ||
    estimatedMinutes == null ||
    estimatedMinutes < 1 ||
    estimatedMinutes > 240
  ) {
    return {}
  }

  const task: StudyTask = {
    id,
    title,
    kind: 'chapter',
    dictId,
    chapterIndex,
    dueDate,
    estimatedMinutes,
    reason: typeof row.reason === 'string' ? row.reason : '',
  }

  const completedAt = asText(row.completedAt)
  const completionEventId = asText(row.completionEventId)
  return {
    task,
    completion: completedAt && completionEventId ? { completedAt, completionEventId } : undefined,
  }
}

async function markOtherCloudPlansArchived(ownerUserId: string, activePlanId?: string) {
  const cloudPlans = (await db.studyPlans.toArray()).filter(
    (plan) => plan.origin === 'cloud' && plan.ownerUserId === ownerUserId && plan.id !== activePlanId,
  )
  await Promise.all(cloudPlans.map((plan) => db.studyPlans.put({ ...plan, cloudStatus: 'archived' })))
}

/**
 * Pull Cloud Plan v2 into Dexie as an owner-bound execution cache. With no
 * planId this follows the current actionable plan for Today. A specific planId
 * is used immediately before task execution so RLS/Supabase remains the source
 * of truth even when a stale local cache exists.
 */
export async function syncCloudPlanToLocal(requestedPlanId?: string): Promise<CloudPlanSyncResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { status: 'failed', message: sessionError.message }
  if (!sessionData.session) return { status: 'signed-out' }
  const ownerUserId = sessionData.session.user.id

  const { data, error } = await supabase.rpc('get_plan_status', { p_plan_id: requestedPlanId ?? null })
  if (error) return { status: 'failed', message: error.message }

  if (data == null) {
    if (!requestedPlanId) {
      await db.transaction('rw', db.studyPlans, async () => markOtherCloudPlansArchived(ownerUserId))
    }
    return { status: 'none' }
  }

  const root = asObject(data)
  const planRow = asObject(root?.plan)
  const rawTasksValue = root?.tasks
  const rawTasks = Array.isArray(rawTasksValue) ? rawTasksValue : undefined
  const planId = asText(planRow?.id)
  const title = asText(planRow?.title)
  const timezone = asText(planRow?.timezone)
  const revision = asInteger(planRow?.revision)
  const status = planRow?.status === 'archived' ? 'archived' : planRow?.status === 'active' ? 'active' : undefined

  if (!planId || !title || !timezone || revision == null || revision < 1 || !status || !rawTasks) {
    return { status: 'failed', message: '云端计划返回了无法识别的结构。' }
  }
  if (requestedPlanId && planId !== requestedPlanId) {
    return { status: 'failed', message: '云端返回的计划与请求计划不一致。' }
  }

  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
  } catch {
    return { status: 'failed', message: '云端计划使用了无效时区。' }
  }

  const tasks: StudyTask[] = []
  const cloudCompletions: Record<string, CloudTaskCompletion> = {}
  let deferredTasks = 0

  for (const rawTask of rawTasks) {
    const raw = asObject(rawTask)
    if (raw?.state === 'cancelled') continue
    if (raw?.kind !== 'chapter') {
      deferredTasks += 1
      continue
    }
    const mapped = mapChapterTask(rawTask)
    if (!mapped.task) {
      deferredTasks += 1
      continue
    }
    tasks.push(mapped.task)
    if (mapped.completion) cloudCompletions[mapped.task.id] = mapped.completion
  }

  const updatedAt = asText(planRow?.updatedAt)
  const importedAt = updatedAt && Number.isFinite(Date.parse(updatedAt)) ? Date.parse(updatedAt) : Date.now()
  const cached: StoredStudyPlan = {
    schemaVersion: 1,
    id: planId,
    title,
    timezone,
    tasks,
    importedAt,
    origin: 'cloud',
    ownerUserId,
    cloudRevision: revision,
    cloudStatus: status,
    cloudCompletions,
  }

  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans.get(planId)
    if (existing && existing.origin !== 'cloud') throw new Error('云端计划 ID 与本机计划冲突，已拒绝覆盖本机计划。')
    if (!requestedPlanId) await markOtherCloudPlansArchived(ownerUserId, planId)
    await db.studyPlans.put(cached)
  })

  return { status: 'synced', planId, revision, executableTasks: tasks.length, deferredTasks }
}