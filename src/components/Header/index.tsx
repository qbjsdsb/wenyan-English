import { isOpenDarkModeAtom } from '@/store'
import { Moon, Sun } from 'lucide-react'
import { useAtom } from 'jotai'
import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'

const navigation = [
  ['/today', '今天'],
  ['/', '背词'],
  ['/gallery', '词库'],
  ['/analysis', '记录'],
  ['/sync', '同步'],
  ['/preferences', '策略'],
] as const

export default function Header({ children }: PropsWithChildren) {
  const [dark, setDark] = useAtom(isOpenDarkModeAtom)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200/60 bg-[#f7f8fa]/90 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/90">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="flex min-h-[68px] items-center justify-between gap-6">
          <NavLink className="group flex shrink-0 items-center gap-3 no-underline" to="/today">
            <span className="font-serif text-[23px] font-semibold tracking-[-0.03em] text-gray-950 dark:text-gray-50">
              Wenyan<span className="text-indigo-500">.</span>
            </span>
            <span className="hidden rounded-full border border-gray-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-medium tracking-[0.16em] text-gray-500 shadow-sm sm:inline-block dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              文研英语
            </span>
          </NavLink>

          <div className="flex min-w-0 items-center gap-2">
            <nav aria-label="主导航" className="customized-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto rounded-2xl p-1">
              {navigation.map(([path, label]) => (
                <NavLink
                  key={path}
                  end
                  to={path}
                  aria-label={path === '/today' ? '今日学习' : label}
                  className={({ isActive }) =>
                    `${
                      isActive
                        ? 'bg-white text-gray-950 shadow-sm ring-1 ring-gray-200/70 dark:bg-white/10 dark:text-white dark:ring-white/10'
                        : 'text-gray-500 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100'
                    } whitespace-nowrap rounded-xl px-3 py-2 text-sm no-underline transition-all duration-200`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? '切换浅色模式' : '切换深色模式'}
              title={dark ? '浅色模式' : '深色模式'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gray-500 transition-colors hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
            >
              {dark ? <Sun aria-hidden="true" size={17} strokeWidth={1.8} /> : <Moon aria-hidden="true" size={17} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {children && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200/50 py-3 dark:border-white/10">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
