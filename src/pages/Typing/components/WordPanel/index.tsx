import { TypingContext, TypingStateActionType } from '../../store'
import PrevAndNextWord from '../PrevAndNextWord'
import Progress from '../Progress'
import Phonetic from './components/Phonetic'
import Translation from './components/Translation'
import WordComponent from './components/Word'
import { usePrefetchPronunciationSound } from '@/hooks/usePronunciation'
import { advanceCommittedWord } from '@/pages/Typing/checkpoint'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import { isSmartSessionHardStopReached } from '@/smart-session/runtime'
import { isReviewModeAtom, isShowPrevAndNextWordAtom, loopWordConfigAtom, phoneticConfigAtom, reviewModeInfoAtom } from '@/store'
import type { Word } from '@/typings'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function WordPanel() {
  const { state, dispatch } = useContext(TypingContext)!
  const phoneticConfig = useAtomValue(phoneticConfigAtom)
  const isShowPrevAndNextWord = useAtomValue(isShowPrevAndNextWordAtom)
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

  const stopAtHardBoundary = useCallback(
    (nextReviewIndex: number) => {
      if (!smartSessionId || !isSmartSessionHardStopReached(smartSessionId)) return false
      if (isReviewMode) {
        setReviewModeInfo((old) => ({
          ...old,
          reviewRecord: old.reviewRecord ? { ...old.reviewRecord, index: nextReviewIndex, isFinished: false } : undefined,
        }))
      }
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
      navigate('/today?ended=hard-stop')
      return true
    },
    [dispatch, isReviewMode, navigate, setReviewModeInfo, smartSessionId],
  )

  const onFinish = useCallback(() => {
    const next = advanceCommittedWord(state, loopWordTimes)
    if (!next.isFinished && stopAtHardBoundary(next.chapterData.index)) return
    dispatch({ type: TypingStateActionType.ADVANCE_COMMITTED_WORD, loopTimes: loopWordTimes })
    if (isReviewMode) {
      setReviewModeInfo((old) => ({
        ...old,
        reviewRecord: old.reviewRecord
          ? {
              ...old.reviewRecord,
              index: next.chapterData.index,
              isFinished: next.isFinished,
            }
          : undefined,
      }))
    }
  }, [state, loopWordTimes, stopAtHardBoundary, dispatch, isReviewMode, setReviewModeInfo])

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
    { enabled: state.isTyping, ignoreEventWhen: ignoresStudyKey, preventDefault: true },
  )

  useHotkeys(
    'Ctrl + Shift + ArrowRight',
    (e) => {
      e.preventDefault()
      onSkipWord('next')
    },
    { enabled: state.isTyping, ignoreEventWhen: ignoresStudyKey, preventDefault: true },
  )
  const [isShowTranslation, setIsHoveringTranslation] = useState(false)

  useEffect(() => {
    if (!state.isTyping) setIsHoveringTranslation(false)
  }, [state.isTyping])

  const handleShowTranslation = useCallback((checked: boolean) => {
    setIsHoveringTranslation(checked)
  }, [])

  useHotkeys(
    'tab',
    () => {
      handleShowTranslation(true)
    },
    { enabled: state.isTyping, ignoreEventWhen: ignoresStudyKey, preventDefault: true },
    [state.isTyping],
  )

  useHotkeys(
    'tab',
    () => {
      handleShowTranslation(false)
    },
    { enabled: state.isTyping, ignoreEventWhen: ignoresStudyKey, keyup: true, preventDefault: true },
    [state.isTyping],
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
            <div
              className={`relative flex flex-col items-center transition-transform duration-200 ${
                state.isTyping ? '-translate-y-3' : '-translate-y-1'
              }`}
            >
              <WordComponent
                word={currentWord}
                onFinish={onFinish}
                key={`${state.runId}:${state.chapterData.index}:${state.wordExerciseCount}`}
              />
              {phoneticConfig.isOpen && <Phonetic word={currentWord} />}
              <Translation
                trans={currentWord.trans.join('；')}
                showTrans={shouldShowTranslation}
                onMouseEnter={() => handleShowTranslation(true)}
                onMouseLeave={() => handleShowTranslation(false)}
              />
              {!state.isTyping && (
                <p className="mt-3 select-none text-center text-[11px] font-medium tracking-[0.02em] text-[var(--wenyan-accent)]">
                  {state.isSavingRecord
                    ? '先保存当前词，再继续'
                    : `按任意键${state.chapterData.wordCount || state.timerData.time ? '继续' : '开始'}`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <Progress className={`mb-7 mt-auto transition-opacity duration-200 ${state.isTyping ? 'opacity-65' : 'opacity-90'}`} />
    </div>
  )
}
