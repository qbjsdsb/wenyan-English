import EmptyState from '@/components/EmptyState'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import HeatmapCharts from './components/HeatmapCharts'
import KeyboardWithBarCharts from './components/KeyboardWithBarCharts'
import LineCharts from './components/LineCharts'
import { useWordStats } from './hooks/useWordStats'
import { LoadingUI } from '@/components/Loading'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { isOpenDarkModeAtom } from '@/store'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'

const Analysis = () => {
  const navigate = useNavigate()
  const [, setIsOpenDarkMode] = useAtom(isOpenDarkModeAtom)

  useHotkeys('ctrl+d', () => setIsOpenDarkMode((old) => !old), { enableOnFormTags: true, preventDefault: true }, [])
  useHotkeys('esc', () => navigate('/today'), { ignoreEventWhen: ignoresStudyKey, preventDefault: true })

  const { error, retry, isEmpty, exerciseRecord, wordRecord, wpmRecord, accuracyRecord, wrongTimeRecord } = useWordStats(
    dayjs().subtract(1, 'year').unix(),
    dayjs().unix(),
  )

  const recent = useMemo(() => {
    const exercises = exerciseRecord.slice(-7).reduce((total, item) => total + item.count, 0)
    const words = wordRecord.slice(-7).reduce((total, item) => total + item.count, 0)
    const accuracyValues = accuracyRecord.slice(-7).map(([, value]) => value)
    const accuracy = accuracyValues.length
      ? Math.round(accuracyValues.reduce((total, value) => total + value, 0) / accuracyValues.length)
      : undefined
    return { exercises, words, accuracy }
  }, [accuracyRecord, exerciseRecord, wordRecord])

  return (
    <Layout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-9">
        <div className="mb-7">
          <h1 className="wenyan-page-title">记录</h1>
          <p className="wenyan-muted mt-2 text-sm">过去一年的拼写练习记录</p>
        </div>

        {error ? (
          <section className="wenyan-surface p-7" role="alert"><p>暂时无法读取本机学习记录。</p><button className="wenyan-button-secondary mt-4" onClick={retry}>重新读取</button></section>
        ) : isEmpty === undefined ? (
          <section className="wenyan-surface flex min-h-[260px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <LoadingUI label="正在整理学习记录" />
              <p className="wenyan-muted text-[11px]">正在整理学习记录</p>
            </div>
          </section>
        ) : isEmpty ? (
          <EmptyState title="暂无练习数据" description="从今天的一小段开始。真实的拼写练习会逐渐留下记录，不必先填满图表。" />
        ) : (
          <>
            <section className="wenyan-report-summary mb-8 rounded-[var(--wenyan-radius-lg)] border border-[var(--wenyan-line-soft)] px-6 py-5">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <div>
                  <p className="wenyan-muted text-[10px]">最近 7 天</p>
                  <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[var(--wenyan-ink)]">学习节奏</h2>
                </div>
                <p className="wenyan-muted text-xs">只统计本机已有练习记录</p>
              </div>
              <div className="grid grid-cols-3 gap-6">
                {[
                  [String(recent.words), '练习词数'],
                  [String(recent.exercises), '练习次数'],
                  [recent.accuracy === undefined ? '—' : `${recent.accuracy}%`, '平均正确率'],
                ].map(([value, label], index) => (
                  <div key={label} className={index ? 'border-l border-[var(--wenyan-line-soft)] pl-6' : ''}>
                    <div className="wenyan-metric-value wenyan-mono text-[24px] font-semibold tracking-[-0.04em] text-[var(--wenyan-ink)]" style={{ animationDelay: `${index * 55}ms` }}>{value}</div>
                    <div className="wenyan-muted mt-1 text-[10px]">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-[var(--wenyan-line-soft)]">
              <section className="wenyan-report-section border-b border-[var(--wenyan-line-soft)] py-8" style={{ '--wenyan-delay': '30ms' } as CSSProperties}><HeatmapCharts title="过去一年练习次数" data={exerciseRecord} /></section>
              <section className="wenyan-report-section border-b border-[var(--wenyan-line-soft)] py-8" style={{ '--wenyan-delay': '80ms' } as CSSProperties}><HeatmapCharts title="过去一年练习词数" data={wordRecord} /></section>
              <section className="wenyan-report-section h-[360px] border-b border-[var(--wenyan-line-soft)] py-8" style={{ '--wenyan-delay': '130ms' } as CSSProperties}><LineCharts title="WPM 趋势" name="WPM" data={wpmRecord} /></section>
              <section className="wenyan-report-section h-[360px] border-b border-[var(--wenyan-line-soft)] py-8" style={{ '--wenyan-delay': '180ms' } as CSSProperties}><LineCharts title="正确率趋势" name="正确率(%)" data={accuracyRecord} suffix="%" /></section>
              <section className="wenyan-report-section h-[380px] py-8" style={{ '--wenyan-delay': '230ms' } as CSSProperties}><KeyboardWithBarCharts title="按键错误排行" name="错误次数" data={wrongTimeRecord} /></section>
            </div>
          </>
        )}
      </main>
    </Layout>
  )
}

export default Analysis
