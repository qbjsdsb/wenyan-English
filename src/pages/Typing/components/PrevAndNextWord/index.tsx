import { TypingContext, TypingStateActionType } from '../../store'
import Tooltip from '@/components/Tooltip'
import { currentDictInfoAtom, wordDictationConfigAtom } from '@/store'
import { CTRL } from '@/utils'
import { useAtomValue } from 'jotai'
import { useCallback, useContext, useMemo } from 'react'
import IconPrev from '~icons/tabler/arrow-narrow-left'
import IconNext from '~icons/tabler/arrow-narrow-right'

export default function PrevAndNextWord({ type }: LastAndNextWordProps) {
  const { state, dispatch } = useContext(TypingContext)!
  const wordDictationConfig = useAtomValue(wordDictationConfigAtom)
  const newIndex = useMemo(() => state.chapterData.index + (type === 'prev' ? -1 : 1), [state.chapterData.index, type])
  const word = state.chapterData.words[newIndex]
  const shortCutKey = useMemo(() => (type === 'prev' ? `${CTRL} + Shift + ArrowLeft` : `${CTRL} + Shift + ArrowRight`), [type])
  const currentLanguage = useAtomValue(currentDictInfoAtom).language

  const onClickWord = useCallback(() => {
    if (!word) return
    dispatch({ type: TypingStateActionType.SKIP_2_WORD_INDEX, newIndex })
  }, [dispatch, newIndex, word])

  const headWord = useMemo(() => {
    if (!word) return ''
    const showWord = ['romaji', 'hapin'].includes(currentLanguage) ? word.notation : word.name
    if (type === 'next' && wordDictationConfig.isOpen) return (showWord || '').replace(/./g, '_')
    return showWord
  }, [word, currentLanguage, type, wordDictationConfig.isOpen])

  if (!word) return <div />

  const label = type === 'prev' ? '上一词' : '下一词'

  return (
    <Tooltip content={`${label} · ${shortCutKey}`}>
      <button
        type="button"
        onClick={onClickWord}
        aria-label={`${label} ${headWord}`}
        className="group flex max-w-[220px] select-none items-center gap-2 rounded-md px-2 py-1 text-[var(--wenyan-ink-muted)] opacity-35 transition-all hover:bg-[color-mix(in_srgb,var(--wenyan-paper-raised)_46%,transparent)] hover:text-[var(--wenyan-ink-secondary)] hover:opacity-90 focus-visible:opacity-100"
      >
        {type === 'prev' && <IconPrev className="h-3.5 w-3.5 shrink-0" />}
        <span className="text-[9px] tracking-[0.06em]">{label}</span>
        <span className={`wenyan-mono truncate text-[12px] ${wordDictationConfig.isOpen ? 'tracking-wider' : ''}`}>{headWord}</span>
        {type === 'next' && <IconNext className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />}
      </button>
    </Tooltip>
  )
}

export type LastAndNextWordProps = {
  /** 上一个单词还是下一个单词 */
  type: 'prev' | 'next'
}
