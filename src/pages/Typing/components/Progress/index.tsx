import { TypingContext } from '../../store'
import { useContext } from 'react'

export default function Progress({ className }: { className?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const total = state.chapterData.words.length
  const index = state.chapterData.index
  const progress = total > 0 ? Math.floor((index / total) * 100) : 0

  return (
    <div className={`relative w-[220px] pt-1 ${className}`}>
      {!state.isTyping && total > 0 && (
        <p className="wenyan-muted mb-3 text-center text-xs">当前位置 <span className="wenyan-mono ml-2">{Math.min(index + 1, total)} / {total}</span></p>
      )}
      <div role="progressbar" aria-label="章节位置" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={index}
        aria-valuetext={`第 ${Math.min(index + 1, total)} 个，共 ${total} 个词`}
        className="mb-4 h-[3px] overflow-hidden rounded-full bg-[var(--wenyan-paper-muted)]">
        <div style={{ width: `${progress}%` }} className="h-full rounded-full bg-[var(--wenyan-accent)] transition-[width] duration-300 ease-out" />
      </div>
    </div>
  )
}
