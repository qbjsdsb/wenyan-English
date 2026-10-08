import { isOpenDarkModeAtom } from '@/store'
import { useAtom } from 'jotai'
import type { FC } from 'react'
import React from 'react'
import type { Activity } from 'react-activity-calendar'
import ActivityCalendar from 'react-activity-calendar'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'

interface HeatmapChartsProps {
  title: string
  data: Activity[]
}

const HeatmapCharts: FC<HeatmapChartsProps> = ({ data, title }) => {
  const [isOpenDarkMode] = useAtom(isOpenDarkModeAtom)

  return (
    <div>
      <h2 className="mb-6 text-sm font-medium text-gray-900 dark:text-gray-200">{title}</h2>
      <div className="customized-scrollbar overflow-x-auto pb-2">
        <ActivityCalendar
          fontSize={12}
          blockSize={14}
          blockRadius={3}
          style={{ color: isOpenDarkMode ? '#9ca3af' : '#6b7280', minWidth: 760 }}
          colorScheme={isOpenDarkMode ? 'dark' : 'light'}
          data={data}
          theme={{
            light: ['#e8e8e3', '#4b5563'],
            dark: ['#242522', '#9ca3af'],
          }}
          renderBlock={(block, activity) =>
            React.cloneElement(block, {
              'data-tooltip-id': 'react-tooltip',
              'data-tooltip-html': `${activity.date} 练习 ${activity.count} 次`,
            })
          }
          showWeekdayLabels
          labels={{
            months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
            weekdays: ['日', '一', '二', '三', '四', '五', '六'],
            totalCount: '过去一年总计 {{count}} 次',
            legend: { less: '少', more: '多' },
          }}
        />
      </div>
      <ReactTooltip id="react-tooltip" />
    </div>
  )
}

export default HeatmapCharts
