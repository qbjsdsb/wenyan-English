import React from 'react'

type LoadingUIProps = {
  className?: string
  label?: string
  size?: 'sm' | 'md'
}

export const LoadingUI: React.FC<LoadingUIProps> = ({ className = '', label = '正在加载', size = 'md' }) => {
  const dot = size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'
  return (
    <span className={`wenyan-inline-loader inline-flex items-center gap-1.5 ${className}`} role="status" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`${dot} rounded-full bg-[var(--wenyan-accent)]`}
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </span>
  )
}

const Loading: React.FC = () => {
  return (
    <div className="wenyan-loading-screen fixed inset-0 z-50 grid place-items-center text-[var(--wenyan-ink)]">
      <div className="flex flex-col items-center gap-4">
        <div className="wenyan-loading-mark wenyan-brand text-[21px] font-semibold">Wenyan</div>
        <LoadingUI label="正在打开 Wenyan" />
      </div>
    </div>
  )
}

export default React.memo(Loading)
