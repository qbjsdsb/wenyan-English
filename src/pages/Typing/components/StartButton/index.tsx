import { TypingContext, TypingStateActionType } from '../../store'
import Tooltip from '@/components/Tooltip'
import { randomConfigAtom } from '@/store'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

export default function StartButton({ isLoading }: { isLoading: boolean }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const randomConfig = useAtomValue(randomConfigAtom)

  const onToggleIsTyping = useCallback(() => {
    !isLoading && dispatch({ type: TypingStateActionType.TOGGLE_IS_TYPING })
  }, [isLoading, dispatch])

  const onClickRestart = useCallback(() => {
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: randomConfig.isOpen })
  }, [dispatch, randomConfig.isOpen])

  useHotkeys('enter', onToggleIsTyping, { enableOnFormTags: true, preventDefault: true }, [onToggleIsTyping])

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content={`${state.isTyping ? '暂停' : '开始'}（Enter）`}>
        <button
          className={`${
            state.isTyping
              ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
              : 'border-gray-950 bg-gray-950 text-white hover:bg-gray-800 dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white'
          } inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40`}
          type="button"
          disabled={isLoading}
          onClick={onToggleIsTyping}
          aria-label={state.isTyping ? '暂停' : '开始'}
        >
          {state.isTyping ? <Pause aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
          <span>{state.isTyping ? '暂停' : '开始'}</span>
        </button>
      </Tooltip>

      <Tooltip content="重新开始当前章节">
        <button
          type="button"
          onClick={onClickRestart}
          aria-label="重新开始当前章节"
          className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white/70 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          <RotateCcw aria-hidden="true" size={15} />
        </button>
      </Tooltip>
    </div>
  )
}
