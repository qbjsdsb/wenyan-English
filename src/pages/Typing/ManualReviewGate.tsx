import Header from '@/components/Header'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { isOwnerBoundReviewForOwner, isOwnerBoundReviewOrigin, ownerBoundReviewReturnPath } from '@/review/execution'
import { reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { db } from '@/utils/db'
import { useAtom } from 'jotai'
import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/** Restore owner-bound review execution before mounting the input engine. UI storage is never the authoritative cursor. */
export default function ManualReviewGate({ children }: PropsWithChildren) {
  const [review, setReview] = useAtom(reviewModeInfoAtom)
  const owner = useLearningOwner()
  const candidateOrigin = review.isReviewMode ? review.reviewRecord?.origin : undefined
  const origin = isOwnerBoundReviewOrigin(candidateOrigin) ? candidateOrigin : undefined
  const id = origin ? review.reviewRecord?.id : undefined
  const key = origin ? JSON.stringify([owner ?? null, origin, id ?? null]) : ''
  const [ready, setReady] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    if (!origin) return
    setReady('')
    if (id === undefined) {
      setError('这段练习缺少已保存的进度标识，不能安全继续。已完成的学习记录不受影响。')
      return
    }
    setError('')
    void (async () => {
      try {
        const record = await db.reviewRecords.get(id)
        if (!active || owner !== getLocalLearningOwnerId()) return
        if (!isOwnerBoundReviewForOwner(record, owner) || record.origin !== origin)
          throw new Error('这段练习不属于当前账号，或已经不可用。')
        if (record.isFinished || record.endedAt !== undefined)
          throw new Error('这一段已经结束。已保存的练习记录仍然保留。')
        setReview({ isReviewMode: true, reviewRecord: record })
        setReady(key)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '暂时无法读取进度，请重试。')
      }
    })()
    return () => {
      active = false
    }
  }, [id, key, origin, owner, retry, setReview])
  if (!origin || ready === key) return <>{children}</>
  const returnPath = ownerBoundReviewReturnPath(origin)
  const returnLabel = origin === 'smart' ? '回到今天' : origin === 'correction' ? '回到错词' : '回到专项训练'
  return (
    <div className="wenyan-studio-shell min-h-screen text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-20">
        <section className="wenyan-surface p-7" role={error ? 'alert' : 'status'}>
          <h1 className="text-xl font-medium">{error ? '找回练习位置' : '正在接上刚才的位置…'}</h1>
          <p className="wenyan-muted mt-3 text-sm leading-6">{error || '读取本机已保存的进度。'} </p>
          {error && (
            <div className="mt-5 flex gap-4">
              {id !== undefined && (
                <button className="wenyan-button-secondary" onClick={() => setRetry((value) => value + 1)}>
                  重新读取
                </button>
              )}
              <Link className="wenyan-button-primary" to={returnPath}>
                {returnLabel}
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
