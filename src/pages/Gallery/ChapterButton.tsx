import { useChapterStats } from './hooks/useChapterStats'
import useIntersectionObserver from '@/hooks/useIntersectionObserver'
import type React from 'react'
import { useEffect, useRef } from 'react'

export const ChapterButton: React.FC<ChapterButtonProps> = ({ index, selected, wordCount, onClick }) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const entry = useIntersectionObserver(buttonRef, {})
  const isVisible = !!entry?.isIntersecting
  const chapterStatus = useChapterStats(index, isVisible)

  useEffect(() => {
    if (selected && buttonRef.current !== null) {
      const button = buttonRef.current
      const container = button.parentElement?.parentElement
      const halfHeight = button.getBoundingClientRect().height / 2
      container?.scrollTo({ top: Math.max(button.offsetTop - container.offsetTop - halfHeight, 0), behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const status = chapterStatus
    ? chapterStatus.exerciseCount > 0
      ? `练习 ${chapterStatus.exerciseCount} 次 · 平均错 ${chapterStatus.avgWrongCount}`
      : '未练习'
    : ''

  return (
    <button
      ref={buttonRef}
      className={`${
        selected
          ? 'border-gray-900 bg-black/[0.035] dark:border-gray-200 dark:bg-white/[0.06]'
          : 'border-black/[0.08] hover:border-black/[0.18] dark:border-white/[0.09] dark:hover:border-white/[0.18]'
      } min-h-[92px] rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50`}
      type="button"
      onClick={onClick}
      title="选择章节"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-200">第 {index + 1} 章</p>
        <p className="text-[11px] tabular-nums text-gray-400 dark:text-gray-600">{wordCount} 词</p>
      </div>
      <p className="mt-5 text-[11px] text-gray-400 dark:text-gray-600">{status || '读取中'}</p>
    </button>
  )
}

export default ChapterButton

export type ChapterButtonProps = {
  index: number
  selected: boolean
  wordCount: number
  onClick: () => void
}
