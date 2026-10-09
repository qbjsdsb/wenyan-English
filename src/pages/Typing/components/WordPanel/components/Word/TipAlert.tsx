import type { FC } from 'react'

export type ITipAlert = {
  className?: string
  show: boolean
  setShow: (show: boolean) => void
}

export const TipAlert: FC<ITipAlert> = ({ className, show, setShow }) =>
  show ? (
    <div role="status" className={`wenyan-input-tip z-10 max-w-sm p-4 ${className}`}>
      <p className="text-sm font-medium text-[var(--wenyan-ink)]">先看一眼，再试一次</p>
      <p className="wenyan-muted mt-2 text-xs leading-6">按住 Tab 查看提示，松开后重新输入。请确认使用英文输入法；也可以先跳过这个词。</p>
      <button type="button" className="wenyan-link mt-2 text-xs" onClick={() => setShow(false)} aria-label="收起输入提示">
        知道了
      </button>
    </div>
  ) : null
