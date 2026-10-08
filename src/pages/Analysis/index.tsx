import HeatmapCharts from './components/HeatmapCharts'
import KeyboardWithBarCharts from './components/KeyboardWithBarCharts'
import LineCharts from './components/LineCharts'
import { useWordStats } from './hooks/useWordStats'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { isOpenDarkModeAtom } from '@/store'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'

const Analysis = () => {
  const navigate = useNavigate()
  const [, setIsOpenDarkMode] = useAtom(isOpenDarkModeAtom)

  useHotkeys('ctrl+d', () => setIsOpenDarkMode((old) => !old), { enableOnFormTags: true, preventDefault: true }, [])
  useHotkeys('enter,esc', () => navigate('/today'), { preventDefault: true })

  const { isEmpty, exerciseRecord, wordRecord, wpmRecord, accuracyRecord, wrongTimeRecord } = useWordStats(
    dayjs().subtract(1, 'year').unix(),
    dayjs().unix(),
  )

  return (
    <Layout>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-9">
        <div className="mb-7">
          <h1 className="wenyan-page-title">记录</h1>
          <p className="wenyan-muted mt-2 text-sm">过去一年的练习情况</p>
        </div>

        {isEmpty ? (
          <div className="wenyan-muted flex min-h-[320px] items-center justify-center border-y border-[var(--wenyan-line-soft)] text-sm">
            暂无练习数据
          </div>
        ) : (
          <div className="border-t border-[var(--wenyan-line-soft)]">
            <section className="border-b border-[var(--wenyan-line-soft)] py-8">
              <HeatmapCharts title="过去一年练习次数" data={exerciseRecord} />
            </section>
            <section className="border-b border-[var(--wenyan-line-soft)] py-8">
              <HeatmapCharts title="过去一年练习词数" data={wordRecord} />
            </section>
            <section className="h-[360px] border-b border-[var(--wenyan-line-soft)] py-8">
              <LineCharts title="WPM 趋势" name="WPM" data={wpmRecord} />
            </section>
            <section className="h-[360px] border-b border-[var(--wenyan-line-soft)] py-8">
              <LineCharts title="正确率趋势" name="正确率(%)" data={accuracyRecord} suffix="%" />
            </section>
            <section className="h-[380px] py-8">
              <KeyboardWithBarCharts title="按键错误排行" name="错误次数" data={wrongTimeRecord} />
            </section>
          </div>
        )}
      </main>
    </Layout>
  )
}

export default Analysis
