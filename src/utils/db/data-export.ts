import { db } from '.'
import { getCurrentDate, recordDataAction } from '..'

export type ExportProgress = {
  totalRows?: number
  completedRows: number
  done: boolean
}

export type ImportProgress = {
  totalRows?: number
  completedRows: number
  done: boolean
}

const MAX_COMPRESSED_BACKUP_BYTES = 64 * 1024 * 1024
const MAX_UNCOMPRESSED_BACKUP_BYTES = 256 * 1024 * 1024

function importStageName() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `WenyanImportStage-${crypto.randomUUID()}`
  }
  return `WenyanImportStage-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function validateBackupBlob(blob: Blob) {
  const { importDB, peakImportFile } = await import('dexie-export-import')
  const metadata = await peakImportFile(blob)

  if (metadata.formatName !== 'dexie' || metadata.formatVersion !== 1) {
    throw new Error('备份格式无法识别，未修改现有数据。')
  }
  if (metadata.data.databaseName !== db.name) {
    throw new Error('这不是 Wenyan 的本地学习备份，未修改现有数据。')
  }
  if (!Number.isFinite(metadata.data.databaseVersion) || metadata.data.databaseVersion < 1) {
    throw new Error('备份数据库版本无效，未修改现有数据。')
  }
  if (metadata.data.databaseVersion > db.verno) {
    throw new Error('这个备份来自更新版本的 Wenyan，请先更新应用后再导入。')
  }

  const knownTables = new Set(db.tables.map((table) => table.name))
  const seenTables = new Set<string>()
  let declaredRows = 0
  for (const table of metadata.data.tables) {
    if (!knownTables.has(table.name)) throw new Error(`备份包含当前版本不认识的数据表：${table.name}。`)
    if (seenTables.has(table.name)) throw new Error(`备份中存在重复的数据表：${table.name}。`)
    if (!Number.isInteger(table.rowCount) || table.rowCount < 0) throw new Error(`备份中的 ${table.name} 行数无效。`)
    seenTables.add(table.name)
    declaredRows += table.rowCount
  }
  if (!seenTables.has('wordRecords') || !seenTables.has('chapterRecords')) {
    throw new Error('备份缺少 Wenyan 的基础学习记录表，未修改现有数据。')
  }

  // Import once into an isolated temporary IndexedDB. This verifies the complete
  // stream and every row before the real RecordDB is allowed to be cleared.
  const stageName = importStageName()
  let staging: Awaited<ReturnType<typeof importDB>> | undefined
  try {
    staging = await importDB(blob, { name: stageName })
    let stagedRows = 0
    for (const table of metadata.data.tables) {
      const count = await staging.table(table.name).count()
      if (count !== table.rowCount) throw new Error(`备份中的 ${table.name} 没有完整通过校验。`)
      stagedRows += count
    }
    if (stagedRows !== declaredRows) throw new Error('备份数据没有完整通过校验，未修改现有数据。')
  } finally {
    if (staging) {
      staging.close()
      await staging.delete()
    }
  }
}

export async function exportDatabase(callback: (exportProgress: ExportProgress) => boolean) {
  const [pako, { saveAs }] = await Promise.all([import('pako'), import('file-saver'), import('dexie-export-import')])

  const blob = await db.export({
    progressCallback: ({ totalRows, completedRows, done }) => {
      return callback({ totalRows, completedRows, done })
    },
  })
  const [wordCount, chapterCount] = await Promise.all([db.wordRecords.count(), db.chapterRecords.count()])

  const json = await blob.text()
  const compressed = pako.gzip(json)
  const compressedBlob = new Blob([compressed])
  const currentDate = getCurrentDate()
  saveAs(compressedBlob, `Qwerty-Learner-User-Data-${currentDate}.gz`)
  recordDataAction({ type: 'export', size: compressedBlob.size, wordCount, chapterCount })
}

export async function importDatabase(onStart: () => void, callback: (importProgress: ImportProgress) => boolean) {
  const [pako] = await Promise.all([import('pako'), import('dexie-export-import')])

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/gzip,.gz'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > MAX_COMPRESSED_BACKUP_BYTES) throw new Error('备份文件过大，未修改现有数据。')

    onStart()

    const compressed = await file.arrayBuffer()
    const json = pako.ungzip(compressed, { to: 'string' })
    if (new TextEncoder().encode(json).byteLength > MAX_UNCOMPRESSED_BACKUP_BYTES) {
      throw new Error('解压后的备份文件过大，未修改现有数据。')
    }
    const blob = new Blob([json], { type: 'application/json' })

    await validateBackupBlob(blob)

    // dexie-export-import runs the real import atomically by default. Staging
    // above means malformed/unsupported backups never reach this destructive step.
    await db.import(blob, {
      acceptVersionDiff: true,
      acceptMissingTables: true,
      acceptNameDiff: false,
      acceptChangedPrimaryKey: false,
      overwriteValues: true,
      clearTablesBeforeImport: true,
      progressCallback: ({ totalRows, completedRows, done }) => {
        return callback({ totalRows, completedRows, done })
      },
    })

    const [wordCount, chapterCount] = await Promise.all([db.wordRecords.count(), db.chapterRecords.count()])
    recordDataAction({ type: 'import', size: file.size, wordCount, chapterCount })
  })

  input.click()
}
