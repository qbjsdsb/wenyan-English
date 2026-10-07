import type { StudyPlan, StudyTask } from './types'
import { idDictionaryMap } from '@/resources/dictionary'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('计划格式应为 JSON 对象。')
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}不能为空，且不得超过 ${max} 字。`)
  return value.trim()
}

function identifier(value: unknown): string {
  const id = text(value, 'ID', 80)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('ID 只能包含字母、数字、下划线和短横线。')
  return id
}

export function parseStudyPlan(json: string): StudyPlan {
  if (json.length > 100_000) throw new Error('计划过大，请控制在 100 KB 以内。')
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('JSON 格式有误，请粘贴完整计划，不要包含 Markdown 代码框。')
  }
  const plan = object(value)
  if (plan.schemaVersion !== 1) throw new Error('暂时只支持 schemaVersion 为 1 的计划。')
  const timezone = text(plan.timezone, '时区', 80)
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
  } catch {
    throw new Error('计划时区无效。建议使用 Asia/Shanghai。')
  }
  if (!Array.isArray(plan.tasks) || plan.tasks.length < 1 || plan.tasks.length > 60) throw new Error('每份计划应包含 1–60 个任务。')
  const ids = new Set<string>()
  const tasks: StudyTask[] = plan.tasks.map((value) => {
    const task = object(value)
    const id = identifier(task.id)
    if (ids.has(id)) throw new Error('同一计划中的任务 ID 不能重复。')
    ids.add(id)
    const dictId = text(task.dictId, '词书 ID', 100)
    const dict = Object.prototype.hasOwnProperty.call(idDictionaryMap, dictId) ? idDictionaryMap[dictId] : undefined
    if (!dict || dict.language !== 'en') throw new Error(`未找到英语词书：${dictId}`)
    if (task.kind !== 'chapter') throw new Error('当前只支持 chapter 章节任务。')
    if (typeof task.chapterIndex !== 'number' || !Number.isInteger(task.chapterIndex) || task.chapterIndex < 0 || task.chapterIndex >= dict.chapterCount) {
      throw new Error(`${dict.name} 的 chapterIndex 应为 0–${dict.chapterCount - 1} 的整数。`)
    }
    const dueDate = text(task.dueDate, '任务日期', 10)
    const date = new Date(`${dueDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dueDate) {
      throw new Error('任务日期应为真实的 YYYY-MM-DD 日期。')
    }
    if (typeof task.estimatedMinutes !== 'number' || !Number.isInteger(task.estimatedMinutes) || task.estimatedMinutes < 1 || task.estimatedMinutes > 120) {
      throw new Error('预计学习时长应为 1–120 分钟的整数。')
    }
    return { id, title: text(task.title, '任务名称', 100), kind: 'chapter', dictId, chapterIndex: task.chapterIndex, dueDate,
      estimatedMinutes: task.estimatedMinutes, reason: text(task.reason, '任务理由', 500) }
  })
  return { schemaVersion: 1, id: identifier(plan.id), title: text(plan.title, '计划名称', 100), timezone, tasks }
}

export function dateInTimezone(time: number, timeZone = 'Asia/Shanghai'): string {
  // en-CA output is not consistently ISO across all engines; assemble explicit parts.
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
