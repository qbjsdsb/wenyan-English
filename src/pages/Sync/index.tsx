import { LoadingUI } from '@/components/Loading'
import Header from '@/components/Header'
import { idDictionaryMap } from '@/resources/dictionary'
import { readPracticeChoices, savePracticeChoices } from '@/semantic/practiceChoices'
import { currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import { getWenyanRedirectUrl, supabase } from '@/supabase/client'
import { type LearningQueueSummary, claimUnownedLearningEvents, getLearningQueueSummary } from '@/sync/learningQueue'
import { type LearningDataSyncResult, syncLearningData } from '@/sync/syncLearningEvents'
import { getWorkspaceState, saveWorkspaceState, workspaceStateInput, type WorkspaceState } from '@/sync/workspaceState'
import type { Session } from '@supabase/supabase-js'
import { useAtom, useSetAtom } from 'jotai'
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

function practiceModeLabel(mode: WorkspaceState['practiceMode']) {
  if (mode === 'spelling') return '拼写'
  if (mode === 'discrimination') return '选择词义'
  return '词义回想'
}

function practicePoolLabel(pool: WorkspaceState['practicePool']) {
  if (pool === 'chapter') return '当前章节'
  if (pool === 'learned') return '已经练过'
  if (pool === 'errors') return '拼写错词'
  return '词义模糊'
}

function describeWorkspace(state: WorkspaceState | undefined) {
  if (!state) return '还没有保存过云端位置'
  const dict = idDictionaryMap[state.dictId]
  const dictName = dict?.name ?? state.dictId
  const amount = state.practicePool === 'chapter' ? '' : ` · 每段 ${state.practiceLimit}`
  return `${dictName} · 第 ${state.chapterIndex + 1} 章 · ${practiceModeLabel(state.practiceMode)} · ${practicePoolLabel(state.practicePool)}${amount}`
}

const emptySummary: LearningQueueSummary = { currentAccount: 0, unclaimed: 0, otherAccount: 0, readyNow: 0 }

export default function SyncPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [queue, setQueue] = useState<LearningQueueSummary>(emptySummary)
  const [busy, setBusy] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [cloudWorkspace, setCloudWorkspace] = useState<WorkspaceState>()
  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const setReview = useSetAtom(reviewModeInfoAtom)

  const refreshQueue = useCallback(async (userId?: string) => {
    setQueue(await getLearningQueueSummary(userId))
  }, [])

  const refreshWorkspace = useCallback(async (signedIn: boolean) => {
    if (!signedIn) {
      setCloudWorkspace(undefined)
      return
    }
    setWorkspaceLoading(true)
    try {
      setCloudWorkspace(await getWorkspaceState())
    } catch (error) {
      setMessage(`云端学习位置暂时无法读取：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setWorkspaceLoading(false)
    }
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
      void refreshQueue(data.session?.user.id)
      void refreshWorkspace(Boolean(data.session))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
      void refreshQueue(nextSession?.user.id)
      void refreshWorkspace(Boolean(nextSession))
    })
    return () => data.subscription.unsubscribe()
  }, [refreshQueue, refreshWorkspace])

  const sendMagicLink = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false, emailRedirectTo: getWenyanRedirectUrl() },
      })
      setMessage(error ? `发送失败：${error.message}` : '登录链接已发送到邮箱。')
    } catch { setMessage('发送失败，请检查网络后重试。本机学习不受影响。') }
    finally { setBusy(false) }
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
    setMessage('')
    try {
      const result = await syncLearningData()
      await refreshQueue(session?.user.id)
      setMessage(describeResult(result))
    } catch { setMessage('同步暂未完成，请稍后重试。本机已保存的记录仍然保留。') }
    finally { setBusy(false) }
  }

  const publishWorkspace = async () => {
    if (!session || busy) return
    setBusy(true)
    setMessage('')
    try {
      const dict = idDictionaryMap[currentDictId]
      if (!dict || currentChapter < 0 || currentChapter >= dict.chapterCount) throw new Error('当前词书位置无效，请先重新选择章节。')
      const choices = readPracticeChoices(session.user.id)
      const saved = await saveWorkspaceState(workspaceStateInput(currentDictId, currentChapter, choices))
      setCloudWorkspace(saved)
      setMessage('本机学习位置已保存到云端。学习事实没有被改写。')
    } catch (error) {
      setMessage(`保存学习位置失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const restoreWorkspace = async () => {
    if (!session || !cloudWorkspace || busy) return
    setBusy(true)
    setMessage('')
    try {
      const dict = idDictionaryMap[cloudWorkspace.dictId]
      if (!dict) throw new Error('云端位置使用了当前版本不认识的词书。')
      if (cloudWorkspace.chapterIndex < 0 || cloudWorkspace.chapterIndex >= dict.chapterCount) {
        throw new Error('云端章节已经超出当前词书范围。')
      }
      setReview({ isReviewMode: false, reviewRecord: undefined })
      setCurrentDictId(cloudWorkspace.dictId)
      setCurrentChapter(cloudWorkspace.chapterIndex)
      savePracticeChoices({
        mode: cloudWorkspace.practiceMode,
        pool: cloudWorkspace.practicePool,
        limit: cloudWorkspace.practiceLimit,
      }, session.user.id)
      setMessage('云端学习位置已恢复到这台设备。历史学习事实没有变化。')
    } catch (error) {
      setMessage(`恢复学习位置失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      setMessage(error ? `退出失败：${error.message}` : '已退出登录。')
      if (!error) {
        await refreshQueue()
        setCloudWorkspace(undefined)
      }
    } catch { setMessage('退出暂未完成，请检查网络后重试。') }
    finally { setBusy(false) }
  }

  const settled = Boolean(message && !message.includes('失败') && !message.includes('登录后') && !message.includes('暂时无法'))
  const localDict = idDictionaryMap[currentDictId]
  const localWorkspaceLabel = `${localDict?.name ?? currentDictId} · 第 ${currentChapter + 1} 章`

  return (
    <div className="wenyan-studio-shell flex min-h-screen flex-col text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-9">
        <div className="mb-7">
          <h1 className="wenyan-page-title">同步</h1>
          <p className="wenyan-muted mt-2 text-sm">让真实学习事实在设备之间保持一致</p>
        </div>

        {!authReady ? (
          <section className="wenyan-surface flex min-h-[210px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <LoadingUI label="正在确认登录状态" />
              <p className="wenyan-muted text-[11px]">正在确认登录状态</p>
            </div>
          </section>
        ) : session ? (
          <section className={`wenyan-sync-surface ${busy ? 'is-busy' : ''} overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]`}>
            <div className="relative z-[1] flex items-center justify-between gap-5 border-b border-[var(--wenyan-line-soft)] px-5 py-5">
              <div>
                <p className="wenyan-muted text-[10px]">当前账号</p>
                <p className="mt-1 text-sm font-medium text-[var(--wenyan-ink)]">{session.user.email ?? '已登录'}</p>
              </div>
              <button className="wenyan-button-secondary" disabled={busy} onClick={signOut}>退出</button>
            </div>

            <div className="relative z-[1] grid grid-cols-3 divide-x divide-[var(--wenyan-line-soft)] px-5 py-6">
              {[
                ['待上传', queue.currentAccount],
                ['未归属', queue.unclaimed],
                ['其他账号', queue.otherAccount],
              ].map(([label, value], index) => (
                <div key={label} className="px-5 first:pl-0 last:pr-0">
                  <p className="wenyan-muted text-[10px]">{label}</p>
                  <p className="wenyan-metric-value mt-2 text-xl font-semibold tabular-nums text-[var(--wenyan-ink)]" style={{ animationDelay: `${index * 45}ms` }}>{value}</p>
                </div>
              ))}
            </div>

            {queue.unclaimed > 0 && (
              <div className="relative z-[1] border-t border-[color-mix(in_srgb,var(--wenyan-danger)_20%,var(--wenyan-line-soft))] px-5 py-5 text-sm">
                <p className="text-[var(--wenyan-danger)]">有 {queue.unclaimed} 条本机记录还没有账号归属。</p>
                <button className="wenyan-button-secondary mt-3" disabled={busy} onClick={claimLocalHistory}>认领到当前账号</button>
              </div>
            )}

            <div className="relative z-[1] flex items-center justify-between gap-5 border-t border-[var(--wenyan-line-soft)] px-5 py-5">
              <div>
                <p className="text-sm font-medium text-[var(--wenyan-ink)]">云端学习事实</p>
                <p className="wenyan-muted mt-1 text-xs">上传本机新事实，并恢复云端缺失事实</p>
              </div>
              <button className="wenyan-button-primary" disabled={busy} onClick={syncNow}>{busy ? '同步中…' : '立即同步'}</button>
            </div>

            <div className="relative z-[1] border-t border-[var(--wenyan-line-soft)] px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--wenyan-ink)]">学习位置</p>
                  <p className="wenyan-muted mt-1 text-xs leading-5">本机：{localWorkspaceLabel}</p>
                  <p className="wenyan-muted mt-1 text-xs leading-5">
                    云端：{workspaceLoading ? '正在读取…' : describeWorkspace(cloudWorkspace)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button className="wenyan-button-secondary" disabled={busy || workspaceLoading} onClick={publishWorkspace}>保存本机位置</button>
                  <button className="wenyan-button-secondary" disabled={busy || workspaceLoading || !cloudWorkspace} onClick={restoreWorkspace}>恢复云端位置</button>
                </div>
              </div>
              <p className="wenyan-muted mt-3 text-[11px] leading-5">位置只包含当前词书、章节和专项选择。需要你明确保存或恢复，不会自动让一台设备覆盖另一台，也不会生成学习事实。</p>
            </div>
          </section>
        ) : (
          <section className="wenyan-surface p-6">
            <h2 className="mb-2 text-lg font-medium">让学习记录随你回来</h2>
            <p className="wenyan-muted mb-6 text-sm leading-6">登录后同步已有学习事实；暂不登录，也可以继续在本机学习。</p>
            <form onSubmit={(event) => { event.preventDefault(); if (!busy) void sendMagicLink() }}>
            <label className="mb-2 block text-sm font-medium" htmlFor="wenyan-sync-email">邮箱</label>
            <div className="flex gap-3">
              <input
                id="wenyan-sync-email"
                className="wenyan-input min-w-0 flex-1 px-3.5 text-sm outline-none"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className="wenyan-button-primary" type="submit" disabled={busy || !email.trim()}>{busy ? '发送中…' : '发送登录链接'}</button>
            </div>
            </form>
            <p className="wenyan-muted mt-3 text-xs">仅登录已有账号，不会自动创建新用户。</p>
          </section>
        )}

        {message && <p role="status" className={`wenyan-sync-status ${settled ? 'is-settled' : ''} wenyan-body mt-5 text-sm`}>{message}</p>}

        <details className="wenyan-muted mt-9 border-t border-[var(--wenyan-line-soft)] pt-4 text-xs">
          <summary className="wenyan-link cursor-pointer select-none text-xs">同步说明</summary>
          <div className="mt-3 space-y-2 leading-6">
            <p>学习事件先保存在本机；登录后只上传明确归属于当前账号的记录。未归属记录需要你手动认领。</p>
            <p>错词、记录页和词库已练章节都从当前账号可见的学习事实派生；同步这些事实后，相关历史可以在另一台设备重新计算。</p>
            <p>学习位置是独立的工作区状态，只在你明确点击“保存本机位置”时更新云端，并可明确恢复到另一台设备；它不会被当成学习证据。</p>
            <p>其它界面偏好和旧 Qwerty 本机表仍留在设备本地。</p>
          </div>
        </details>
      </main>
    </div>
  )
}