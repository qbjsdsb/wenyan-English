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
  { id: 'mixed', title: '词汇 + 阅读', description: '把稳定的词汇训练和完整阅读训练放在同一个阶段。', available: false },
  { id: 'exam_practice', title: '真题阶段', description: '以成套真题、复盘和阶段性验证为主。', available: false },
]

function sourceLabel(snapshot: BrowserLearningPreferencesSnapshot) {
  return snapshot.learningStage.provenance.kind === 'user_confirmation' ? '已确认' : '默认阶段'
}

function preferenceErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('authentication_required')) return ''
  if (message.includes('revision_conflict')) return '设置刚刚有变化，请重新确认。'
  if (message.includes('learning_owner_changed') || message.includes('browser_owner_changed')) return '账号已切换，正在重新读取当前设置。'
  if (message.includes('invalid_learning_preferences')) return '学习阶段数据暂时无法读取，请稍后重试。'
  if (message.includes('learning_preferences_unavailable')) return '学习阶段暂时无法读取，请稍后重试。'
  if (message.includes('learning_stage_update_failed')) return '学习阶段暂时无法保存，请稍后重试。'
  return message && !/^[a-z0-9_:-]+$/i.test(message) ? message : fallback
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
      setMessage(preferenceErrorMessage(error, '暂时无法读取学习阶段。'))
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
      const text = error instanceof Error ? error.message : ''
      if (text.includes('revision_conflict')) {
        await refresh()
        setMessage('设置刚刚有变化，请重新确认。')
      } else if (text.includes('learning_owner_changed') || text.includes('browser_owner_changed')) {
        await refresh()
        setMessage('账号已切换，已重新读取当前设置。')
      } else {
        setMessage(preferenceErrorMessage(error, '保存失败，请重试。'))
      }
    } finally {
      setSaving(undefined)
    }
  }

  const currentStage = snapshot ? stages.find((stage) => stage.id === snapshot.learningStage.current) : undefined
  const currentStageUnavailable = Boolean(currentStage && !currentStage.available)
  const currentConfirmed = Boolean(snapshot && snapshot.learningStage.provenance.kind === 'user_confirmation' && !currentStageUnavailable)
  const upcomingStages = stages.filter((stage) => !stage.available)

  return (
    <div className="wenyan-studio-shell flex min-h-screen flex-col text-[var(--wenyan-ink)]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-9">
        <PageHeading title="学习阶段" description="只决定接下来主要练什么，不改动过去的学习记录。" />

        {message && (
          <p role="status" className="wenyan-body mb-5 text-sm">
            {message}
          </p>
        )}

        {loading ? (
          <section className="flex min-h-[220px] items-center justify-center border-y border-[var(--wenyan-line-soft)]">
            <LoadingUI label="正在读取学习阶段" />
          </section>
        ) : !snapshot ? (
          <section className="border-y border-[var(--wenyan-line-soft)] py-6">
            <p className="text-sm font-medium">需要先登录 Wenyan Cloud</p>
            <p className="wenyan-muted mt-2 text-xs leading-5">登录后才能跨设备保存和确认长期学习阶段。</p>
            <Link className="wenyan-link mt-4 inline-block text-sm" to="/sync">
              去同步页面 →
            </Link>
          </section>
        ) : (
          <>
            <section className="border-y border-[var(--wenyan-line-soft)] py-6" aria-labelledby="current-learning-stage">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <p className="wenyan-kicker">当前阶段</p>
                  <h2 id="current-learning-stage" className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--wenyan-ink)]">
                    {currentStage?.title ?? snapshot.learningStage.current}
                  </h2>
                  <p className="wenyan-muted mt-2 max-w-xl text-sm leading-6">
                    {currentStage?.description ?? '当前阶段由 Wenyan 保存，用来决定后续学习安排。'}
                  </p>
                </div>
                <span className="wenyan-muted pt-0.5 text-[11px]">{sourceLabel(snapshot)}</span>
              </div>

              {currentStageUnavailable && (
                <div className="wenyan-danger-note mt-5 px-4 py-3 text-xs leading-5 text-[var(--wenyan-ink-secondary)]">
                  这个阶段还没有完整开放，当前不会把它加入新的学习安排。先切回词汇阶段最稳妥。
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {currentStageUnavailable ? (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => void confirm('vocabulary')}
                    className="wenyan-button-primary"
                  >
                    {saving === 'vocabulary' ? '保存中…' : '切回词汇阶段'}
                  </button>
                ) : !currentConfirmed ? (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => void confirm(snapshot.learningStage.current)}
                    className="wenyan-button-secondary"
                  >
                    {saving === snapshot.learningStage.current ? '保存中…' : '确认继续使用'}
                  </button>
                ) : null}
                <span className="wenyan-muted text-xs">阶段变化始终需要你自己确认。</span>
              </div>
            </section>

            <section aria-labelledby="future-learning-stages" className="mt-10">
              <div className="mb-4">
                <h2 id="future-learning-stages" className="wenyan-section-title">以后可用</h2>
                <p className="wenyan-muted mt-1.5 text-xs leading-5">等对应学习闭环真正稳定后，这些阶段才会成为可选项。</p>
              </div>
              <div className="border-t border-[var(--wenyan-line-soft)]">
                {upcomingStages.map((stage) => (
                  <div key={stage.id} className="flex items-start justify-between gap-8 border-b border-[var(--wenyan-line-soft)] py-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-[var(--wenyan-ink)]">{stage.title}</h3>
                      <p className="wenyan-muted mt-1 text-xs leading-5">{stage.description}</p>
                    </div>
                    <span className="wenyan-muted shrink-0 pt-0.5 text-[11px]">完善中</span>
                  </div>
                ))}
              </div>
            </section>

            <details className="wenyan-muted mt-8 text-xs">
              <summary className="wenyan-link cursor-pointer select-none text-xs">为什么不能提前切换？</summary>
              <div className="mt-3 space-y-2 leading-6">
                <p>只有当前能够完整练习、保存进度并可靠恢复的阶段才会开放。阶段设置只影响未来安排，不会改写过去的学习事实。</p>
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
