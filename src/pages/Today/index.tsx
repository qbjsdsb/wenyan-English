import Header from '@/components/Header'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { learningEventsForOwnerBetween } from '@/learning/eventQueries'
import type { WordAttemptedPayload } from '@/learning/types'
import { createLearningEvent } from '@/learning/types'
import { syncCloudPlanToLocal } from '@/plans/cloud'
import { exportStudyPlan, importStudyPlan, startStudyTask } from '@/plans/repository'
import type { StoredStudyPlan, StudyPlan, StudyTask } from '@/plans/types'
import { dateInTimezone } from '@/plans/validation'
import { idDictionaryMap } from '@/resources/dictionary'
import { practiceReturnPath, readPracticeChoices } from '@/semantic/practiceChoices'
import type { PracticePool } from '@/semantic/practice'
import { currentChapterAtom, currentDictIdAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { saveAs } from 'file-saver'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SmartSessionDock from './SmartSessionDock'

const secondary = 'wenyan-button-secondary'
const quietLink = 'wenyan-link text-[13px]'

function planSource(plan: StoredStudyPlan) {
  if (plan.origin === 'cloud') return 'ChatGPT'
  if (plan.origin === 'local') return '本机'
  return '导入'
}

function practicePoolLabel(pool: PracticePool) {
  if (pool === 'chapter') return '当前章节'
  if (pool === 'learned') return '已经练过'
  if (pool === 'errors') return '拼写错词'
  return '词义模糊'
}

export default function TodayPage() {
  const owner = useLearningOwner()
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
  const practiceChoices = useMemo(() => readPracticeChoices(owner), [owner])

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
        setCloudMessage(announce ? '云端没有待完成的明确任务' : '')
      } else if (result.status === 'failed') {
        setCloudMessage(`云端任务暂时无法更新：${result.message}`)
      } else {
        const deferred = result.deferredTasks ? `，${result.deferredTasks} 项暂不可执行` : ''
        setCloudMessage(announce ? `已同步 ${result.executableTasks} 项明确任务${deferred}` : '')
      }
    } catch (error) {
      setCloudMessage(`云端任务暂时无法更新：${error instanceof Error ? error.message : String(error)}`)
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
    const [visibleEvents, plans, runs, pendingEvents] = await Promise.all([
      learningEventsForOwnerBetween(owner, start, start + 86_400_000 - 1),
      db.studyPlans.orderBy('importedAt').reverse().toArray(),
      db.studyPlanRuns.toArray(),
      db.learningEvents.where('syncState').anyOf('pending', 'failed').toArray(),
    ])
    const attempts = visibleEvents.filter((event) => event.eventType === 'word_attempted')
    const correct = attempts.filter((event) => (event.payload as WordAttemptedPayload).wrongCount === 0).length
    const visiblePlans = plans.filter((plan) => {
      if (plan.origin !== 'cloud') return true
      if (!owner || plan.ownerUserId !== owner || plan.cloudStatus !== 'active') return false
      return plan.tasks.some((task) => {
        if (plan.cloudCompletions?.[task.id]) return false
        return !runs.some((run) => run.planId === plan.id && run.taskId === task.id && run.completionEventId)
      })
    })
    return {
      plans: visiblePlans,
      runs,
      pending: pendingEvents.filter((event) => event.ownerUserId === owner).length,
      attempts: attempts.length,
      correct,
      semantic: visibleEvents.filter((event) => event.eventType === 'semantic_recall_attempted').length,
      recognition: visibleEvents.filter((event) => event.eventType === 'semantic_discrimination_attempted').length,
      chapters: visibleEvents.filter((event) => event.eventType === 'chapter_completed').length,
    }
  }, [today, owner])

  const handleImport = async () => {
    setBusy(true)
    try {
      await importStudyPlan(json)
      setJson('')
      setShowImport(false)
      setMessage('任务已保存到本机，可以开始学习了。')
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
      setMessage('明确任务已保存。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const launch = async (plan: StoredStudyPlan, task: StudyTask) => {
    setBusy(true)
    try {
      let executablePlan = plan
      let executableTask = task

      if (plan.origin === 'cloud') {
        if (!owner || plan.ownerUserId !== owner) throw new Error('这项云端任务不属于当前账号，请刷新后重试。')
        const sync = await syncCloudPlanToLocal(plan.id)
        if (sync.status !== 'synced') {
          if (sync.status === 'signed-out') throw new Error('登录状态已失效，请重新登录后再开始。')
          if (sync.status === 'none') throw new Error('这项云端任务已经不可用，请刷新任务列表。')
          throw new Error(`无法确认云端任务：${sync.message}`)
        }
        const refreshed = await db.studyPlans.get(plan.id)
        if (!refreshed || refreshed.origin !== 'cloud' || refreshed.ownerUserId !== owner || refreshed.cloudStatus !== 'active') {
          throw new Error('这项云端任务已经不是当前可执行任务。')
        }
        const refreshedTask = refreshed.tasks.find((candidate) => candidate.id === task.id)
        if (!refreshedTask) throw new Error('云端已经调整了这项任务，请刷新后重试。')
        executablePlan = refreshed
        executableTask = refreshedTask
      }

      const run = await startStudyTask(executablePlan.id, executableTask.id)
      setReview({ isReviewMode: false, reviewRecord: undefined })
      setDict(executableTask.dictId)
      setChapter(executableTask.chapterIndex)
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
          <div>
            <h1 className="wenyan-page-title">今天</h1>
            <p className="wenyan-muted mt-2 text-sm">从眼前这一小段开始。</p>
          </div>
          <div className="wenyan-mono flex items-center gap-2 text-[10px] text-[var(--wenyan-ink-muted)]">
            <span>{today}</span>
            <span aria-hidden="true" className="opacity-45">·</span>
            <Link to="/sync" className="wenyan-link text-[10px]">
              {data ? (data.pending ? `本机已保存 · ${data.pending} 条待同步` : '查看同步状态') : '正在读取本机记录…'}
            </Link>
          </div>
        </div>

        <SmartSessionDock />

        <nav aria-label="专项训练快捷入口" className="wenyan-direct-practice">
          <span className="wenyan-muted text-[11px] font-medium">专项</span>
          <Link to={practiceReturnPath('spelling', practiceChoices)}>拼写</Link>
          <Link to={practiceReturnPath('recall', practiceChoices)}>词义回想</Link>
          <Link to={practiceReturnPath('discrimination', practiceChoices)}>选择词义</Link>
          <span className="wenyan-muted text-[10px]">
            上次范围 · {practicePoolLabel(practiceChoices.pool)}{practiceChoices.pool === 'chapter' ? '' : ` · 每段 ${practiceChoices.limit}`}
          </span>
          <span className="wenyan-direct-practice-spacer" aria-hidden="true" />
          <Link to={practiceReturnPath(practiceChoices.mode, practiceChoices)} className="wenyan-muted">更多设置</Link>
        </nav>

        <section aria-label="今日概况" className="wenyan-overview-surface wenyan-today-overview mb-10">
          <div className="min-w-0">
            <div className="wenyan-muted text-[10px] font-medium tracking-[0.02em]">当前词书</div>
            <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <div className="truncate text-[14px] font-semibold text-[var(--wenyan-ink)]">{dict.name}</div>
              <div className="wenyan-muted text-[11px]">第 {chapter + 1} 章</div>
            </div>
            <div className="mt-2.5 flex items-center gap-4">
              <Link to="/" className={quietLink}>打开</Link>
              <Link to="/gallery" className={quietLink}>切换词书</Link>
            </div>
          </div>

          <div className="wenyan-today-summary" aria-label="今日学习记录摘要">
            <span className="wenyan-muted text-[10px] font-medium">今天</span>
            <span><strong>{data?.attempts ?? '—'}</strong> 拼写</span>
            <span><strong>{data?.correct ?? '—'}</strong> 无错</span>
            <span><strong>{data?.semantic ?? '—'}</strong> 回想</span>
            <span><strong>{data?.recognition ?? '—'}</strong> 选择</span>
          </div>
        </section>

        <section aria-label="学习计划" className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <h2 className="wenyan-section-title">明确任务</h2>
              <p className="wenyan-muted mt-1 text-[11px]">只放需要明确完成的安排；上方智能学习会按当前策略实时生成下一段。</p>
            </div>
            <div className="flex items-center gap-4">
              <button disabled={cloudBusy} onClick={() => void refreshCloudPlan(true)} className="wenyan-link inline-flex items-center gap-1.5 text-[13px] disabled:opacity-50">
                <RefreshCw aria-hidden="true" size={12} className={cloudBusy ? 'animate-spin' : ''} />
                {cloudBusy ? '同步中' : '刷新'}
              </button>
              <button onClick={() => setShowImport(!showImport)} className="wenyan-link text-[13px]">
                {showImport ? '收起导入' : '导入任务'}
              </button>
            </div>
          </div>

          {cloudMessage && <p role="status" className="wenyan-muted mb-3.5 text-xs">{cloudMessage}</p>}
          {message && <p role="status" className="wenyan-body mb-3.5 text-sm">{message}</p>}

          {showImport && (
            <div className="wenyan-surface mb-5 p-5">
              <label htmlFor="plan-json" className="text-sm font-medium">粘贴任务 JSON</label>
              <textarea
                id="plan-json"
                value={json}
                onChange={(event) => setJson(event.target.value)}
                rows={8}
                spellCheck={false}
                className="wenyan-input mt-3 w-full select-text p-3 font-mono text-xs outline-none"
              />
              <div className="mt-3 flex items-center gap-3">
                <button disabled={busy || !json.trim()} onClick={handleImport} className={secondary}>保存任务</button>
                <a href="https://github.com/qbjsdsb/wenyan-English/blob/main/docs/PLAN_FORMAT.md" target="_blank" rel="noreferrer" className="wenyan-link text-xs">格式说明</a>
              </div>
            </div>
          )}

          {!data ? (
            <p className="wenyan-muted py-5 text-sm">正在读取任务…</p>
          ) : data.plans.length === 0 ? (
            <div className="wenyan-overview-surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm text-[var(--wenyan-ink-secondary)]">现在没有必须完成的明确任务。</p>
                <p className="wenyan-muted mt-1 text-xs">直接使用上方智能学习即可；需要时也可以给今天留下一章。</p>
              </div>
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

        <nav aria-label="学习入口" className="flex flex-wrap items-center gap-5 pt-1 text-[13px]">
          <Link to="/error-book" className={quietLink}>错词</Link>
          <Link to="/reading/wenyan-demo-reading-01" className={quietLink} title="实验入口：阅读主学习闭环尚未开放">阅读实验</Link>
          <Link to="/gallery" className={quietLink}>词库</Link>
          <Link to="/analysis" className={quietLink}>记录</Link>
        </nav>
      </main>
    </div>
  )
}