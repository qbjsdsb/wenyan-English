import { isOpenDarkModeAtom } from '@/store'
import { Cloud, Moon, Settings, Sun } from 'lucide-react'
import { useAtom } from 'jotai'
import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'

const navigation = [
  ['/today', '今天'],
  ['/', '背词'],
  ['/gallery', '词库'],
  ['/analysis', '记录'],
] as const

const utilityClass = (active = false) =>
  `${
    active
      ? 'bg-[var(--wenyan-accent-soft)] text-[var(--wenyan-accent)]'
      : 'text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
  } grid h-[32px] w-[32px] place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors`

export default function Header({ children }: PropsWithChildren) {
  const [dark, setDark] = useAtom(isOpenDarkModeAtom)

  return (
    <header className="wenyan-chrome sticky top-0 z-40 w-full border-b border-[var(--wenyan-line-soft)]">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex min-h-[60px] items-center justify-between gap-6">
          <NavLink className="wenyan-brand shrink-0 text-[21px] font-semibold no-underline" to="/today">
            Wenyan
          </NavLink>

          <div className="flex min-w-0 items-center gap-3.5">
            <nav aria-label="主导航" className="flex min-w-0 items-center gap-1">
              {navigation.map(([path, label]) => (
                <NavLink
                  key={path}
                  end
                  to={path}
                  aria-label={path === '/today' ? '今日学习' : path === '/' ? '练习' : label}
                  className={({ isActive }) =>
                    `${
                      isActive
                        ? 'bg-[var(--wenyan-accent-soft)] text-[var(--wenyan-accent)]'
                        : 'text-[var(--wenyan-ink-secondary)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
                    } relative rounded-[var(--wenyan-radius-sm)] px-3 py-1.5 text-[13px] font-medium no-underline transition-colors`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1 border-l border-[var(--wenyan-line-soft)] pl-3">
              <NavLink to="/sync" aria-label="同步" title="同步" className={({ isActive }) => utilityClass(isActive)}>
                <Cloud aria-hidden="true" size={15} strokeWidth={1.7} />
              </NavLink>
              <NavLink to="/preferences" aria-label="设置" title="设置" className={({ isActive }) => utilityClass(isActive)}>
                <Settings aria-hidden="true" size={15} strokeWidth={1.7} />
              </NavLink>
              <button
                type="button"
                onClick={() => setDark(!dark)}
                aria-label={dark ? '切换浅色模式' : '切换深色模式'}
                title={dark ? '浅色模式' : '深色模式'}
                className={utilityClass()}
              >
                {dark ? <Sun aria-hidden="true" size={15} strokeWidth={1.7} /> : <Moon aria-hidden="true" size={15} strokeWidth={1.7} />}
              </button>
            </div>
          </div>
        </div>

        {children && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--wenyan-line-soft)] py-2.5">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
