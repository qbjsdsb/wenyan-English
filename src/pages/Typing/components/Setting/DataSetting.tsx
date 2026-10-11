import styles from './index.module.css'
import type { ExportProgress, ImportProgress } from '@/utils/db/data-export'
import { exportDatabase, importDatabase } from '@/utils/db/data-export'
import * as Progress from '@radix-ui/react-progress'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useCallback, useRef, useState } from 'react'

export default function DataSetting() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const busy = isImporting || isExporting

  // Dexie's done marks the database phase, not compression/download or final restore completion.
  const exportProgressCallback = useCallback(({ totalRows, completedRows }: ExportProgress) => {
    if (totalRows) setExportProgress(Math.min(99, Math.floor((completedRows / totalRows) * 100)))
    return true
  }, [])

  const onClickExport = useCallback(async () => {
    if (lock.current) return
    lock.current = true
    setError('')
    setMessage('')
    setExportProgress(0)
    setIsExporting(true)
    try {
      await exportDatabase(exportProgressCallback)
      setExportProgress(100)
      setMessage('备份已生成，请在浏览器下载中确认文件已保存。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出失败，请重试。现有数据未修改。')
    } finally {
      lock.current = false
      setIsExporting(false)
    }
  }, [exportProgressCallback])

  const importProgressCallback = useCallback(({ totalRows, completedRows }: ImportProgress) => {
    if (totalRows) setImportProgress(Math.min(99, Math.floor((completedRows / totalRows) * 100)))
    return true
  }, [])

  const onSelectImport = useCallback(async (file?: File) => {
    if (!file || lock.current) return
    lock.current = true
    setError('')
    setMessage('')
    setImportProgress(0)
    setIsImporting(true)
    try {
      await importDatabase(file, importProgressCallback)
      setImportProgress(100)
      setMessage('备份已恢复。请刷新页面，载入恢复后的学习进度。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '备份无法读取，请选择有效的 Wenyan .gz 备份重试。')
    } finally {
      lock.current = false
      setIsImporting(false)
    }
  }, [importProgressCallback])

  const progress = (value: number) => (
    <div className="flex w-full items-center gap-3">
      <Progress.Root className="wenyan-data-progress min-w-0 flex-1" value={value}>
        <Progress.Indicator style={{ transform: `translateX(-${100 - value}%)` }} />
      </Progress.Root>
      <span className="wenyan-setting-state w-9 text-right">{value}%</span>
    </div>
  )

  return (
    <ScrollArea.Root className="flex-1 select-none overflow-y-auto">
      <ScrollArea.Viewport className="h-full w-full">
        <div className={styles.tabContent}>
          <input ref={input} type="file" accept="application/gzip,.gz" className="hidden" aria-label="选择 Wenyan 备份"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              void onSelectImport(file)
            }} />
          {error && <p role="alert" className="text-sm text-[var(--wenyan-danger)]">{error}</p>}
          {message && <p role="status" className="text-sm text-[var(--wenyan-ink-secondary)]">{message}</p>}
          {importProgress === 100 && <button className="wenyan-button-primary" disabled={busy} onClick={() => window.location.reload()}>刷新并载入恢复的数据</button>}
          <div className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>导出本机备份</span>
              <p className={`${styles.sectionDescription} mt-1`}>
                导出当前浏览器里的本机学习数据，适合迁移、离线留档或故障前备份。云端同步仍请使用 Wenyan 的“同步”页面。
              </p>
            </div>
            {progress(exportProgress)}
            <button className="wenyan-button-secondary" type="button" onClick={() => void onClickExport()} disabled={busy}>
              {isExporting ? '正在导出…' : exportProgress === 100 ? '再次导出' : '导出本机数据'}
            </button>
          </div>

          <div className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>导入本机备份</span>
              <p className={`${styles.sectionDescription} mt-1`}>从已有备份恢复当前浏览器的数据。</p>
            </div>
            <div className="wenyan-danger-note w-full rounded-[var(--wenyan-radius-sm)] px-3.5 py-3 text-xs leading-5 text-[var(--wenyan-ink-secondary)]">
              导入会完全覆盖当前浏览器里的本机数据。开始前建议先导出一次备份。
            </div>
            {progress(importProgress)}
            <button className="wenyan-button-danger" type="button" onClick={() => input.current?.click()} disabled={busy}>
              {isImporting ? '正在导入…' : importProgress === 100 ? '再次导入' : '选择备份并导入'}
            </button>
          </div>
        </div>
      </ScrollArea.Viewport>
    </ScrollArea.Root>
  )
}
