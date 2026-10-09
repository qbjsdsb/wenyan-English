import { ignoresStudyKey } from '../../keyboard'
import { TypingContext, TypingStateActionType } from '../../store'
import Tooltip from '@/components/Tooltip'
import { randomConfigAtom } from '@/store'
import { useAtomValue } from 'jotai'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useContext } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

export default function StartButton({ isLoading }: { isLoading: boolean }) {
  const { state, dispatch, restartChapter } = useContext(TypingContext)!
  const randomConfig = useAtomValue(randomConfigAtom)

  const onToggleIsTyping = useCallback(() => {
    !isLoading && !state.isSavingRecord && dispatch({ type: TypingStateActionType.TOGGLE_IS_TYPING })
  }, [isLoading, state.isSavingRecord, dispatch])

  const onClickRestart = useCallback(() => {
    if (restartChapter) {
      void restartChapter(randomConfig.isOpen)
      return
    }
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: randomConfig.isOpen })
  }, [dispatch, randomConfig.isOpen, restartChapter])

  useHotkeys(
    'enter',
    onToggleIsTyping,
    { enabled: !isLoading && !state.isFinished && !state.isSavingRecord, ignoreEventWhen: ignoresStudyKey, preventDefault: true },
    [onToggleIsTyping],
  )
  useHotkeys(
    'esc',
    () => dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false }),
    { enabled: state.isTyping, ignoreEventWhen: ignoresStudyKey, preventDefault: true },
    [dispatch],
  )

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content={`${state.isTyping ? '暂停（Enter / Esc）' : '开始（Enter）'}`}>
        <button
          className={`${
            state.isTyping ? 'wenyan-button-secondary' : 'wenyan-button-primary'
          } inline-flex items-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-40`}
          type="button"
          disabled={isLoading || state.isSavingRecord}
          onClick={(event) => {
            onToggleIsTyping()
            event.currentTarget.blur()
          }}
          aria-label={state.isTyping ? '暂停' : '开始'}
        >
          {state.isTyping ? (
            <Pause aria-hidden="true" size={14} strokeWidth={1.8} />
          ) : (
            <Play aria-hidden="true" size={14} strokeWidth={1.8} />
          )}
          <span>{state.isTyping ? '暂停' : '开始'}</span>
        </button>
      </Tooltip>

      <Tooltip content="重新开始当前章节">
        <button
          type="button"
          disabled={isLoading || state.isSavingRecord}
          onClick={(event) => {
            onClickRestart()
            event.currentTarget.blur()
          }}
          aria-label="重新开始当前章节"
          className="wenyan-button-secondary grid min-h-[var(--wenyan-control-height)] w-9 place-items-center !px-0 text-[var(--wenyan-ink-muted)] hover:text-[var(--wenyan-ink)]"
        >
          <RotateCcw aria-hidden="true" size={14} strokeWidth={1.75} />
        </button>
      </Tooltip>
    </div>
  )
}
