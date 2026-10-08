import { TypingContext } from '../../store'
import { useContext } from 'react'

export default function Speed() {
  const { state } = useContext(TypingContext)!
  const seconds = state.timerData.time % 60
  const minutes = Math.floor(state.timerData.time / 60)
  const secondsString = seconds < 10 ? '0' + seconds : seconds + ''
  const minutesString = minutes < 10 ? '0' + minutes : minutes + ''
  const inputNumber = state.chapterData.correctCount + state.chapterData.wrongCount
  const hasActivity = state.isTyping || state.timerData.time > 0 || inputNumber > 0

  if (!hasActivity) return null

  const time = `${minutesString}:${secondsString}`
  const detailLabel = `本次学习数据：时间 ${time}，输入 ${inputNumber}，WPM ${state.timerData.wpm}，正确 ${state.chapterData.correctCount}，正确率 ${state.timerData.accuracy}%`

  return (
    <div
      aria-label={detailLabel}
      className={`wenyan-focus-metrics mb-5 flex items-center justify-center gap-3 text-[10px] tracking-[0.015em] transition-opacity duration-200 ${
        state.isTyping ? 'opacity-70' : 'opacity-45'
      }`}
    >
      <span className="tabular-nums text-[var(--wenyan-ink-secondary)]">{time}</span>
      <span aria-hidden="true" className="opacity-35">·</span>
      <span className="tabular-nums"><strong className="font-medium text-[var(--wenyan-ink-secondary)]">{state.timerData.wpm}</strong> WPM</span>
      <span aria-hidden="true" className="opacity-35">·</span>
      <span className="tabular-nums"><strong className="font-medium text-[var(--wenyan-ink-secondary)]">{state.timerData.accuracy}%</strong> 正确率</span>
      {inputNumber > 0 && (
        <>
          <span aria-hidden="true" className="opacity-35">·</span>
          <span className="tabular-nums">{state.chapterData.correctCount}/{inputNumber} 正确</span>
        </>
      )}
    </div>
  )
}
