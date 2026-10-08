import Header from '@/components/Header'
import type { WordAttemptedPayload } from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { syncCloudPlanToLocal } from '@/plans/cloud'
import { exportStudyPlan, importStudyPlan, startStudyTask } from '@/plans/repository'
import type { StoredStudyPlan, StudyPlan, StudyTask } from '@/plans/types'
import { dateInTimezone } from '@/plans/validation'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentChapterAtom, currentDictIdAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { saveAs } from 'file-saver'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SmartSessionDock from './SmartSessionDock'

const secondary = 'wenyan-button-secondary'
const quietLink = 'wenyan-link text-[13px]'

function planSource(plan: StoredStudyPlan) {
  if (plan.origin === 'cloud') return '云端'
  if (plan.origin === 'local') return '本机'
  return '导入'
}

export default function TodayPage() {
  const dict = useAtomValue(currentDictInfoAtom)
  const [chapter, setChapter] = useAtom(currentChapterAtom)
  const setDict = useSetAtom(currentDictIdAtom)
  const setReview = useSetAtom(reviewModeInfoAtom)
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  const [showImport, setShowImport] = useState(false)
  const [json, setJson] = useState('')
  const [message, setMessage] = useState('')
  const [cloudMessage, setCloudMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const refreshCloudPlan = useCallback(async (announce = false) => {
    setCloudBusy(true)
    try {
      const result = await syncCloudPlanToLocal()
      if (result.status === 'signed-out') {
        setCloudMessage(announce ? '尚未登录云同步' : '')
      } else if (result.status === 'none') {
        setCloudMessage(announce ? '云端没有活动计划' : '')
      } else if (result.status === 'failed') {
        setCloudMessage(`云计划暂时无法更新：${result.message}`)
      } else {
        const deferred = result.deferredTasks ? `，${result.deferredTasks} 项暂不可执行` : ''
        setCloudMessage(announce ? `已同步 ${result.executableTasks} 项${deferred}` : '')
      }
    } catch (error) {
      setCloudMessage(`云计划暂时无法更新：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setCloudBusy(false)
    }
  }, [])

  useEffect(() => {
    void refreshCloudPlan(false)
  }, [refreshCloudPlan])

  const today = dateInTimezone(now)
  const data = useLiveQuery(async () => {
    const start = new Date(`${today}T00:00:00+08:00`).getTime()
    const [events, plans, runs, pending] = await Promise.all([
      db.learningEvents.where('occurredAt').between(start, start + 86_400_000, true, false).toArray(),
      db.studyPlans.orderBy('importedAt').reverse().toArray(),
      db.studyPlanRuns.toArray(),
      db.learningEvents.where('syncState').anyOf('pending', 'failed').count(),
    ])
    const attempts = events.filter((event) => event.eventType === 'word_attempted')
    const correct = attempts.filter((event) => (event.payload as WordAttemptedPayload).wrongCount === 0).length
    const visiblePlans = plans.filter((plan) => plan.origin !== 'cloud' || plan.cloudStatus !== 'archived')
    return {
      plans: visiblePlans,
      runs,
      pending,
      attempts: attempts.length,
      correct,
      chapters: events.filter((event) => event.eventType === 'chapter_completed').length,
    }
  }, [today])

  const handleImport = async () => {
    setBusy(true)
    try {
      await importStudyPlan(json)
      setJson('')
      setShowImport(false)
      setMessage('计划已保存到本机，可以开始学习了。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请检查浏览器存储空间。')
    } finally {
      setBusy(false)
    }
  }

  const createToday = async () => {
    setBusy(true)
    try {
      const selected = dict.language === 'en' ? dict : idDictionaryMap.cet4
      const selectedChapter = selected.id === dict.id ? Math.max(0, Math.min(chapter, dict.chapterCount - 1)) : 0
      const plan: StudyPlan = {
        schemaVersion: 1,
        id: createLearningEvent('chapter_completed', {}).id,
        title: '今天，完成一章',
        timezone: 'Asia/Shanghai',
        tasks: [
          {
            id: 'chapter-1',
            title: '专心练完这一章',
            kind: 'chapter',
            dictId: selected.id,
            chapterIndex: selectedChapter,
            dueDate: today,
            estimatedMinutes: 10,
            reason: '从当前词书开始，留出十分钟专注练习。时长仅供安排参考。',
          },
        ],
      }
      await importStudyPlan(JSON.stringify(plan), 'local')
      setMessage('今日计划已保存。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const launch = async (plan: StoredStudyPlan, task: StudyTask) => {
    setBusy(true)
    try {
      const run = await startStudyTask(plan.id, task.id)
      setReview({ isReviewMode: false, reviewRecord: undefined })
      setDict(task.dictId)
      setChapter(task.chapterIndex)
      navigate(`/?taskRun=${encodeURIComponent(run.id)}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法开始任务，请重试。')
      setBusy(false)
    }
  }

  return (
    <div className="wenyan-studio-shell flex min-h-screen flex-col text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-10">
        <div className="mb-7 flex items-end justify-between gap-6">
          <h1 className="wenyan-page-title">今天</h1>
          <div className="wenyan-mono flex items-center gap-2 text-[10px] text-[var(--wenyan-ink-muted)]">
            <span>{today}</span>
            <span aria-hidden="true" className="opacity-45">·</span>
            <Link to="/sync" className="wenyan-link text-[10px]">
              {data ? (data.pending ? `${data.pending} 条待同步` : '已同步') : '同步中'}
            </Link>
          </div>
        </div>

        <SmartSessionDock />

        <section aria-label="今日概况" className="wenyan-overview-surface mb-10 grid grid-cols-[minmax(0,1fr)_repeat(3,104px)] items-center gap-6 px-6 py-5">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-medium tracking-[0.02em] text-[var(--wenyan-ink-muted)]">当前词书</div>
            <div className="truncate text-[14px] font-semibold text-[var(--wenyan-ink)]">{dict.name}</div>
            <div className="wenyan-muted mt-1 text-[11px]">第 {chapter + 1} 章</div>
            <div className="mt-3 flex items-center gap-4">
              <Link to="/" className={quietLink}>打开</Link>
              <Link to="/gallery" className={quietLink}>切换词书</Link>
            </div>
          </div>

          {[
            [data?.attempts ?? '—', '今日练习', 'text-[var(--wenyan-accent)]'],
            [data && data.attempts ? `${Math.round((data.correct / data.attempts) * 100)}%` : '—', '首次无错', 'text-[var(--wenyan-success)]'],
            [data?.chapters ?? '—', '完成章节', 'text-[var(--wenyan-warm)]'],
          ].map(([value, label, tone], index) => (
            <div key={label} className="border-l border-[var(--wenyan-line-soft)] pl-5 text-right">
              <div className={`wenyan-metric-value wenyan-mono text-[22px] font-semibold tracking-[-0.035em] ${tone}`} style={{ animationDelay: `${index * 45}ms` }}>{value}</div>
              <div className="wenyan-muted mt-1 text-[10px]">{label}</div>
            </div>
          ))}
        </section>

        <section aria-label="学习计划" className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--wenyan-warm)]" aria-hidden="true" />
              <h2 className="wenyan-section-title">计划</h2>
            </div>
            <div className="flex items-center gap-4">
              <button disabled={cloudBusy} onClick={() => void refreshCloudPlan(true)} className="wenyan-link inline-flex items-center gap-1.5 text-[13px] disabled:opacity-50">
                <RefreshCw aria-hidden="true" size={12} className={cloudBusy ? 'animate-spin' : ''} />
                {cloudBusy ? '同步中' : '刷新'}
              </button>
              <button onClick={() => setShowImport(!showImport)} className="wenyan-link text-[13px]">
                {showImport ? '收起导入' : '导入计划'}
              </button>
            </div>
          </div>

          {cloudMessage && <p role="status" className="wenyan-muted mb-3.5 text-xs">{cloudMessage}</p>}
          {message && <p role="status" className="wenyan-body mb-3.5 text-sm">{message}</p>}

          {showImport && (
            <div className="wenyan-surface mb-5 p-5">
              <label htmlFor="plan-json" className="text-sm font-medium">粘贴计划 JSON</label>
              <textarea
                id="plan-json"
                value={json}
                onChange={(event) => setJson(event.target.value)}
                rows={8}
                spellCheck={false}
                className="wenyan-input mt-3 w-full select-text p-3 font-mono text-xs outline-none"
              />
              <div className="mt-3 flex items-center gap-3">
                <button disabled={busy || !json.trim()} onClick={handleImport} className={secondary}>保存计划</button>
                <a href="https://github.com/qbjsdsb/wenyan-English/blob/main/docs/PLAN_FORMAT.md" target="_blank" rel="noreferrer" className="wenyan-link text-xs">格式说明</a>
              </div>
            </div>
          )}

          {!data ? (
            <p className="wenyan-muted py-5 text-sm">正在读取计划…</p>
          ) : data.plans.length === 0 ? (
            <div className="wenyan-overview-surface flex items-center justify-between px-5 py-4">
              <span className="wenyan-muted text-sm">还没有安排</span>
              <button disabled={busy} onClick={createToday} className={secondary}>安排一章</button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]">
              {data.plans.map((plan, planIndex) => (
                <article key={plan.id} className={`${planIndex > 0 ? 'border-t border-[var(--wenyan-line-soft)]' : ''} px-5 py-4`}>
                  <div className="mb-2.5 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <h3 className="truncate text-sm font-semibold text-[var(--wenyan-ink)]">{plan.title}</h3>
                      <span className="wenyan-muted text-[11px]">{planSource(plan)}</span>
                    </div>
                    {plan.origin !== 'cloud' && (
                      <button
                        className="wenyan-link text-xs"
                        onClick={() => saveAs(new Blob([exportStudyPlan(plan)], { type: 'application/json' }), `wenyan-plan-${plan.id}.json`)}
                      >
                        导出
                      </button>
                    )}
                  </div>

                  {plan.tasks.length === 0 ? (
                    <p className="wenyan-muted text-xs">暂无可执行任务</p>
                  ) : (
                    <div>
                      {[...plan.tasks]
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                        .map((task, taskIndex) => {
                          const runs = data.runs.filter((run) => run.planId === plan.id && run.taskId === task.id)
                          const complete = Boolean(plan.cloudCompletions?.[task.id]) || runs.some((run) => run.completionEventId)
                          const planToday = dateInTimezone(now, plan.timezone)
                          return (
                            <div key={task.id} className={`${complete ? 'wenyan-task-complete ' : ''}${taskIndex > 0 ? 'border-t border-[var(--wenyan-line-soft)] ' : ''}flex items-center justify-between gap-5 py-3`} data-testid={`task-${task.id}`}>
                              <div className="min-w-0">
                                <h4 className="text-sm text-[var(--wenyan-ink-secondary)]">{task.title}</h4>
                                <p className="wenyan-muted mt-1 text-[11px]">
                                  {task.dueDate === planToday ? '今天' : !complete && task.dueDate < planToday ? `${task.dueDate} · 待补` : task.dueDate}
                                  {' · '}{idDictionaryMap[task.dictId]?.name} · 第 {task.chapterIndex + 1} 章 · 约 {task.estimatedMinutes} 分钟
                                </p>
                              </div>
                              {complete ? (
                                <span className="shrink-0 text-xs text-[var(--wenyan-success)]">已完成 ✓</span>
                              ) : (
                                <button disabled={busy} onClick={() => launch(plan, task)} className={`${secondary} shrink-0`}>
                                  {runs.length ? '重新开始' : '开始任务'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <nav aria-label="学习入口" className="flex items-center gap-5 pt-1 text-[13px]">
          <Link to="/error-book" className={quietLink}>错词</Link>
          <Link to="/reading/wenyan-demo-reading-01" className={quietLink}>阅读</Link>
          <Link to="/gallery" className={quietLink}>词库</Link>
          <Link to="/analysis" className={quietLink}>记录</Link>
        </nav>
      </main>
    </div>
  )
}
