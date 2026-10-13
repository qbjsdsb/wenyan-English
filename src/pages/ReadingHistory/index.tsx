import Header from '@/components/Header'
import PageHeading from '@/components/PageHeading'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { listReadingHistory } from '@/reading/history'
import { listPrivateReadingPassages, listReadingPassages, readingPath } from '@/reading/repository'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ReadingHistoryPage() {
  const owner = useLearningOwner()
  return <ReadingHistory key={owner ?? 'anonymous'} owner={owner} />
}

function ReadingHistory({ owner }: { owner?: string }) {
  const [missedOnly, setMissedOnly] = useState(false)
  const [limit, setLimit] = useState(30)
  const data = useLiveQuery(async () => {
    try {
      const [history, imported] = await Promise.all([listReadingHistory(owner), listPrivateReadingPassages(owner)])
      const catalog = new Map([...listReadingPassages(), ...imported.map((row) => row.passage)]
        .map((passage) => [JSON.stringify([passage.id, passage.version]), passage]))
      return { history, catalog, error: '' }
    } catch { return { history: [], catalog: new Map(), error: '阅读记录暂时无法读取，请稍后重新打开。' } }
  }, [owner])
  const filtered = data?.history.filter((entry) => !missedOnly || entry.correctCount < entry.questionCount) ?? []
  return (
    <div className="min-h-screen text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-10">
        <PageHeading title="阅读记录" description="从实际提交的答案回看每一篇。查看复盘不会增加练习次数。">
          <Link to="/reading" className="wenyan-link text-sm">返回题库</Link>
        </PageHeading>
        <div className="my-7 flex items-center justify-between gap-5 border-y border-[var(--wenyan-line-soft)] py-4">
          <span className="wenyan-muted text-xs">当前账号 · 本机已保存或已同步的记录</span>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={missedOnly} onChange={(event) => { setMissedOnly(event.target.checked); setLimit(30) }} />仅看有错题或未答的练习</label>
        </div>
        {!data ? <p role="status">正在读取记录…</p> : data.error ? <p role="alert">{data.error}</p> : filtered.length === 0 ? (
          <p className="wenyan-muted py-8 text-sm">{missedOnly ? '当前没有符合条件的记录。' : '还没有提交过阅读练习。完成一篇后，可以在这里继续复盘。'}</p>
        ) : filtered.slice(0, limit).map((entry) => {
          const passage = data.catalog.get(JSON.stringify([entry.passageId, entry.passageVersion]))
          return (
            <article key={entry.attemptId} className="flex flex-wrap items-center justify-between gap-5 border-b border-[var(--wenyan-line-soft)] py-5">
              <div className="min-w-0">
                <h2 className="text-base font-medium">{passage?.title ?? entry.passageId}</h2>
                <p className="wenyan-muted mt-2 text-xs">{new Date(entry.occurredAt).toLocaleString('zh-CN')} · 版本 {entry.passageVersion}</p>
                <p className="mt-2 text-sm">答对 {entry.correctCount} · 答错 {entry.answeredCount - entry.correctCount} · 未答 {entry.questionCount - entry.answeredCount}</p>
                {!passage && <p className="wenyan-muted mt-2 text-xs">本机缺少这个版本的题目，重新导入对应题包后可复盘。学习记录仍保留。</p>}
              </div>
              {passage && <div className="flex items-center gap-4">
                <Link to={`${readingPath(passage)}&attempt=${encodeURIComponent(entry.attemptId)}`} className="wenyan-button-secondary no-underline">复盘</Link>
                <Link to={readingPath(passage)} className="wenyan-link text-xs">打开练习</Link>
              </div>}
            </article>
          )
        })}
        {filtered.length > limit && <button type="button" className="wenyan-button-secondary mt-6" onClick={() => setLimit((count) => count + 30)}>再显示 30 条</button>}
      </main>
    </div>
  )
}
