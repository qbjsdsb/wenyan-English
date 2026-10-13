import { getReadingPassage, listReadingPassages } from './content'
import { parseReadingPack, parseReadingPassage } from './pack'
import type { ReadingPack, StoredReadingPassage } from './pack'
import type { ReadingPassage } from './types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'

const ownerKey = (owner?: string) => owner === undefined ? 'anonymous' : `user:${owner}`
const key = (owner: string | undefined, passage: ReadingPassage) => JSON.stringify([ownerKey(owner), passage.id, passage.version])

export async function importReadingPack(json: string, owner = getLocalLearningOwnerId()) {
  const pack = parseReadingPack(json)
  const importedAt = Date.now()
  const rows: StoredReadingPassage[] = pack.passages.map((passage) => ({
    key: key(owner, passage), ownerKey: ownerKey(owner), importedAt, packTitle: pack.title, passage,
  }))
  let added = 0
  await db.transaction('rw', db.readingPassages, async () => {
    if (owner !== getLocalLearningOwnerId()) throw new Error('账号已切换，请重新导入。')
    for (const row of rows) {
      const existing = await db.readingPassages.get(row.key)
      if (existing) {
        if (JSON.stringify(parseReadingPassage(existing.passage)) !== JSON.stringify(row.passage)) {
          throw new Error(`「${row.passage.title}」同一版本已存在不同内容；请提升版本号，本次未导入任何篇目。`)
        }
        continue
      }
      await db.readingPassages.add(row)
      added++
    }
    if (owner !== getLocalLearningOwnerId()) throw new Error('账号已切换，本次导入已取消。')
  })
  return { added, unchanged: rows.length - added }
}

export async function listPrivateReadingPassages(owner = getLocalLearningOwnerId()) {
  const rows = await db.readingPassages.where('ownerKey').equals(ownerKey(owner)).toArray()
  // Backups are another input boundary: validate content again before showing or running it.
  return rows.map((row) => ({ ...row, passage: parseReadingPassage(row.passage) }))
    .sort((a, b) => b.importedAt - a.importedAt || a.passage.id.localeCompare(b.passage.id) || a.passage.version.localeCompare(b.passage.version))
}

export async function loadReadingPassage(id: string, version: string | undefined, owner = getLocalLearningOwnerId()) {
  const builtIn = getReadingPassage(id)
  if (builtIn) return !version || builtIn.version === version ? builtIn : undefined
  const rows = await listPrivateReadingPassages(owner)
  return rows.find((row) => row.passage.id === id && (!version || row.passage.version === version))?.passage
}

export function readingPath(passage: ReadingPassage) {
  return `/reading/${encodeURIComponent(passage.id)}?v=${encodeURIComponent(passage.version)}`
}

export async function exportReadingPack(owner = getLocalLearningOwnerId()): Promise<ReadingPack> {
  const rows = await listPrivateReadingPassages(owner)
  if (owner !== getLocalLearningOwnerId()) throw new Error('账号已切换，请重新导出。')
  if (rows.length === 0) throw new Error('当前账号还没有导入题目。')
  return { format: 'wenyan-reading-pack', schemaVersion: 1, title: '我的阅读题库', passages: rows.map((row) => row.passage) }
}

export { listReadingPassages }
