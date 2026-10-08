import { recordAnalysisAction } from '@/utils'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ChartPie from '~icons/heroicons/chart-pie-solid'

const AnalysisButton = () => {
  const navigate = useNavigate()

  const toAnalysis = useCallback(() => {
    navigate('/analysis')
    recordAnalysisAction('open')
  }, [navigate])

  return (
    <button
      type="button"
      onClick={toAnalysis}
      className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]"
      title="查看数据统计"
      aria-label="查看数据统计"
    >
      <ChartPie className="icon" />
    </button>
  )
}

export default AnalysisButton
