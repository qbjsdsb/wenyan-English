import styles from './index.module.css'
import type { ExportProgress, ImportProgress } from '@/utils/db/data-export'
import { exportDatabase, importDatabase } from '@/utils/db/data-export'
import * as Progress from '@radix-ui/react-progress'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useCallback, useState } from 'react'

export default function DataSetting() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const exportProgressCallback = useCallback(({ totalRows, completedRows, done }: ExportProgress) => {
    if (done) {
      setIsExporting(false)
      setExportProgress(100)
      return true
    }
    if (totalRows) setExportProgress(Math.floor((completedRows / totalRows) * 100))
    return true
  }, [])

  const onClickExport = useCallback(() => {
    setExportProgress(0)
    setIsExporting(true)
    exportDatabase(exportProgressCallback)
  }, [exportProgressCallback])

  const importProgressCallback = useCallback(({ totalRows, completedRows, done }: ImportProgress) => {
    if (done) {
      setIsImporting(false)
      setImportProgress(100)
      return true
    }
    if (totalRows) setImportProgress(Math.floor((completedRows / totalRows) * 100))
    return true
  }, [])

  const onStartImport = useCallback(() => {
    setImportProgress(0)
    setIsImporting(true)
  }, [])

  const onClickImport = useCallback(() => {
    importDatabase(onStartImport, importProgressCallback)
  }, [importProgressCallback, onStartImport])

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
          <div className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>导出本机备份</span>
              <p className={`${styles.sectionDescription} mt-1`}>
                导出当前浏览器里的本机学习数据，适合迁移、离线留档或故障前备份。云端同步仍请使用 Wenyan 的“同步”页面。
              </p>
            </div>
            {progress(exportProgress)}
            <button className="wenyan-button-secondary" type="button" onClick={onClickExport} disabled={isExporting}>
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
            <button className="wenyan-button-danger" type="button" onClick={onClickImport} disabled={isImporting}>
              {isImporting ? '正在导入…' : importProgress === 100 ? '再次导入' : '选择备份并导入'}
            </button>
          </div>
        </div>
      </ScrollArea.Viewport>
    </ScrollArea.Root>
  )
}
