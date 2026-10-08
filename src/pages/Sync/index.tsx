import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { getWenyanRedirectUrl, supabase } from '@/supabase/client'
import { type LearningQueueSummary, claimUnownedLearningEvents, getLearningQueueSummary } from '@/sync/learningQueue'
import { type LearningDataSyncResult, syncLearningData } from '@/sync/syncLearningEvents'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

function describeResult(result: LearningDataSyncResult) {
  const parts: string[] = []
  if (result.upload.status === 'synced') parts.push(`上传 ${result.upload.synced} 条`)
  if (result.upload.status === 'failed') parts.push(`上传失败：${result.upload.message}`)
  if (result.download.status === 'pulled') parts.push(`恢复 ${result.download.inserted} 条`)
  if (result.download.status === 'failed') parts.push(`恢复失败：${result.download.message}`)
  if (result.upload.status === 'signed-out' || result.download.status === 'signed-out') return '登录后即可同步。'
  return parts.length > 0 ? parts.join(' · ') : '已是最新状态。'
}

const emptySummary: LearningQueueSummary = { currentAccount: 0, unclaimed: 0, otherAccount: 0, readyNow: 0 }
const secondaryButton = 'rounded-lg border border-black/[0.09] px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/[0.1] dark:text-gray-400 dark:hover:bg-white/[0.04]'
const primaryButton = 'rounded-lg bg-[#1d1d1b] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50 dark:bg-[#eeeeea] dark:text-[#111210] dark:hover:bg-white'

export default function SyncPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [queue, setQueue] = useState<LearningQueueSummary>(emptySummary)
  const [busy, setBusy] = useState(false)

  const refreshQueue = useCallback(async (userId?: string) => {
    setQueue(await getLearningQueueSummary(userId))
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void refreshQueue(data.session?.user.id)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void refreshQueue(nextSession?.user.id)
    })
    return () => data.subscription.unsubscribe()
  }, [refreshQueue])

  const sendMagicLink = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false, emailRedirectTo: getWenyanRedirectUrl() },
    })
    setBusy(false)
    setMessage(error ? `发送失败：${error.message}` : '登录链接已发送到邮箱。')
  }

  const claimLocalHistory = async () => {
    if (!session) return
    setBusy(true)
    try {
      const claimed = await claimUnownedLearningEvents(session.user.id)
      await refreshQueue(session.user.id)
      setMessage(claimed ? `已认领 ${claimed} 条本机记录。` : '没有需要认领的记录。')
    } catch (error) {
      setMessage(`认领失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async () => {
    setBusy(true)
    const result = await syncLearningData()
    await refreshQueue(session?.user.id)
    setMessage(describeResult(result))
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    const { error } = await supabase.auth.signOut()
    setMessage(error ? `退出失败：${error.message}` : '已退出登录。')
    if (!error) await refreshQueue()
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen flex-col text-gray-900 dark:text-gray-100">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-gray-950 dark:text-gray-100">同步</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">学习记录在设备之间保持一致</p>
        </div>

        {session ? (
          <section className="border-y border-black/[0.08] dark:border-white/[0.09]">
            <div className="flex items-center justify-between gap-5 border-b border-black/[0.06] py-5 dark:border-white/[0.07]">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-600">当前账号</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-200">{session.user.email ?? '已登录'}</p>
              </div>
              <button className={secondaryButton} disabled={busy} onClick={signOut}>退出</button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-black/[0.06] py-6 dark:divide-white/[0.07]">
              {[
                ['待上传', queue.currentAccount],
                ['未归属', queue.unclaimed],
                ['其他账号', queue.otherAccount],
              ].map(([label, value]) => (
                <div key={label} className="px-5 first:pl-0 last:pr-0">
                  <p className="text-xs text-gray-400 dark:text-gray-600">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-950 dark:text-gray-100">{value}</p>
                </div>
              ))}
            </div>

            {queue.unclaimed > 0 && (
              <div className="border-t border-amber-200/70 py-5 text-sm dark:border-amber-900/50">
                <p className="text-amber-800 dark:text-amber-300">有 {queue.unclaimed} 条本机记录还没有账号归属。</p>
                <button className={`${secondaryButton} mt-3`} disabled={busy} onClick={claimLocalHistory}>认领到当前账号</button>
              </div>
            )}

            <div className="flex items-center justify-between gap-5 border-t border-black/[0.06] py-5 dark:border-white/[0.07]">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">云端学习记录</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">上传本机新记录，并恢复云端缺失记录</p>
              </div>
              <button className={primaryButton} disabled={busy} onClick={syncNow}>{busy ? '同步中…' : '立即同步'}</button>
            </div>
          </section>
        ) : (
          <section className="border-y border-black/[0.08] py-6 dark:border-white/[0.09]">
            <label className="mb-2 block text-sm font-medium" htmlFor="wenyan-sync-email">邮箱</label>
            <div className="flex gap-3">
              <input
                id="wenyan-sync-email"
                className="min-w-0 flex-1 rounded-lg border border-black/[0.1] bg-transparent px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-gray-500 dark:border-white/[0.12] dark:focus:border-gray-500"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className={primaryButton} disabled={busy || !email.trim()} onClick={sendMagicLink}>发送登录链接</button>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-600">仅登录已有账号，不会自动创建新用户。</p>
          </section>
        )}

        {message && <p role="status" className="mt-5 text-sm text-gray-600 dark:text-gray-400">{message}</p>}

        <details className="mt-10 border-t border-black/[0.06] pt-4 text-xs text-gray-400 dark:border-white/[0.07] dark:text-gray-600">
          <summary className="cursor-pointer select-none text-gray-500 dark:text-gray-500">同步说明</summary>
          <div className="mt-3 space-y-2 leading-6">
            <p>学习事件先保存在本机；登录后只上传明确归属于当前账号的记录。未归属记录需要你手动认领。</p>
            <p>云端恢复使用独立游标，重复同步不会复制同一事件。旧 Qwerty 设置、当前词书位置和 legacy 错词表暂不跨设备恢复。</p>
          </div>
        </details>
      </main>
      <Footer />
    </div>
  )
}
