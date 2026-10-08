import { TypingContext, TypingStateActionType } from '../../store'
import type { TypingState } from '../../store/type'
import PrevAndNextWord from '../PrevAndNextWord'
import Progress from '../Progress'
import Phonetic from './components/Phonetic'
import Translation from './components/Translation'
import WordComponent from './components/Word'
import { usePrefetchPronunciationSound } from '@/hooks/usePronunciation'
import { isSmartSessionHardStopReached } from '@/smart-session/runtime'
import { isReviewModeAtom, isShowPrevAndNextWordAtom, loopWordConfigAtom, phoneticConfigAtom, reviewModeInfoAtom } from '@/store'
import type { Word } from '@/typings'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function WordPanel() {
  const { state, dispatch } = useContext(TypingContext)!
  const phoneticConfig = useAtomValue(phoneticConfigAtom)
  const isShowPrevAndNextWord = useAtomValue(isShowPrevAndNextWordAtom)
  const [wordComponentKey, setWordComponentKey] = useState(0)
  const [currentWordExerciseCount, setCurrentWordExerciseCount] = useState(0)
  const { times: loopWordTimes } = useAtomValue(loopWordConfigAtom)
  const currentWord = state.chapterData.words[state.chapterData.index]
  const nextWord = state.chapterData.words[state.chapterData.index + 1] as Word | undefined
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const smartSessionId = searchParams.get('smartSession')

  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const isReviewMode = useAtomValue(isReviewModeAtom)

  const prevIndex = useMemo(() => {
    const newIndex = state.chapterData.index - 1
    return newIndex < 0 ? 0 : newIndex
  }, [state.chapterData.index])
  const nextIndex = useMemo(() => {
    const newIndex = state.chapterData.index + 1
    return newIndex > state.chapterData.words.length - 1 ? state.chapterData.words.length - 1 : newIndex
  }, [state.chapterData.index, state.chapterData.words.length])

  usePrefetchPronunciationSound(nextWord?.name)

  const reloadCurrentWordComponent = useCallback(() => {
    setWordComponentKey((old) => old + 1)
  }, [])

  const updateReviewRecord = useCallback(
    (state: TypingState) => {
      setReviewModeInfo((old) => ({
        ...old,
        reviewRecord: old.reviewRecord ? { ...old.reviewRecord, index: state.chapterData.index } : undefined,
      }))
    },
    [setReviewModeInfo],
  )

  const stopAtHardBoundary = useCallback(
    (nextReviewIndex: number) => {
      if (!smartSessionId || !isSmartSessionHardStopReached(smartSessionId)) return false
      if (isReviewMode) {
        setReviewModeInfo((old) => ({
          ...old,
          reviewRecord: old.reviewRecord
            ? { ...old.reviewRecord, index: nextReviewIndex, isFinished: false }
            : undefined,
        }))
      }
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
      navigate('/today?ended=hard-stop')
      return true
    },
    [dispatch, isReviewMode, navigate, setReviewModeInfo, smartSessionId],
  )

  const onFinish = useCallback(() => {
    const isLastWord = state.chapterData.index >= state.chapterData.words.length - 1
    const isLastExercise = currentWordExerciseCount >= loopWordTimes - 1
    const genuinelyFinished = isLastWord && isLastExercise

    if (!genuinelyFinished) {
      const nextReviewIndex = isLastExercise ? state.chapterData.index + 1 : state.chapterData.index
      if (stopAtHardBoundary(nextReviewIndex)) return
    }

    if (!genuinelyFinished) {
      if (!isLastExercise) {
        setCurrentWordExerciseCount((old) => old + 1)
        dispatch({ type: TypingStateActionType.LOOP_CURRENT_WORD })
        reloadCurrentWordComponent()
      } else {
        setCurrentWordExerciseCount(0)
        if (isReviewMode) {
          dispatch({
            type: TypingStateActionType.NEXT_WORD,
            payload: {
              updateReviewRecord,
            },
          })
        } else {
          dispatch({ type: TypingStateActionType.NEXT_WORD })
        }
      }
    } else {
      dispatch({ type: TypingStateActionType.FINISH_CHAPTER })
      if (isReviewMode) {
        setReviewModeInfo((old) => ({ ...old, reviewRecord: old.reviewRecord ? { ...old.reviewRecord, isFinished: true } : undefined }))
      }
    }
  }, [
    state.chapterData.index,
    state.chapterData.words.length,
    currentWordExerciseCount,
    loopWordTimes,
    stopAtHardBoundary,
    dispatch,
    reloadCurrentWordComponent,
    isReviewMode,
    updateReviewRecord,
    setReviewModeInfo,
  ])

  const onSkipWord = useCallback(
    (type: 'prev' | 'next') => {
      if (type === 'prev') {
        dispatch({ type: TypingStateActionType.SKIP_2_WORD_INDEX, newIndex: prevIndex })
      }

      if (type === 'next') {
        dispatch({ type: TypingStateActionType.SKIP_2_WORD_INDEX, newIndex: nextIndex })
      }
    },
    [dispatch, prevIndex, nextIndex],
  )

  useHotkeys(
    'Ctrl + Shift + ArrowLeft',
    (e) => {
      e.preventDefault()
      onSkipWord('prev')
    },
    { preventDefault: true },
  )

  useHotkeys(
    'Ctrl + Shift + ArrowRight',
    (e) => {
      e.preventDefault()
      onSkipWord('next')
    },
    { preventDefault: true },
  )
  const [isShowTranslation, setIsHoveringTranslation] = useState(false)

  const handleShowTranslation = useCallback((checked: boolean) => {
    setIsHoveringTranslation(checked)
  }, [])

  useHotkeys(
    'tab',
    () => {
      handleShowTranslation(true)
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  )

  useHotkeys(
    'tab',
    () => {
      handleShowTranslation(false)
    },
    { enableOnFormTags: true, keyup: true, preventDefault: true },
    [],
  )

  const shouldShowTranslation = useMemo(() => {
    return isShowTranslation || state.isTransVisible
  }, [isShowTranslation, state.isTransVisible])

  return (
    <div className="wenyan-word-stage flex h-full w-full flex-col items-center justify-center">
      {isShowPrevAndNextWord && state.isTyping && (
        <div className="absolute inset-x-6 top-8 z-10 flex items-center justify-between">
          <PrevAndNextWord type="prev" />
          <PrevAndNextWord type="next" />
        </div>
      )}

      <div className="flex w-full flex-grow flex-col items-center justify-center px-8 pt-8">
        {currentWord && (
          <div className="wenyan-fade-in relative flex w-full justify-center">
            <div className={`relative flex flex-col items-center transition-transform duration-200 ${state.isTyping ? '-translate-y-3' : '-translate-y-1'}`}>
              <WordComponent word={currentWord} onFinish={onFinish} key={wordComponentKey} />
              {phoneticConfig.isOpen && <Phonetic word={currentWord} />}
              <Translation
                trans={currentWord.trans.join('；')}
                showTrans={shouldShowTranslation}
                onMouseEnter={() => handleShowTranslation(true)}
                onMouseLeave={() => handleShowTranslation(false)}
              />
              {!state.isTyping && (
                <p className="mt-3 select-none text-center text-[11px] font-medium tracking-[0.02em] text-[var(--wenyan-accent)]">
                  按任意键{state.timerData.time ? '继续' : '开始'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <Progress className={`mb-7 mt-auto transition-opacity duration-200 ${state.isTyping ? 'opacity-65' : 'opacity-0'}`} />
    </div>
  )
}
