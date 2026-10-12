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
        <div aria-hidden="true" className="wenyan-subtle-skeleton h-7 w-28" />
        <p>
          <LoadingUI size="sm" label="正在打开页面" /> <span className="ml-2">正在准备内容…</span>
        </p>
        <div aria-hidden="true" className="wenyan-subtle-skeleton h-40 w-full" />
      </main>
    </div>
  )
}

export default React.memo(Loading)
