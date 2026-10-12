import { isOpenDarkModeAtom } from '@/store'
import { useAtom } from 'jotai'
import { Cloud, Milestone, Moon, Sun } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { Link, useLocation } from 'react-router-dom'

const navigation = [
  { path: '/today', label: '今天', ariaLabel: '今日学习', matches: ['/today'] },
  { path: '/', label: '背词', ariaLabel: '练习', matches: ['/'] },
  {
    path: '/practice',
    label: '专项',
    ariaLabel: '专项',
    matches: ['/practice', '/semantic/', '/semantic-check/', '/semantic-production/'],
  },
  { path: '/gallery', label: '词库', ariaLabel: '词库', matches: ['/gallery'] },
  { path: '/analysis', label: '记录', ariaLabel: '记录', matches: ['/analysis', '/error-book'] },
]

const utilityClass = (active = false) =>
  `${
    active
      ? 'bg-[var(--wenyan-paper-muted)] text-[var(--wenyan-ink)]'
      : 'text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
  } grid h-[36px] w-[36px] place-items-center rounded-[var(--wenyan-radius-sm)]`

export default function Header({ children }: PropsWithChildren) {
  const [dark, setDark] = useAtom(isOpenDarkModeAtom)
  const { pathname } = useLocation()

  return (
    <header className="wenyan-chrome sticky top-0 z-40 w-full border-b border-[var(--wenyan-line-soft)]">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="wenyan-header-row flex min-h-[64px] items-center gap-8">
          <Link className="wenyan-brand shrink-0 text-[23px] font-semibold no-underline" to="/today">
            Wenyan
          </Link>
          <nav aria-label="主导航" className="wenyan-header-navigation ml-auto flex min-w-0 items-center gap-1">
            {navigation.map(({ path, label, ariaLabel, matches }) => {
              const active = matches.some((match) =>
                match.endsWith('/') && match !== '/' ? pathname.startsWith(match) : pathname === match,
              )
              return (
                <Link
                  key={path}
                  to={path}
                  aria-label={ariaLabel}
                  aria-current={active ? 'page' : undefined}
                  className={`wenyan-nav-link relative px-3.5 py-3 text-[13px] font-medium no-underline ${active ? 'is-active' : ''}`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="wenyan-header-utilities flex items-center gap-1 border-l border-[var(--wenyan-line-soft)] pl-4">
            <Link
              to="/sync"
              aria-label="同步"
              title="同步"
              aria-current={pathname === '/sync' ? 'page' : undefined}
              className={utilityClass(pathname === '/sync')}
            >
              <Cloud aria-hidden="true" size={16} strokeWidth={1.7} />
            </Link>
            <Link
              to="/preferences"
              aria-label="学习阶段"
              title="学习阶段"
              aria-current={pathname === '/preferences' ? 'page' : undefined}
              className={utilityClass(pathname === '/preferences')}
            >
              <Milestone aria-hidden="true" size={16} strokeWidth={1.7} />
            </Link>
            <button
              type="button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? '切换浅色模式' : '切换深色模式'}
              title={dark ? '浅色模式' : '深色模式'}
              className={utilityClass()}
            >
              {dark ? <Sun aria-hidden="true" size={16} strokeWidth={1.7} /> : <Moon aria-hidden="true" size={16} strokeWidth={1.7} />}
            </button>
          </div>
        </div>
        {children && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--wenyan-line-soft)] py-2.5">{children}</div>
        )}
      </div>
    </header>
  )
}
