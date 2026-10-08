import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { confirmLearningStage, getLearningPreferences, type LearningPreferencesSnapshot } from '@/coaching/preferences'
import type { LearningStage } from '@/coaching/types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const stages: Array<{ id: LearningStage; title: string; description: string }> = [
  {
    id: 'vocabulary',
    title: '词汇阶段',
    description: '以词汇输入、复习和拼写证据为主。阅读可以手动做，但不会自动进入 Smart Session。',
  },
  {
    id: 'mixed',
    title: '词汇 + 阅读',
    description: '词汇仍是基础，同时允许可信阅读内容进入后续自动编排。',
  },
  {
    id: 'exam_practice',
    title: '真题阶段',
    description: '以真题和题型训练为主，词汇作为补强。当前先保存方向，不代表所有题型执行器都已开放。',
  },
]

const panel = 'rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'

function sourceLabel(snapshot: LearningPreferencesSnapshot) {
  return snapshot.learningStage.provenance.kind === 'user_confirmation'
    ? '你已经明确确认过这个阶段'
    : '当前使用 Wenyan 的默认阶段，尚未由你确认'
}

export default function PreferencesPage() {
  const [snapshot, setSnapshot] = useState<LearningPreferencesSnapshot>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<LearningStage>()
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      setSnapshot(await getLearningPreferences())
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '暂时无法读取学习策略。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const confirm = async (stage: LearningStage) => {
    if (!snapshot) return
    setSaving(stage)
    setMessage('')
    try {
      const next = await confirmLearningStage(stage, snapshot.learningStage.revision)
      setSnapshot(next)
      setMessage('长期学习阶段已由你确认。ChatGPT 之后会把它当作正式偏好，而不是自行猜测。')
    } catch (error) {
      const text = error instanceof Error ? error.message : '保存失败，请重试。'
      if (text.includes('revision_conflict')) {
        await refresh()
        setMessage('云端偏好刚刚发生变化，已刷新到最新版本；请重新确认一次。')
      } else {
        setMessage(text)
      }
    } finally {
      setSaving(undefined)
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-gray-900 dark:text-gray-100">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-8 lg:px-10">
        <div className="mb-8">
          <p className="mb-3 text-xs tracking-[0.18em] text-gray-500">长期策略</p>
          <h1 className="text-3xl font-semibold tracking-tight">哪些事交给 ChatGPT，哪些事由你拍板。</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500 dark:text-gray-400">
            ChatGPT 可以根据学习证据建议阶段变化，但长期阶段只有你明确确认后才会保存。短期的时长、强度和复习优先级仍由 Learning Intent 调整。
          </p>
        </div>

        {message && (
          <p role="status" className="mb-5 rounded-xl bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-800 dark:bg-gray-800 dark:text-indigo-200">
            {message}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-sm text-gray-500">正在读取长期策略…</p>
        ) : !snapshot ? (
          <div className={`${panel} p-6`}>
            <p className="font-medium">还没有连上 Wenyan Cloud。</p>
            <p className="mt-2 text-sm text-gray-500">登录后才能保存长期阶段；本地背词仍然可以继续。</p>
            <Link className="mt-4 inline-block text-sm text-indigo-600" to="/sync">去云同步页面</Link>
          </div>
        ) : (
          <>
            <section className={`${panel} mb-6 p-6 lg:p-8`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-widest text-gray-500">当前长期阶段</p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {stages.find((stage) => stage.id === snapshot.learningStage.current)?.title ?? snapshot.learningStage.current}
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">{sourceLabel(snapshot)} · revision {snapshot.learningStage.revision}</p>
                </div>
                <div className="rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-500 dark:bg-gray-900/50">
                  AI 只能建议，不能代替确认
                </div>
              </div>
            </section>

            <section aria-label="可确认阶段" className="grid gap-4 lg:grid-cols-3">
              {stages.map((stage) => {
                const active = snapshot.learningStage.current === stage.id
                const confirmed = active && snapshot.learningStage.provenance.kind === 'user_confirmation'
                return (
                  <article key={stage.id} className={`${panel} flex min-h-[230px] flex-col p-5`}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{stage.title}</h3>
                      {active && <span className="text-xs text-indigo-600 dark:text-indigo-300">当前</span>}
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-7 text-gray-500 dark:text-gray-400">{stage.description}</p>
                    <button
                      type="button"
                      disabled={Boolean(saving) || confirmed}
                      onClick={() => void confirm(stage.id)}
                      className="mt-5 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {saving === stage.id ? '正在保存…' : confirmed ? '已确认' : active ? '确认当前阶段' : `确认切换到${stage.title}`}
                    </button>
                  </article>
                )
              })}
            </section>

            <p className="mt-6 text-xs leading-6 text-gray-500 dark:text-gray-400">
              确认阶段不会补写任何学习记录，也不会把计划标记为完成。它只改变未来策略边界；真实完成仍必须来自 Wenyan 的学习事实。
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
