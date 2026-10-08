import Header from '@/components/Header'
import { type LearningPreferencesSnapshot, confirmLearningStage, getLearningPreferences } from '@/coaching/preferences'
import type { LearningStage } from '@/coaching/types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const stages: Array<{ id: LearningStage; title: string; description: string }> = [
  { id: 'vocabulary', title: '词汇阶段', description: '以词汇输入、复习和拼写为主。' },
  { id: 'mixed', title: '词汇 + 阅读', description: '词汇继续推进，同时加入阅读训练。' },
  { id: 'exam_practice', title: '真题阶段', description: '以真题和题型训练为主，词汇作为补强。' },
]

function sourceLabel(snapshot: LearningPreferencesSnapshot) {
  return snapshot.learningStage.provenance.kind === 'user_confirmation' ? '已确认' : '默认阶段'
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
    <div className="flex min-h-screen flex-col text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-9">
        <div className="mb-7">
          <h1 className="wenyan-page-title">学习阶段</h1>
          <p className="wenyan-muted mt-2 text-sm">决定后续自动安排可以做到哪一步</p>
        </div>

        {message && <p role="status" className="wenyan-body mb-5 text-sm">{message}</p>}

        {loading ? (
          <p className="wenyan-muted border-y border-[var(--wenyan-line-soft)] py-8 text-sm">正在读取…</p>
        ) : !snapshot ? (
          <div className="rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)] p-5">
            <p className="text-sm font-medium">需要先登录 Wenyan Cloud</p>
            <Link className="wenyan-link-accent mt-3 inline-block text-sm" to="/sync">去同步页面</Link>
          </div>
        ) : (
          <>
            <section className="mb-5 rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)] px-5 py-4">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="wenyan-muted text-[10px]">当前阶段</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--wenyan-ink)]">
                    {stages.find((stage) => stage.id === snapshot.learningStage.current)?.title ?? snapshot.learningStage.current}
                  </p>
                </div>
                <span className="wenyan-muted text-xs">{sourceLabel(snapshot)}</span>
              </div>
            </section>

            <section aria-label="可确认阶段" className="overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]">
              {stages.map((stage, index) => {
                const active = snapshot.learningStage.current === stage.id
                const confirmed = active && snapshot.learningStage.provenance.kind === 'user_confirmation'
                return (
                  <div key={stage.id} className={`${index > 0 ? 'border-t border-[var(--wenyan-line-soft)]' : ''} flex items-center justify-between gap-8 px-5 py-5 ${active ? 'bg-[var(--wenyan-accent-soft)]' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-[var(--wenyan-ink)]">{stage.title}</h2>
                        {active && <span className="text-[10px] text-[var(--wenyan-accent)]">当前</span>}
                      </div>
                      <p className="wenyan-muted mt-1.5 text-xs leading-5">{stage.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(saving) || confirmed}
                      onClick={() => void confirm(stage.id)}
                      className="wenyan-button-secondary shrink-0"
                    >
                      {saving === stage.id ? '保存中…' : confirmed ? '已确认' : active ? '确认' : '切换'}
                    </button>
                  </div>
                )
              })}
            </section>

            <details className="wenyan-muted mt-8 text-xs">
              <summary className="wenyan-link cursor-pointer select-none text-xs">阶段说明</summary>
              <p className="mt-3 leading-6">长期阶段需要由你确认。短期学习时长、强度和复习优先级仍可根据最近学习情况自动调整。阶段变化只影响未来安排，不会改写历史学习记录。</p>
            </details>
          </>
        )}

        <section aria-label="关于 Wenyan" className="mt-12 border-t border-[var(--wenyan-line-soft)] pt-5">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-[var(--wenyan-ink)]">Wenyan</p>
              <p className="wenyan-muted mt-1 text-[11px]">个人英语学习工作区</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <a href="https://github.com/qbjsdsb/wenyan-English" target="_blank" rel="noreferrer" className="wenyan-link">项目</a>
              <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noreferrer" className="wenyan-link">GPL-3.0</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
