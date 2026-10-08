import { TypingContext } from '../../store'
import { useContext, useEffect, useState } from 'react'

export default function Progress({ className }: { className?: string }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const total = state.chapterData.words.length
    const newProgress = total > 0 ? Math.floor((state.chapterData.index / total) * 100) : 0
    setProgress(newProgress)
  }, [state.chapterData.index, state.chapterData.words.length])

  return (
    <div className={`relative w-[220px] pt-1 ${className}`}>
      <div className="mb-4 h-[3px] overflow-hidden rounded-full bg-[var(--wenyan-paper-muted)]">
        <div
          style={{ width: `${progress}%` }}
          className="h-full rounded-full bg-[var(--wenyan-accent)] transition-[width] duration-300 ease-out"
        />
      </div>
    </div>
  )
}
