import HeatmapCharts from './components/HeatmapCharts'
import KeyboardWithBarCharts from './components/KeyboardWithBarCharts'
import LineCharts from './components/LineCharts'
import { useWordStats } from './hooks/useWordStats'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { LoadingUI } from '@/components/Loading'
import PageHeading from '@/components/PageHeading'
import RecordNavigation from '@/components/RecordNavigation'
import VocabularyEvidence from '@/components/VocabularyEvidence'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import { isOpenDarkModeAtom } from '@/store'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'

const Analysis = () => {
  const navigate = useNavigate()
  const [calendarMetric, setCalendarMetric] = useState<'attempts' | 'words'>('attempts')
  const [showInputDetails, setShowInputDetails] = useState(false)
  const [, setIsOpenDarkMode] = useAtom(isOpenDarkModeAtom)

  useHotkeys('ctrl+d', () => setIsOpenDarkMode((old) => !old), { enableOnFormTags: true, preventDefault: true }, [])
  useHotkeys('esc', () => navigate('/today'), { ignoreEventWhen: ignoresStudyKey, preventDefault: true })

  const { error, retry, isEmpty, attemptRecord, wordRecord, typingPaceRecord, accuracyRecord, wrongTimeRecord, legacyAttempts, recent7 } =
    useWordStats(dayjs().subtract(1, 'year').startOf('day').unix(), dayjs().endOf('day').unix())

  return (
    <Layout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-9">
        <PageHeading title="记录" description="回看练习，再决定下一步。" />

        <RecordNavigation />

        {error ? (
          <section className="wenyan-surface p-7" role="alert">
            <p>暂时无法读取当前账号的学习记录。</p>
            <button className="wenyan-button-secondary mt-4" onClick={retry}>
              重新读取
            </button>
          </section>
        ) : isEmpty === undefined ? (
          <div className="flex min-h-[120px] items-center justify-center" role="status">
            <LoadingUI label="正在整理学习记录" />
          </div>
        ) : isEmpty ? (
          <section className="mb-8 border-y border-[var(--wenyan-line-soft)] py-6" aria-label="拼写记录">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <h2 className="text-sm font-medium text-[var(--wenyan-ink)]">还没有拼写记录</h2>
                <p className="wenyan-muted mt-1.5 text-xs leading-5">这里只影响拼写统计，下面的词义训练记录仍会正常显示。</p>
              </div>
              <button className="wenyan-link text-xs" onClick={() => navigate('/')}>
                开始一次拼写 →
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="wenyan-report-summary mb-8 rounded-[var(--wenyan-radius-lg)] border border-[var(--wenyan-line-soft)] px-6 py-5">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <div>
                  <p className="wenyan-muted text-[11px]">最近 7 天</p>
                  <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[var(--wenyan-ink)]">拼写节奏</h2>
                </div>
                <p className="wenyan-muted text-xs">{legacyAttempts > 0 ? `含 ${legacyAttempts} 条旧版本机记录` : '当前账号'}</p>
              </div>
              <div className="grid grid-cols-3 gap-6">
                {[
                  [String(recent7.distinctWords), '不同单词'],
                  [String(recent7.attempts), '拼写词次'],
                  [recent7.inputAccuracy === undefined ? '—' : `${recent7.inputAccuracy}%`, '按键准确率'],
                ].map(([value, label], index) => (
                  <div key={label} className={index ? 'border-l border-[var(--wenyan-line-soft)] pl-6' : ''}>
                    <div className="wenyan-metric-value wenyan-mono text-[24px] font-semibold tracking-[-0.04em] text-[var(--wenyan-ink)]">
                      {value}
                    </div>
                    <div className="wenyan-muted mt-1 text-[11px]">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="wenyan-calendar-section mb-8 border-y border-[var(--wenyan-line-soft)] py-6" aria-label="学习日历">
              <fieldset className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <legend className="sr-only">学习日历统计方式</legend>
                <span className="wenyan-muted text-xs">每一天留下的练习</span>
                <div className="wenyan-segmented-control">
                  {(
                    [
                      ['attempts', '练习词次'],
                      ['words', '不同单词'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className={calendarMetric === value ? 'is-selected' : ''}>
                      <input
                        type="radio"
                        name="calendar-metric"
                        className="sr-only"
                        checked={calendarMetric === value}
                        onChange={() => setCalendarMetric(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <HeatmapCharts
                title={calendarMetric === 'attempts' ? '过去一年拼写词次' : '过去一年每日不同单词'}
                data={calendarMetric === 'attempts' ? attemptRecord : wordRecord}
                metric={calendarMetric}
              />
              <p className="wenyan-muted mt-3 text-[11px] leading-5">
                {calendarMetric === 'attempts'
                  ? '每完成一次单词拼写，记录一次练习。'
                  : '同一单词当天只计一次；跨日期练习会分别计入当天词数。'}
              </p>
            </section>
          </>
        )}

        <VocabularyEvidence />

        {!error && isEmpty === false && (
          <section className="wenyan-input-details border-t border-[var(--wenyan-line-soft)]">
            <button
              type="button"
              className="wenyan-disclosure-button"
              aria-expanded={showInputDetails}
              aria-controls="input-detail-charts"
              onClick={() => setShowInputDetails((value) => !value)}
            >
              <span>
                <span className="block text-sm font-medium">输入细节</span>
                <span className="wenyan-muted mt-1 block text-xs font-normal">输入节奏、按键准确率与容易按错的字母</span>
              </span>
              <span aria-hidden="true" className="wenyan-disclosure-mark">
                {showInputDetails ? '−' : '+'}
              </span>
            </button>
            <div id="input-detail-charts" hidden={!showInputDetails}>
              {showInputDetails && (
                <>
                  <p className="wenyan-muted mb-4 text-xs leading-6">这些数据描述键盘输入，不代表词义掌握或回忆速度。</p>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="h-[300px] min-w-0 py-5">
                      <LineCharts title="输入节奏趋势" name="活跃键入词/分钟" data={typingPaceRecord} />
                    </section>
                    <section className="h-[300px] min-w-0 py-5">
                      <LineCharts title="按键准确率趋势" name="按键准确率(%)" data={accuracyRecord} suffix="%" />
                    </section>
                  </div>
                  <section className="h-[360px] border-t border-[var(--wenyan-line-soft)] py-6">
                    <KeyboardWithBarCharts title="按键错误排行" name="按错次数" data={wrongTimeRecord} />
                  </section>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </Layout>
  )
}

export default Analysis