import type { ReadingPassage } from './types'

export const MAX_READING_PACK_BYTES = 8 * 1024 * 1024

export interface ReadingPack {
  format: 'wenyan-reading-pack'
  schemaVersion: 1
  title: string
  passages: ReadingPassage[]
}

export interface StoredReadingPassage {
  key: string
  ownerKey: string
  importedAt: number
  packTitle: string
  passage: ReadingPassage
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式不正确。`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}为空或过长。`)
  return value.trim()
}

function id(value: unknown, label: string) {
  const result = text(value, label, 180)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result)) throw new Error(`${label}只允许英文字母、数字、点、短横线和下划线。`)
  return result
}

function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new Error(`${label}数量必须为 1–${max}。`)
  return value
}

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label}不能重复。`)
}

/** Normalize only supported plain-text reading content; never trust imported eligibility flags. */
export function parseReadingPassage(value: unknown): ReadingPassage {
  const row = object(value, '篇目')
  const passageId = id(row.id, '篇目 ID')
  if (passageId.startsWith('wenyan-demo-')) throw new Error('导入篇目不能使用内置演示 ID。')
  const source = object(row.source, '来源')
  const reference = source.reference === undefined ? undefined : text(source.reference, '来源链接', 2000)
  if (reference && !/^https?:\/\//i.test(reference)) throw new Error('来源链接必须以 http:// 或 https:// 开头。')
  const questions = list(row.questions, '题目', 40).map((value, index) => {
    const question = object(value, `第 ${index + 1} 题`)
    if (question.type !== 'single_choice') throw new Error('当前阅读练习只支持单项选择题。')
    const options = list(question.options, '选项', 10).map((value) => {
      const option = object(value, '选项')
      return { id: id(option.id, '选项 ID'), text: text(option.text, '选项内容', 4000) }
    })
    if (options.length < 2) throw new Error('每道题至少需要两个选项。')
    unique(options.map((option) => option.id), '选项 ID')
    const correctOptionId = id(question.correctOptionId, '标准答案')
    if (!options.some((option) => option.id === correctOptionId)) throw new Error('标准答案必须对应一个已有选项。')
    return {
      id: id(question.id, '题目 ID'), type: 'single_choice' as const,
      stem: text(question.stem, '题干', 6000), options, correctOptionId,
      ...(question.explanation === undefined ? {} : { explanation: text(question.explanation, '解析', 16000) }),
    }
  })
  unique(questions.map((question) => question.id), '题目 ID')
  if (typeof row.estimatedMinutes !== 'number' || !Number.isInteger(row.estimatedMinutes) || row.estimatedMinutes < 1 || row.estimatedMinutes > 180) {
    throw new Error('预计用时必须为 1–180 分钟。')
  }
  let exam: ReadingPassage['exam']
  if (row.exam !== undefined) {
    const data = object(row.exam, '试卷信息')
    if (data.paper !== 'english-1' && data.paper !== 'english-2') throw new Error('试卷必须为英语一或英语二。')
    if (typeof data.year !== 'number' || !Number.isInteger(data.year) || data.year < 1980 || data.year > 2100) throw new Error('年份不正确。')
    exam = { paper: data.paper, year: data.year }
  }
  return {
    id: passageId, version: id(row.version, '内容版本'), title: text(row.title, '标题', 200),
    source: { kind: 'private-import', label: text(source.label, '来源名称', 500),
      ...(reference ? { reference } : {}),
      ...(source.license === undefined ? {} : { license: text(source.license, '使用声明', 8000) }),
      ...(source.revision === undefined ? {} : { revision: text(source.revision, '来源版本', 200) }),
    },
    paragraphs: list(row.paragraphs, '文章段落', 100).map((paragraph) => text(paragraph, '文章段落', 20000)),
    estimatedMinutes: row.estimatedMinutes, questions, recommendationEligible: false,
    ...(exam ? { exam } : {}),
  }
}

export function parseReadingPack(json: string): ReadingPack {
  if (new TextEncoder().encode(json).byteLength > MAX_READING_PACK_BYTES) throw new Error('题包超过 8 MB，请按年份拆分后导入。')
  let value: unknown
  try { value = JSON.parse(json) } catch { throw new Error('文件不是有效的 JSON 题包。') }
  const row = object(value, '题包')
  if (row.format !== 'wenyan-reading-pack' || row.schemaVersion !== 1) throw new Error('请选择 Wenyan 阅读题包 v1。')
  const passages = list(row.passages, '篇目', 200).map(parseReadingPassage)
  unique(passages.map((passage) => JSON.stringify([passage.id, passage.version])), '篇目 ID 与版本组合')
  return { format: 'wenyan-reading-pack', schemaVersion: 1, title: text(row.title, '题包名称', 200), passages }
}
