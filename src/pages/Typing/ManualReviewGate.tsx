import Header from '@/components/Header'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import { useAtom } from 'jotai'
import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/** Restore once on entry, before mounting the input engine. UI storage is never the authoritative cursor. */
export default function ManualReviewGate({ children }: PropsWithChildren) {
  const [review, setReview] = useAtom(reviewModeInfoAtom)
  const owner = useLearningOwner()
  const id = review.isReviewMode && review.reviewRecord?.origin === 'manual' ? review.reviewRecord.id : undefined
  const key = id === undefined ? '' : JSON.stringify([owner ?? null, id])
  const [ready, setReady] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    if (id === undefined) return
    setError('')
    setReady('')
    void (async () => {
      try {
        const record = await db.reviewRecords.get(id)
        if (!active || owner !== getLocalLearningOwnerId()) return
        if (!record || record.origin !== 'manual' || record.ownerUserId !== owner) throw new Error('这段练习不属于当前账号，或已经不可用。')
        if (record.isFinished || record.endedAt !== undefined)
          throw new Error('这一段已经结束。已保存的练习记录仍然保留，可以回到专项训练开始下一段。')
        setReview({ isReviewMode: true, reviewRecord: record })
        setReady(key)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '暂时无法读取进度，请重试。')
      }
    })()
    return () => {
      active = false
    }
  }, [id, key, owner, retry, setReview])
  if (!key || ready === key) return <>{children}</>
  return (
    <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-20">
        <section className="wenyan-surface p-7" role={error ? 'alert' : 'status'}>
          <h1 className="text-xl font-medium">{error ? '找回练习位置' : '正在接上刚才的位置…'}</h1>
          <p className="wenyan-muted mt-3 text-sm leading-6">{error || '读取本机已保存的进度。'} </p>
          {error && (
            <div className="mt-5 flex gap-4">
              <button className="wenyan-button-secondary" onClick={() => setRetry((value) => value + 1)}>
                重新读取
              </button>
              <Link className="wenyan-button-primary" to="/practice">
                回到专项训练
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
