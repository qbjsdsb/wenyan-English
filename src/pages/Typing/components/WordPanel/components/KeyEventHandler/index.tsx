import type { WordUpdateAction } from '../InputHandler'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import { isChineseSymbol, isLegal } from '@/utils'
import { useCallback, useContext, useEffect } from 'react'

export default function KeyEventHandler({ updateInput }: { updateInput: (updateObj: WordUpdateAction) => void }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (ignoresStudyKey(e) || state.isFinished || state.isSavingRecord) return
      const char = e.key

      if (isChineseSymbol(char)) {
        alert('您正在使用输入法，请关闭输入法。')
        return
      }

      if (isLegal(char) && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (!state.isTyping) {
          dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
          if (char === ' ') {
            e.preventDefault()
            return
          }
        }
        updateInput({ type: 'add', value: char, event: e })
      }
    },
    [updateInput, dispatch, state.isTyping, state.isFinished, state.isSavingRecord],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [onKeydown, state.isTyping])

  return <></>
}
