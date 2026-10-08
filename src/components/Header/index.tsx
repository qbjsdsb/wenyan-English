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
  `${active ? 'bg-black/[0.045] text-gray-800 dark:bg-white/[0.07] dark:text-gray-200' : 'text-gray-400 hover:bg-black/[0.04] hover:text-gray-800 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-200'} grid h-8 w-8 place-items-center rounded-md transition-colors`

export default function Header({ children }: PropsWithChildren) {
  const [dark, setDark] = useAtom(isOpenDarkModeAtom)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.07] bg-[#f6f6f3]/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#111210]/95">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex min-h-[56px] items-center justify-between gap-6">
          <NavLink className="shrink-0 font-serif text-[19px] font-semibold tracking-[-0.02em] text-gray-950 no-underline dark:text-gray-100" to="/today">
            Wenyan
          </NavLink>

          <div className="flex min-w-0 items-center gap-4">
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
                        ? 'text-gray-950 dark:text-gray-100'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-200'
                    } rounded-md px-2.5 py-1.5 text-[13px] no-underline transition-colors`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-0.5 border-l border-black/[0.07] pl-3 dark:border-white/[0.08]">
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
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] py-2.5 dark:border-white/[0.07]">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
