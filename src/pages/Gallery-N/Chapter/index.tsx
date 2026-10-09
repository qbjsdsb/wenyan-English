import { useChapterStats } from '../hooks/useChapterStats'
import useIntersectionObserver from '@/hooks/useIntersectionObserver'
import { useEffect, useRef } from 'react'

export default function Chapter({
  index,
  checked,
  dictID,
  onChange,
}: {
  index: number
  checked: boolean
  dictID: string
  onChange: (index: number) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  const entry = useIntersectionObserver(ref, {})
  const isVisible = !!entry?.isIntersecting
  const chapterStatus = useChapterStats(index, dictID, isVisible)

  useEffect(() => {
    if (checked && ref.current !== null) {
      const button = ref.current
      const container = button.parentElement?.parentElement?.parentElement
      container?.scroll({
        top: button.offsetTop - container.offsetTop - 300,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
  }, [checked])

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`开始第 ${index + 1} 章`}
      aria-current={checked ? 'step' : undefined}
      className={`wenyan-chapter-choice relative flex min-h-[76px] w-full cursor-pointer flex-col items-start justify-center rounded-[var(--wenyan-radius-sm)] border px-3 py-2 text-left transition-colors ${
        checked
          ? 'border-[color-mix(in_srgb,var(--wenyan-accent)_38%,var(--wenyan-line))] bg-[var(--wenyan-accent-soft)]'
          : 'border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper)] hover:border-[var(--wenyan-line)] hover:bg-[var(--wenyan-paper-muted)]'
      }`}
      onClick={() => onChange(index)}
    >
      <span className={`text-sm font-medium ${checked ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink)]'}`}>第 {index + 1} 章</span>
      <span className="wenyan-muted pt-[2px] text-[11px]">
        {chapterStatus ? (chapterStatus.exerciseCount > 0 ? `练习 ${chapterStatus.exerciseCount} 次` : '未练习') : '加载中…'}
      </span>
    </button>
  )
}
