import { type BrowserLearningPreferencesSnapshot, confirmLearningStage, getLearningPreferences } from '@/coaching/preferences'
import type { LearningStage } from '@/coaching/types'
import Header from '@/components/Header'
import { LoadingUI } from '@/components/Loading'
import PageHeading from '@/components/PageHeading'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type StageOption = {
  id: LearningStage
  title: string
  description: string
  available: boolean
}

const stages: StageOption[] = [
  { id: 'vocabulary', title: '词汇阶段', description: '以背词、复习、拼写和词义训练为主。', available: true },
  { id: 'mixed', title: '词汇 + 阅读', description: '阅读训练还在完善，暂未开放。', available: false },
  { id: 'exam_practice', title: '真题阶段', description: '真题训练还在准备，暂未开放。', available: false },
]

function sourceLabel(snapshot: BrowserLearningPreferencesSnapshot) {
  return snapshot.learningStage.provenance.kind === 'user_confirmation' ? '已确认' : '默认阶段'
}

export default function PreferencesPage() {
  const [snapshot, setSnapshot] = useState<BrowserLearningPreferencesSnapshot>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<LearningStage>()
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      setSnapshot(await getLearningPreferences())
      setMessage('')
    } catch (error) {
      setSnapshot(undefined)
      setMessage(error instanceof Error ? error.message : '暂时无法读取学习阶段。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const confirm = async (stage: LearningStage) => {
    if (!snapshot || !stages.find((item) => item.id === stage)?.available) return
    setSaving(stage)
    setMessage('')
    try {
      const next = await confirmLearningStage(stage, snapshot)
      setSnapshot(next)
      setMessage('学习阶段已更新。')
    } catch (error) {
      const text = error instanceof Error ? error.message : '保存失败，请重试。'
      if (text.includes('revision_conflict')) {
        await refresh()
        setMessage('设置已更新，请重新确认。')
      } else if (text.includes('learning_owner_changed')) {
        await refresh()
        setMessage('账号已切换，已重新读取当前设置。')
      } else {
        setMessage(text)
      }
    } finally {
      setSaving(undefined)
    }
  }

  const currentStage = snapshot ? stages.find((stage) => stage.id === snapshot.learningStage.current) : undefined
  const currentStageUnavailable = Boolean(currentStage && !currentStage.available)

  return (
    <div className="wenyan-studio-shell flex min-h-screen flex-col text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-9">
        <PageHeading title="学习阶段" description="决定接下来主要练什么。" />

        {message && (
          <p role="status" className="wenyan-body mb-5 text-sm">
            {message}
          </p>
        )}

        {loading ? (
          <section className="wenyan-surface flex min-h-[220px] items-center justify-center">
            <LoadingUI label="正在读取学习阶段" />
          </section>
        ) : !snapshot ? (
          <div className="wenyan-surface p-5">
            <p className="text-sm font-medium">需要先登录 Wenyan Cloud</p>
            <Link className="wenyan-link-accent mt-3 inline-block text-sm" to="/sync">
              去同步页面
            </Link>
          </div>
        ) : (
          <>
            <section className="wenyan-surface mb-5 px-5 py-5">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="wenyan-muted text-[10px]">当前阶段</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--wenyan-ink)]">
                    {currentStage?.title ?? snapshot.learningStage.current}
                  </p>
                </div>
                <span className="wenyan-muted text-xs">{sourceLabel(snapshot)}</span>
              </div>

              {currentStageUnavailable && (
                <p className="mt-4 rounded-[var(--wenyan-radius-sm)] bg-[var(--wenyan-paper-muted)] px-3 py-2 text-xs leading-5 text-[var(--wenyan-ink-muted)]">
                  这个阶段还没开放，当前不会把它加入学习安排。你可以切回词汇阶段。
                </p>
              )}

              <div className="wenyan-stage-path mt-6" aria-label="学习路径">
                {stages.map((stage) => {
                  const active = snapshot.learningStage.current === stage.id
                  return (
                    <div key={stage.id} className={`wenyan-stage-node ${active ? 'is-active' : ''}`}>
                      <div className="wenyan-stage-node-dot" aria-hidden="true" />
                      <div className={`text-[11px] ${active ? 'font-medium text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-muted)]'}`}>
                        {stage.title}
                        {!stage.available ? ' · 规划中' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section
              aria-label="学习阶段选项"
              className="overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]"
            >
              {stages.map((stage, index) => {
                const active = snapshot.learningStage.current === stage.id
                const confirmed = active && snapshot.learningStage.provenance.kind === 'user_confirmation'
                const disabled = Boolean(saving) || confirmed || !stage.available
                return (
                  <div
                    key={stage.id}
                    className={`${
                      index > 0 ? 'border-t border-[var(--wenyan-line-soft)]' : ''
                    } flex items-center justify-between gap-8 px-5 py-5 ${active ? 'bg-[var(--wenyan-accent-soft)]' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-[var(--wenyan-ink)]">{stage.title}</h2>
                        {active && <span className="text-[10px] text-[var(--wenyan-accent)]">当前</span>}
                      </div>
                      <p className="wenyan-muted mt-1.5 text-xs leading-5">{stage.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void confirm(stage.id)}
                      className="wenyan-button-secondary shrink-0"
                    >
                      {!stage.available ? '未开放' : saving === stage.id ? '保存中…' : confirmed ? '已确认' : active ? '确认' : '切换'}
                    </button>
                  </div>
                )
              })}
            </section>

            <details className="wenyan-muted mt-8 text-xs">
              <summary className="wenyan-link cursor-pointer select-none text-xs">为什么有些阶段不能选？</summary>
              <div className="mt-3 space-y-2 leading-6">
                <p>只有当前能完整练习并保存进度的阶段才会开放。学习阶段只影响之后的安排，不会改动过去的记录。</p>
              </div>
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
              <a href="https://github.com/qbjsdsb/wenyan-English" target="_blank" rel="noreferrer" className="wenyan-link">
                项目
              </a>
              <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noreferrer" className="wenyan-link">
                GPL-3.0
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
