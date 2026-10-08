import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { type LearningPreferencesSnapshot, confirmLearningStage, getLearningPreferences } from '@/coaching/preferences'
import type { LearningStage } from '@/coaching/types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const stages: Array<{ id: LearningStage; title: string; description: string }> = [
  {
    id: 'vocabulary',
    title: '词汇阶段',
    description: '以词汇输入、复习和拼写为主。',
  },
  {
    id: 'mixed',
    title: '词汇 + 阅读',
    description: '词汇继续推进，同时加入阅读训练。',
  },
  {
    id: 'exam_practice',
    title: '真题阶段',
    description: '以真题和题型训练为主，词汇作为补强。',
  },
]

function sourceLabel(snapshot: LearningPreferencesSnapshot) {
  return snapshot.learningStage.provenance.kind === 'user_confirmation' ? '已确认' : '默认阶段'
}

const secondaryButton = 'rounded-lg border border-black/[0.09] px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.1] dark:text-gray-400 dark:hover:bg-white/[0.04]'

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
      setMessage('学习阶段已更新。')
    } catch (error) {
      const text = error instanceof Error ? error.message : '保存失败，请重试。'
      if (text.includes('revision_conflict')) {
        await refresh()
        setMessage('设置已更新，请重新确认。')
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-gray-950 dark:text-gray-100">学习阶段</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">决定后续自动安排可以做到哪一步</p>
        </div>

        {message && <p role="status" className="mb-5 text-sm text-gray-600 dark:text-gray-400">{message}</p>}

        {loading ? (
          <p className="border-y border-black/[0.08] py-8 text-sm text-gray-400 dark:border-white/[0.09] dark:text-gray-600">正在读取…</p>
        ) : !snapshot ? (
          <div className="border-y border-black/[0.08] py-7 dark:border-white/[0.09]">
            <p className="text-sm font-medium">需要先登录 Wenyan Cloud</p>
            <Link className="mt-3 inline-block text-sm text-gray-500 underline decoration-gray-300 underline-offset-4 dark:text-gray-500 dark:decoration-gray-700" to="/sync">去同步页面</Link>
          </div>
        ) : (
          <>
            <section className="mb-8 border-y border-black/[0.08] py-5 dark:border-white/[0.09]">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">当前阶段</p>
                  <p className="mt-1 text-lg font-semibold text-gray-950 dark:text-gray-100">
                    {stages.find((stage) => stage.id === snapshot.learningStage.current)?.title ?? snapshot.learningStage.current}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-600">{sourceLabel(snapshot)}</span>
              </div>
            </section>

            <section aria-label="可确认阶段" className="divide-y divide-black/[0.07] border-y border-black/[0.08] dark:divide-white/[0.08] dark:border-white/[0.09]">
              {stages.map((stage) => {
                const active = snapshot.learningStage.current === stage.id
                const confirmed = active && snapshot.learningStage.provenance.kind === 'user_confirmation'
                return (
                  <div key={stage.id} className="flex items-center justify-between gap-8 py-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-200">{stage.title}</h2>
                        {active && <span className="text-[11px] text-gray-400 dark:text-gray-600">当前</span>}
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-gray-500 dark:text-gray-500">{stage.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(saving) || confirmed}
                      onClick={() => void confirm(stage.id)}
                      className={`${secondaryButton} shrink-0`}
                    >
                      {saving === stage.id ? '保存中…' : confirmed ? '已确认' : active ? '确认' : '切换'}
                    </button>
                  </div>
                )
              })}
            </section>

            <details className="mt-8 text-xs text-gray-400 dark:text-gray-600">
              <summary className="cursor-pointer select-none text-gray-500 dark:text-gray-500">阶段说明</summary>
              <p className="mt-3 leading-6">长期阶段需要由你确认。短期学习时长、强度和复习优先级仍可根据最近学习情况自动调整。阶段变化只影响未来安排，不会改写历史学习记录。</p>
            </details>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
