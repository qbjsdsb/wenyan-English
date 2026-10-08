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
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-gray-950 dark:text-gray-100">记录</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">过去一年的练习情况</p>
        </div>

        {isEmpty ? (
          <div className="flex min-h-[320px] items-center justify-center border-y border-black/[0.08] text-sm text-gray-400 dark:border-white/[0.09] dark:text-gray-600">
            暂无练习数据
          </div>
        ) : (
          <div className="border-t border-black/[0.08] dark:border-white/[0.09]">
            <section className="border-b border-black/[0.07] py-8 dark:border-white/[0.08]">
              <HeatmapCharts title="过去一年练习次数" data={exerciseRecord} />
            </section>
            <section className="border-b border-black/[0.07] py-8 dark:border-white/[0.08]">
              <HeatmapCharts title="过去一年练习词数" data={wordRecord} />
            </section>
            <section className="h-[360px] border-b border-black/[0.07] py-8 dark:border-white/[0.08]">
              <LineCharts title="WPM 趋势" name="WPM" data={wpmRecord} />
            </section>
            <section className="h-[360px] border-b border-black/[0.07] py-8 dark:border-white/[0.08]">
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
