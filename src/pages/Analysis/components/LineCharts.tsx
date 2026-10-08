import useWindowSize from '@/hooks/useWindowSize'
import { isOpenDarkModeAtom } from '@/store'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useAtom } from 'jotai'
import type { FC } from 'react'
import { useEffect, useRef } from 'react'

echarts.use([GridComponent, TooltipComponent, LineChart, CanvasRenderer])

interface LineChartsProps {
  title: string
  data: [string, number][]
  name: string
  suffix?: string
}

const LineCharts: FC<LineChartsProps> = ({ data, title, suffix, name }) => {
  const [isOpenDarkMode] = useAtom(isOpenDarkModeAtom)
  const chartRef = useRef<HTMLDivElement>(null)
  const { width, height } = useWindowSize()

  useEffect(() => {
    if (!chartRef.current || !data.length) return

    let chart = echarts.getInstanceByDom(chartRef.current)
    chart?.dispose()
    chart = echarts.init(chartRef.current, isOpenDarkMode ? 'dark' : undefined)

    const axisColor = isOpenDarkMode ? '#6b7280' : '#9ca3af'
    const splitColor = isOpenDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
    const lineColor = isOpenDarkMode ? '#d1d5db' : '#374151'

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 46, right: 18, top: 24, bottom: 34 },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { show: false },
        axisLabel: { color: axisColor, fontSize: 11 },
        splitLine: { show: false },
        axisPointer: {
          label: {
            formatter: function (params: { seriesData: [{ data: [string, number] }] }) {
              return params.seriesData[0].data[0]
            },
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisColor, fontSize: 11, formatter: (value: number) => value + (suffix || '') },
        splitLine: { lineStyle: { color: splitColor } },
      },
      series: [
        {
          name,
          type: 'line',
          smooth: true,
          showSymbol: false,
          data,
          lineStyle: { color: lineColor, width: 2 },
          itemStyle: { color: lineColor },
          emphasis: { focus: 'series' },
        },
      ],
    })
  }, [data, suffix, name, isOpenDarkMode])

  useEffect(() => {
    if (!chartRef.current) return
    echarts.getInstanceByDom(chartRef.current)?.resize()
  }, [width, height])

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-200">{title}</h2>
      <div ref={chartRef} className="min-h-0 flex-1" />
    </div>
  )
}

export default LineCharts
