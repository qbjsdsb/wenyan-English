import Header from '@/components/Header'
import PageHeading from '@/components/PageHeading'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { MAX_READING_PACK_BYTES, parseReadingPack } from '@/reading/pack'
import type { ReadingPack } from '@/reading/pack'
import { exportReadingPacks, importReadingPack, listPrivateReadingPassages, listReadingPassages, readingPath } from '@/reading/repository'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { useLiveQuery } from 'dexie-react-hooks'
import { saveAs } from 'file-saver'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function ReadingLibraryPage() {
  const owner = useLearningOwner()
  return <ReadingLibrary key={owner ?? 'anonymous'} owner={owner} />
}

function ReadingLibrary({ owner }: { owner?: string }) {
  const [query, setQuery] = useState('')
  const [paper, setPaper] = useState('all')
  const [year, setYear] = useState('all')
  const [preview, setPreview] = useState<ReadingPack>()
  const [exports, setExports] = useState<ReadingPack[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const action = useRef(false)
  const fileGeneration = useRef(0)
  const catalog = useLiveQuery(async () => {
    try { return { rows: await listPrivateReadingPassages(owner), error: '' } }
    catch { return { rows: [], error: '本机题库暂时无法读取，请重试或从备份恢复。' } }
  }, [owner])
  const rows = catalog?.rows ?? []
  const years = Array.from(new Set(rows.flatMap((row) => row.passage.exam ? [row.passage.exam.year] : []))).sort((a, b) => b - a)
  const visible = rows.filter(({ passage }) =>
    (paper === 'all' || passage.exam?.paper === paper) &&
    (year === 'all' || String(passage.exam?.year) === year) &&
    `${passage.title} ${passage.source.label} ${passage.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )

  const selectFile = async (file?: File) => {
    const request = ++fileGeneration.current
    setPreview(undefined)
    setMessage('')
    if (!file) return
    try {
      if (file.size > MAX_READING_PACK_BYTES) throw new Error('题包超过 8 MB，请按年份拆分后导入。')
      const next = parseReadingPack(await file.text())
      if (request !== fileGeneration.current || owner !== getLocalLearningOwnerId()) return
      setPreview(next)
    } catch (cause) {
      if (request === fileGeneration.current && owner === getLocalLearningOwnerId()) setMessage(cause instanceof Error ? cause.message : '无法读取题包。')
    }
  }

  const importPack = async () => {
    if (!preview || action.current || owner !== getLocalLearningOwnerId()) return
    action.current = true
    setBusy(true)
    try {
      const result = await importReadingPack(JSON.stringify(preview), owner)
      if (owner !== getLocalLearningOwnerId()) return
      setMessage(`已导入 ${result.added} 篇，${result.unchanged} 篇内容相同，已保留原有版本。`)
      setPreview(undefined)
      setExports([])
    } catch (cause) {
      if (owner === getLocalLearningOwnerId()) setMessage(cause instanceof Error ? cause.message : '导入失败，原有题库未变。')
    } finally { action.current = false; setBusy(false) }
  }

  const exportPacks = async () => {
    if (action.current || owner !== getLocalLearningOwnerId()) return
    action.current = true
    setBusy(true)
    try {
      const packs = await exportReadingPacks(owner)
      if (owner === getLocalLearningOwnerId()) {
        setExports(packs)
        setMessage('导出文件已准备好，点击下方下载。仅含题目，不含学习记录。')
      }
    } catch (cause) {
      if (owner === getLocalLearningOwnerId()) setMessage(cause instanceof Error ? cause.message : '暂时无法导出。')
    } finally { action.current = false; setBusy(false) }
  }

  return (
    <div className="min-h-screen text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-10">
        <PageHeading title="阅读题库" description="按篇练习，完整作答，再回到原文复盘。">
          <Link to="/reading/history" className="wenyan-link text-sm">阅读记录</Link>
          <Link to="/today" className="wenyan-link text-sm">回到今天</Link>
        </PageHeading>
        <section aria-label="我的阅读资料" className="mt-8 border-y border-[var(--wenyan-line-soft)] py-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="wenyan-button-secondary cursor-pointer">
              导入题包
              <input type="file" accept=".json,application/json" disabled={busy} className="sr-only"
                onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = '' }} />
            </label>
            <button type="button" className="wenyan-link text-xs" onClick={() => {
              const sample = listReadingPassages()[0]
              const pack = { format: 'wenyan-reading-pack', schemaVersion: 1, title: 'Wenyan 阅读题包示例', passages: [{
                ...sample, id: 'example-reading-01', source: { kind: 'private-import', label: 'Wenyan 原创演示文章，并非考试真题' },
              }] }
              saveAs(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }), 'wenyan-reading-example.json')
            }}>下载示例题包</button>
            <button type="button" className="wenyan-button-secondary" disabled={busy || rows.length === 0} onClick={() => void exportPacks()}>导出题库</button>
            <span className="wenyan-muted text-xs">当前账号 · 本机保存 · 不自动同步正文</span>
          </div>
          <p className="wenyan-muted mt-3 text-xs leading-6">支持 Wenyan 阅读 JSON 题包。ESQ 题源需先转换；导入不会创建学习记录或改变学习计划。</p>
          {message && <p role="status" className="mt-3 text-sm">{message}</p>}
          {preview && (
            <div className="mt-4 border-l-2 border-[var(--wenyan-accent)] pl-4">
              <p className="text-sm font-medium">{preview.title}</p>
              <p className="wenyan-muted mt-1 text-xs">{preview.passages.length} 篇 · {preview.passages.reduce((sum, passage) => sum + passage.questions.length, 0)} 题 · 答案随题包导入，尚未经独立核对</p>
              <div className="mt-3 flex gap-3">
                <button type="button" className="wenyan-button-primary" disabled={busy} onClick={() => void importPack()}>{busy ? '正在导入…' : '加入我的题库'}</button>
                <button type="button" className="wenyan-button-secondary" disabled={busy} onClick={() => setPreview(undefined)}>取消</button>
              </div>
            </div>
          )}
          {exports.length > 0 && <div className="mt-3 flex flex-wrap gap-3">{exports.map((pack, index) => (
            <button key={index} type="button" className="wenyan-link text-xs" onClick={() => {
              if (owner !== getLocalLearningOwnerId()) return
              saveAs(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }), `wenyan-reading-${index + 1}.json`)
            }}>下载题包 {index + 1}（{pack.passages.length} 篇）</button>
          ))}</div>}
        </section>
        <div className="my-6 flex flex-wrap gap-3">
          <input aria-label="搜索阅读" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索篇目或来源"
            className="min-w-0 flex-1 rounded-md border-[var(--wenyan-line)] bg-[var(--wenyan-paper)] text-sm" />
          <select aria-label="试卷" value={paper} onChange={(event) => setPaper(event.target.value)} className="rounded-md border-[var(--wenyan-line)] bg-[var(--wenyan-paper)] text-sm">
            <option value="all">全部试卷</option><option value="english-1">英语一</option><option value="english-2">英语二</option>
          </select>
          <select aria-label="年份" value={year} onChange={(event) => setYear(event.target.value)} className="rounded-md border-[var(--wenyan-line)] bg-[var(--wenyan-paper)] text-sm">
            <option value="all">全部年份</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        {!catalog ? <p role="status" className="wenyan-muted py-8 text-sm">正在读取本机题库…</p> : catalog.error ? <p role="alert">{catalog.error}</p> : visible.length === 0 ? (
          <p className="wenyan-muted py-8 text-sm">{rows.length ? '没有匹配的篇目，试试其他筛选条件。' : '还没有导入阅读资料。你也可以先用下方演示篇目熟悉流程。'}</p>
        ) : <div>{visible.map(({ key, passage }) => (
          <article key={key} className="flex items-center justify-between gap-6 border-b border-[var(--wenyan-line-soft)] py-5">
            <div className="min-w-0">
              <h2 className="text-base font-medium">{passage.title}</h2>
              <p className="wenyan-muted mt-2 text-xs">{passage.exam ? `${passage.exam.year} · ${passage.exam.paper === 'english-1' ? '英语一' : '英语二'} · ` : ''}{passage.questions.length} 题 · 约 {passage.estimatedMinutes} 分钟 · 版本 {passage.version}</p>
              <p className="wenyan-muted mt-1 text-xs">{passage.source.label}</p>
            </div>
            <Link to={readingPath(passage)} className="wenyan-button-secondary shrink-0 no-underline">打开阅读</Link>
          </article>
        ))}</div>}
        <details className="mt-10 border-t border-[var(--wenyan-line-soft)] pt-5 text-sm">
          <summary className="wenyan-muted cursor-pointer">体验阅读流程 · 演示内容</summary>
          {listReadingPassages().map((passage) => <Link key={passage.id} to={readingPath(passage)} className="wenyan-link mt-4 block">{passage.title} · {passage.questions.length} 题</Link>)}
        </details>
      </main>
    </div>
  )
}
