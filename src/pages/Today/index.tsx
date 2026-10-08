import Header from '@/components/Header'
import Footer from '@/components/Footer'
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
import { BookOpen, Check, Cloud, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SmartSessionDock from './SmartSessionDock'

const panel =
  'rounded-[22px] border border-gray-200/70 bg-white/85 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.5)] backdrop-blur dark:border-white/10 dark:bg-white/[0.045]'
const secondary =
  'rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
const quietLink = 'text-sm text-gray-500 transition-colors hover:text-gray-950 dark:text-gray-400 dark:hover:text-white'

function planSource(plan: StoredStudyPlan) {
  if (plan.origin === 'cloud') return `ChatGPT 云端计划${plan.cloudRevision ? ` · v${plan.cloudRevision}` : ''}`
  if (plan.origin === 'local') return '手动安排'
  return '导入计划'
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
        setCloudMessage('登录 Wenyan Cloud 后，ChatGPT 创建的计划会自动出现在这里。')
      } else if (result.status === 'none') {
        setCloudMessage(announce ? '云端目前没有活动计划。' : '')
      } else if (result.status === 'failed') {
        setCloudMessage(`云计划暂时无法更新：${result.message}。本机学习不受影响。`)
      } else {
        const deferred = result.deferredTasks ? `；另有 ${result.deferredTasks} 个任务等待对应执行器支持` : ''
        setCloudMessage(announce ? `云计划已同步：${result.executableTasks} 个可执行章节任务${deferred}。` : deferred)
      }
    } catch (error) {
      setCloudMessage(`云计划暂时无法更新：${error instanceof Error ? error.message : String(error)}。本机学习不受影响。`)
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
    <div className="flex min-h-screen flex-col text-gray-900 dark:text-gray-100">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-14 pt-10 lg:px-10">
        <div className="mb-9 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-medium tracking-[0.2em] text-gray-400">{today.replace(/-/g, ' / ')} · TODAY</p>
            <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-gray-950 dark:text-white lg:text-[40px]">今天继续就好。</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-gray-500 dark:text-gray-400">先做现在最值得做的一小段。没有打卡压力，也不会把没做完的内容变成欠账。</p>
          </div>
          <Link
            to="/sync"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200/70 bg-white/70 px-3 py-2 text-xs text-gray-500 shadow-sm transition-colors hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:text-white"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${data && data.pending === 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {data ? (data.pending ? `${data.pending} 条等待同步` : '学习记录已同步') : '正在读取记录'}
          </Link>
        </div>

        <SmartSessionDock />

        <section aria-label="手动学习" className={`${panel} mb-9 overflow-hidden`}>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]">
            <div className="flex flex-wrap items-center justify-between gap-6 p-6 lg:px-8 lg:py-7">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-gray-400">CURRENT BOOK</p>
                <h2 className="mb-1 mt-3 text-lg font-semibold tracking-tight text-gray-950 dark:text-white">
                  {dict.name}
                  <span className="ml-3 text-sm font-normal text-gray-400">第 {chapter + 1} 章</span>
                </h2>
                <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">想自己指定词书或章节时，再从这里进入。</p>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/gallery" className={quietLink}>换一本词书</Link>
                <Link to="/" className={secondary}>打开当前章节</Link>
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-gray-100 bg-gray-50/60 dark:border-white/10 dark:bg-white/[0.025] lg:border-l lg:border-t-0">
              {[
                [data?.attempts ?? '—', '今日练习'],
                [data && data.attempts ? `${Math.round((data.correct / data.attempts) * 100)}%` : '—', '首次无错'],
                [data?.chapters ?? '—', '完成章节'],
              ].map(([value, label]) => (
                <div key={label} className="flex min-h-[96px] flex-col justify-center px-4 text-center">
                  <div className="text-xl font-semibold tracking-tight tabular-nums text-gray-950 dark:text-white">{value}</div>
                  <div className="mt-1 text-[11px] text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_285px]">
          <section aria-label="学习计划">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-gray-400">PLAN</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">学习安排</h2>
              </div>
              <div className="flex items-center gap-4">
                <button disabled={cloudBusy} onClick={() => void refreshCloudPlan(true)} className={`${quietLink} inline-flex items-center gap-1.5 disabled:opacity-50`}>
                  <RefreshCw aria-hidden="true" size={14} className={cloudBusy ? 'animate-spin' : ''} />
                  {cloudBusy ? '同步中' : '刷新云计划'}
                </button>
                <button onClick={() => setShowImport(!showImport)} className={quietLink}>
                  {showImport ? '收起导入' : '导入计划'}
                </button>
              </div>
            </div>

            {cloudMessage && <p role="status" className="mb-4 rounded-xl border border-gray-200/70 bg-white/70 px-4 py-3 text-xs leading-5 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">{cloudMessage}</p>}
            {message && <p role="status" className="mb-4 rounded-xl bg-indigo-50/80 px-4 py-3 text-sm text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">{message}</p>}

            {showImport && (
              <div className={`${panel} mb-4 p-5`}>
                <label htmlFor="plan-json" className="text-sm font-medium">粘贴计划 JSON</label>
                <p className="mb-3 mt-2 text-xs leading-5 text-gray-500">手动导入仍可离线使用。ChatGPT 创建的 Cloud Plan 会在登录后自动同步，无需复制 JSON。</p>
                <textarea
                  id="plan-json"
                  value={json}
                  onChange={(event) => setJson(event.target.value)}
                  rows={9}
                  spellCheck={false}
                  className="w-full select-text rounded-xl border border-gray-200 bg-white/60 p-3 font-mono text-xs dark:border-white/10 dark:bg-white/5"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button disabled={busy || !json.trim()} onClick={handleImport} className={secondary}>保存计划</button>
                  <a href="https://github.com/qbjsdsb/wenyan-English/blob/main/docs/PLAN_FORMAT.md" target="_blank" rel="noreferrer" className="text-xs text-gray-500 underline-offset-4 hover:underline">查看计划格式</a>
                </div>
              </div>
            )}

            {!data ? (
              <p className="py-8 text-sm text-gray-500">正在读取计划…</p>
            ) : data.plans.length === 0 ? (
              <div className={`${panel} p-8`}>
                <p className="mb-2 text-base font-medium">先从一章开始。</p>
                <p className="mb-6 max-w-md text-sm leading-7 text-gray-500 dark:text-gray-400">你可以让 ChatGPT 直接创建云计划，也可以先把当前章节放进今天。</p>
                <button disabled={busy} onClick={createToday} className={secondary}>安排今天的一章</button>
              </div>
            ) : (
              <div className="space-y-4">
                {data.plans.map((plan) => (
                  <article key={plan.id} className={`${panel} overflow-hidden`}>
                    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-white/10">
                      <div>
                        <h3 className="font-medium text-gray-950 dark:text-white">{plan.title}</h3>
                        <p className="mt-1.5 text-xs leading-5 text-gray-500">{planSource(plan)} · {plan.origin === 'cloud' ? '云端权威 / 本机执行缓存' : '本机保存'}</p>
                      </div>
                      {plan.origin !== 'cloud' && (
                        <button
                          className="text-xs text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
                          onClick={() => saveAs(new Blob([exportStudyPlan(plan)], { type: 'application/json' }), `wenyan-plan-${plan.id}.json`)}
                        >
                          导出
                        </button>
                      )}
                    </div>

                    {plan.tasks.length === 0 ? (
                      <p className="px-6 py-5 text-xs leading-6 text-gray-500 dark:text-gray-400">
                        这份云计划目前没有本机可执行的章节任务。其他任务类型会在对应执行器接入后显示。
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100 px-6 dark:divide-white/10">
                        {[...plan.tasks]
                          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                          .map((task) => {
                            const runs = data.runs.filter((run) => run.planId === plan.id && run.taskId === task.id)
                            const complete = Boolean(plan.cloudCompletions?.[task.id]) || runs.some((run) => run.completionEventId)
                            const planToday = dateInTimezone(now, plan.timezone)
                            return (
                              <div key={task.id} className="flex items-center justify-between gap-5 py-5" data-testid={`task-${task.id}`}>
                                <div className="min-w-0">
                                  <p className="mb-1 text-[11px] text-gray-400">
                                    {task.dueDate === planToday ? '今天' : !complete && task.dueDate < planToday ? `${task.dueDate} · 待补上` : task.dueDate} · 约 {task.estimatedMinutes} 分钟
                                  </p>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</h4>
                                  <p className="mt-1 text-xs text-gray-500">{idDictionaryMap[task.dictId]?.name} · 第 {task.chapterIndex + 1} 章</p>
                                  {task.reason && <p className="mt-2 max-w-xl text-xs leading-5 text-gray-500 dark:text-gray-400">{task.reason}</p>}
                                </div>
                                {complete ? (
                                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <Check aria-hidden="true" size={13} /> 已完成
                                  </span>
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
            <p className="mt-4 text-[11px] leading-5 text-gray-400">完成全章后才产生真实完成证据；启动任务或修改计划不会伪造学习完成。</p>
          </section>

          <aside className="space-y-5">
            <section className={`${panel} p-6`}>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-gray-400">REVIEW</p>
              <h2 className="mb-2 mt-3 font-medium text-gray-950 dark:text-white">给易错词一点耐心。</h2>
              <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">反复写错值得复习，但拼写表现不会被包装成“词义掌握率”。</p>
              <Link to="/error-book" className="mt-5 inline-block text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 dark:text-gray-100 dark:decoration-gray-600">打开错词本</Link>
            </section>

            <section className={`${panel} p-6`}>
              <div className="flex items-center gap-2 text-gray-400">
                <BookOpen aria-hidden="true" size={15} strokeWidth={1.8} />
                <p className="text-[11px] font-semibold tracking-[0.16em]">READING LAB</p>
              </div>
              <h2 className="mb-2 mt-3 font-medium text-gray-950 dark:text-white">阅读链路已经可以练。</h2>
              <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">先用实验阅读验证作答、草稿恢复和真实事实记录；暂不让它自动进入 Smart Session。</p>
              <Link to="/reading/wenyan-demo-reading-01" className="mt-5 inline-block text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 dark:text-gray-100 dark:decoration-gray-600">练一篇阅读</Link>
            </section>

            <section className="px-2 py-1">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <Cloud aria-hidden="true" size={15} strokeWidth={1.8} />
                ChatGPT 已连接
              </div>
              <p className="text-xs leading-6 text-gray-500 dark:text-gray-400">它可以调整未来学习意图和云计划；真实学习事实仍然只能由你的实际练习产生。</p>
              <Link to="/sync" className="mt-3 inline-block text-xs text-gray-500 underline-offset-4 hover:underline">管理云同步</Link>
            </section>
          </aside>
        </div>

        <p className="mt-12 border-t border-gray-200/60 pt-5 text-[11px] leading-5 text-gray-400 dark:border-white/10">今日概况按北京时间统计，仅包含本机已有学习事件。拼写表现不代表词义掌握程度；未同步设备的数据仍然未知。</p>
      </main>
      <Footer />
    </div>
  )
}
