import Header from '@/components/Header'
import { getWenyanRedirectUrl, supabase } from '@/supabase/client'
import { claimUnownedLearningEvents, getLearningQueueSummary, type LearningQueueSummary } from '@/sync/learningQueue'
import { type LearningSyncResult, syncLearningEvents } from '@/sync/syncLearningEvents'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

function describeResult(result: LearningSyncResult) {
  switch (result.status) {
    case 'signed-out':
      return '登录后即可同步学习记录。'
    case 'idle':
      return '当前账号没有到期可重试的学习记录。'
    case 'synced':
      return `已同步 ${result.synced} 条学习记录。`
    case 'failed':
      return `同步失败：${result.message}`
  }
}

const emptySummary: LearningQueueSummary = { currentAccount: 0, unclaimed: 0, otherAccount: 0, readyNow: 0 }

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
      options: {
        shouldCreateUser: false,
        emailRedirectTo: getWenyanRedirectUrl(),
      },
    })
    setBusy(false)
    setMessage(error ? `发送失败：${error.message}` : '登录链接已发送到邮箱。打开邮件中的链接即可完成登录。')
  }

  const claimLocalHistory = async () => {
    if (!session) return
    setBusy(true)
    try {
      const claimed = await claimUnownedLearningEvents(session.user.id)
      await refreshQueue(session.user.id)
      setMessage(claimed ? `已将 ${claimed} 条未归属记录认领到当前账号。现在可以同步。` : '没有需要认领的本机记录。')
    } catch (error) {
      setMessage(`认领失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async () => {
    setBusy(true)
    const result = await syncLearningEvents()
    await refreshQueue(session?.user.id)
    setMessage(describeResult(result))
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    const { error } = await supabase.auth.signOut()
    setMessage(error ? `退出失败：${error.message}` : '已退出云同步。本地学习记录仍然保留。')
    if (!error) await refreshQueue()
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-indigo-500">Wenyan Cloud</p>
          <h2 className="text-3xl font-semibold">学习记录同步</h2>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
            背词始终先写入本机 IndexedDB。登录后只会上传明确归属于当前账号的待同步事件；网络断开不会影响正常学习。
          </p>
        </div>

        <section className="my-card rounded-2xl bg-white p-6 dark:bg-gray-800">
          {session ? (
            <div className="space-y-5">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">当前账号</div>
                <div className="mt-1 font-medium">{session.user.email ?? '已登录'}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400">当前账号待同步</div>
                  <div className="mt-1 text-2xl font-semibold">{queue.currentAccount}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400">未归属本机记录</div>
                  <div className="mt-1 text-2xl font-semibold">{queue.unclaimed}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400">其他账号记录</div>
                  <div className="mt-1 text-2xl font-semibold">{queue.otherAccount}</div>
                </div>
              </div>

              {queue.unclaimed > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <p>这些记录是在没有明确账号归属时保存在本机的。Wenyan 不会自动把它们发送给任何账号。</p>
                  <button className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium dark:border-amber-800" disabled={busy} onClick={claimLocalHistory}>
                    认领到当前账号并允许同步
                  </button>
                </div>
              )}

              {queue.otherAccount > 0 && (
                <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                  另有 {queue.otherAccount} 条待同步记录属于别的账号，当前账号不会上传它们。
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button className="my-btn-primary" disabled={busy || queue.readyNow === 0} onClick={syncNow}>
                  立即同步{queue.readyNow > 0 ? ` ${queue.readyNow} 条` : ''}
                </button>
                <button className="my-btn-secondary" disabled={busy} onClick={signOut}>
                  退出登录
                </button>
              </div>
              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                同步失败会逐步延长重试间隔，最长约 15 分钟；重新联网时会立即再检查。服务端仍通过 Supabase Auth + RLS 校验真实账号所有权。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="wenyan-sync-email">
                  登录邮箱
                </label>
                <input
                  id="wenyan-sync-email"
                  className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 outline-none focus:border-indigo-400 dark:border-gray-700"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <button className="my-btn-primary" disabled={busy || !email.trim()} onClick={sendMagicLink}>
                发送登录链接
              </button>
              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                这里只允许已有账号登录，不会因为输错邮箱而自动创建新用户。未登录期间产生的新记录会先保持“未归属”，登录后由你决定是否认领。
              </p>
            </div>
          )}
          {message && <div className="mt-5 rounded-xl bg-gray-100 px-4 py-3 text-sm dark:bg-gray-700">{message}</div>}
        </section>
      </main>
    </div>
  )
}
