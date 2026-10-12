import Header from '@/components/Header'
import React from 'react'
import { useLocation } from 'react-router-dom'

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
  const { pathname } = useLocation()
  const standalone = pathname.startsWith('/oauth/')
  return (
    <div className="wenyan-page-loading text-[var(--wenyan-ink)]" aria-busy="true">
      {!standalone && <Header />}
      <main className="wenyan-page-loading-content">
        <p className="flex items-center gap-2">
          <LoadingUI size="sm" label="正在打开页面" />
          <span>正在准备页面</span>
        </p>
      </main>
    </div>
  )
}

export default React.memo(Loading)
