import { useLearningOwner } from '@/hooks/useLearningOwner'
import { semanticRunPath } from '@/semantic/practice'
import { reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSetAtom } from 'jotai'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export async function endManualPractice(kind: 'semantic' | 'spelling', id: string | number, owner?: string) {
  if (owner !== getLocalLearningOwnerId()) throw new Error('账号已改变，请重新打开。')
  return db.transaction('rw', db.semanticRuns, db.reviewRecords, async () => {
    const run = kind === 'semantic' ? await db.semanticRuns.get(String(id)) : await db.reviewRecords.get(Number(id))
    if (!run || run.origin !== 'manual' || run.ownerUserId !== owner || owner !== getLocalLearningOwnerId())
      throw new Error('这段练习已不可用。')
    // End execution only. Keep every saved fact, and do not mark learning complete.
    if (kind === 'semantic') await db.semanticRuns.update(String(id), { endedAt: Date.now() })
    else await db.reviewRecords.update(Number(id), { endedAt: Date.now() })
  })
}

export default function PracticeResume({ dictionaryId }: { dictionaryId: string }) {
  const owner = useLearningOwner()
  const navigate = useNavigate()
  const setReview = useSetAtom(reviewModeInfoAtom)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const pending = useLiveQuery(async () => {
    const [semantic, spelling] = await Promise.all([
      db.semanticRuns
        .filter(
          (run) =>
            run.origin === 'manual' &&
            run.ownerUserId === owner &&
            run.dictionaryId === dictionaryId &&
            run.completedAt === undefined &&
            run.endedAt === undefined,
        )
        .toArray(),
      db.reviewRecords
        .filter(
          (run) =>
            run.origin === 'manual' &&
            run.ownerUserId === owner &&
            run.dict === dictionaryId &&
            !run.isFinished &&
            run.endedAt === undefined,
        )
        .toArray(),
    ])
    return [
      ...semantic.map((run) => ({
        id: run.id,
        kind: 'semantic' as const,
        title: run.mode === 'discrimination' ? '选择词义' : '词义回想',
        at: run.startedAt,
        detail: `已记录 ${run.index} / ${run.discriminationQuestions?.length ?? run.items.length} 次`,
        path: semanticRunPath(run),
      })),
      ...spelling.map((run) => ({
        id: run.id!,
        kind: 'spelling' as const,
        title: '专项拼写',
        at: run.createTime * 1000,
        detail: `继续第 ${Math.min(run.index + 1, run.words.length)} / ${run.words.length} 个词`,
        path: '/?practice=spelling',
      })),
    ].sort((a, b) => b.at - a.at)
  }, [dictionaryId, owner])
  const act = async (entry: NonNullable<typeof pending>[number], finish: boolean) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (owner !== getLocalLearningOwnerId()) throw new Error('账号已改变，请重新打开。')
      if (finish) await endManualPractice(entry.kind, entry.id, owner)
      else {
        if (entry.kind === 'spelling') {
          const record = await db.reviewRecords.get(Number(entry.id))
          if (!record || record.ownerUserId !== getLocalLearningOwnerId() || record.endedAt !== undefined || record.isFinished)
            throw new Error('进度已改变，请重新选择。')
          setReview({ isReviewMode: true, reviewRecord: record })
        }
        navigate(entry.path)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法操作，请重试。')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!pending?.length && !error) return null
  return (
    <section className="wenyan-practice-resume mb-7 px-5 py-4" aria-label="未完成的专项训练">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">接着上次的位置</h2>
        <span className="wenyan-muted text-xs">{pending?.length ?? 0} 段未结束</span>
      </div>
      <div className="mt-2 divide-y divide-[var(--wenyan-line-soft)]">
        {(expanded ? pending : pending?.slice(0, 1))?.map((entry) => (
          <div key={`${entry.kind}:${entry.id}`} className="flex flex-wrap items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm">{entry.title}</p>
              <p className="wenyan-muted mt-1 text-xs">
                {entry.detail} · {new Date(entry.at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                className="wenyan-button-secondary"
                disabled={busy}
                onClick={() => void act(entry, false)}
                aria-label={`继续${entry.title}`}
              >
                继续
              </button>
              <button
                className="wenyan-link text-xs"
                disabled={busy}
                onClick={() => void act(entry, true)}
                aria-label={`结束${entry.title}，保留记录`}
              >
                结束这段
              </button>
            </div>
          </div>
        ))}
      </div>
      {pending && pending.length > 1 && (
        <button className="wenyan-link mt-2 text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : `展开其余 ${pending.length - 1} 段`}
        </button>
      )}
      <p className="wenyan-muted mt-2 text-[11px]">结束只收起未完成进度，已经保存的练习记录会保留。</p>
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}
