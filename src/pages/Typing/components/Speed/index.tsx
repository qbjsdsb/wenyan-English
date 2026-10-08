import { TypingContext } from '../../store'
import InfoBox from './InfoBox'
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

  return (
    <div
      aria-label="本次学习数据"
      className={`mb-7 flex items-center justify-center gap-7 border-t border-[var(--wenyan-line-soft)] pt-4 transition-opacity duration-200 ${
        state.isTyping ? 'opacity-80' : 'opacity-55'
      }`}
    >
      <InfoBox info={`${minutesString}:${secondsString}`} description="时间" />
      <InfoBox info={inputNumber + ''} description="输入" />
      <InfoBox info={state.timerData.wpm + ''} description="WPM" />
      <InfoBox info={state.chapterData.correctCount + ''} description="正确" />
      <InfoBox info={state.timerData.accuracy + ''} description="正确率" />
    </div>
  )
}
