import { isOpenDarkModeAtom } from '@/store'
import { useAtom } from 'jotai'
import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'

export default function Header({ children }: PropsWithChildren) {
  const [dark, setDark] = useAtom(isOpenDarkModeAtom)
  return (
    <header className="z-20 mx-auto w-full max-w-7xl px-6 py-5 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-gray-200/80 pb-5 dark:border-gray-700">
        <NavLink className="flex items-baseline gap-3 no-underline" to="/today">
          <span className="font-serif text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Wenyan<span className="text-indigo-500">.</span></span>
          <span className="text-xs tracking-widest text-gray-500">文研 · 英语</span>
        </NavLink>
        <nav aria-label="主导航" className="flex flex-wrap items-center gap-1">
          {[[ '/today', '今日学习' ], [ '/', '练习' ], [ '/gallery', '词库' ], [ '/analysis', '记录' ], [ '/sync', '云同步' ]].map(([path, label]) => (
            <NavLink key={path} end to={path} className={({ isActive }) => `${isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-gray-800 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'} rounded-lg px-3 py-2 text-sm no-underline transition-colors hover:bg-gray-100 dark:hover:bg-gray-800`}>
              {label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setDark(!dark)} aria-label={dark ? '切换浅色' : '切换深色'} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">{dark ? '浅色' : '深色'}</button>
        </nav>
      </div>
      {children && <div className="flex flex-wrap items-center justify-end gap-3 pt-4">{children}</div>}
    </header>
  )
}
