import { LoadingUI } from '@/components/Loading'
import type { FC } from 'react'
import ErrorIcon from '~icons/ic/outline-error'

type LoadingWordUIProps = {
  className?: string
  isLoading: boolean
  hasError: boolean
}

export const LoadingWordUI: FC<LoadingWordUIProps> = ({ className = '', isLoading, hasError }) => {
  if (hasError) {
    return (
      <span className={`wenyan-word-loading-error ${className}`} title="词义加载失败" role="status">
        <ErrorIcon className="h-3.5 w-3.5" />
        <span className="text-[11px]">加载失败</span>
      </span>
    )
  }

  if (!isLoading) return null

  return (
    <span className={className}>
      <LoadingUI size="sm" label="正在读取词义" />
    </span>
  )
}
