import Header from '@/components/Header'
import Tooltip from '@/components/Tooltip'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentChapterAtom, currentDictIdAtom, isReviewModeAtom, randomConfigAtom, reviewModeInfoAtom } from '@/store'
import { IsDesktop, isLegal } from '@/utils'
import { useSaveChapterRecord } from '@/utils/db'
import { useMixPanelChapterLogUploader } from '@/utils/mixpanel'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useImmerReducer } from 'use-immer'
import { DictChapterButton } from './components/DictChapterButton'
import ResultScreen from './components/ResultScreen'
import Speed from './components/Speed'
import StartButton from './components/StartButton'
import Switcher from './components/Switcher'
import WordList from './components/WordList'
import WordPanel from './components/WordPanel'
import { useConfetti } from './hooks/useConfetti'
import { useWordList } from './hooks/useWordList'
import { TypingContext, TypingStateActionType, initialState, typingReducer } from './store'

const App: React.FC = () => {
  const [state, dispatch] = useImmerReducer(typingReducer, structuredClone(initialState))
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const { words, error: wordListError, retry: retryWordList } = useWordList()
  const [retryingWords, setRetryingWords] = useState(false)

  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)
  const currentChapter = useAtomValue(currentChapterAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const randomConfig = useAtomValue(randomConfigAtom)
  const chapterLogUploader = useMixPanelChapterLogUploader(state)
  const saveChapterRecord = useSaveChapterRecord()
  const [searchParams] = useSearchParams()
  const savedChapter = useRef(false)
  const [saveError, setSaveError] = useState('')

  const reviewModeInfo = useAtomValue(reviewModeInfoAtom)
  const isReviewMode = useAtomValue(isReviewModeAtom)

  useEffect(() => {
    if (!IsDesktop()) {
      setTimeout(() => {
        alert('Wenyan 英语学习目前以桌面键盘为主要使用方式。平板设备建议连接外接键盘。')
      }, 500)
    }
  }, [])

  useEffect(() => {
    const id = currentDictId
    if (!(id in idDictionaryMap)) {
      setCurrentDictId('cet4')
      setCurrentChapter(0)
      return
    }
  }, [currentDictId, setCurrentChapter, setCurrentDictId])

  const skipWord = useCallback(() => {
    dispatch({ type: TypingStateActionType.SKIP_WORD })
  }, [dispatch])

  useEffect(() => {
    const onBlur = () => {
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
    }
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('blur', onBlur)
    }
  }, [dispatch])

  useEffect(() => {
    state.chapterData.words?.length > 0 ? setIsLoading(false) : setIsLoading(true)
  }, [state.chapterData.words])

  useEffect(() => {
    if (!state.isTyping) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (!isLoading && !wordListError && e.key !== 'Enter' && (isLegal(e.key) || e.key === ' ') && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
        }
      }
      window.addEventListener('keydown', onKeyDown)

      return () => window.removeEventListener('keydown', onKeyDown)
    }
  }, [state.isTyping, isLoading, wordListError, dispatch])

  useEffect(() => {
    if (words !== undefined) {
      const initialIndex = isReviewMode && reviewModeInfo.reviewRecord?.index ? reviewModeInfo.reviewRecord.index : 0

      dispatch({
        type: TypingStateActionType.SETUP_CHAPTER,
        payload: { words, shouldShuffle: randomConfig.isOpen, initialIndex },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  useEffect(() => {
    if (!state.isFinished) savedChapter.current = false
    if (state.isFinished && !state.isSavingRecord && !savedChapter.current) {
      savedChapter.current = true
      chapterLogUploader()
      void saveChapterRecord(state, searchParams.get('taskRun')).catch(() => {
        setSaveError('本次章节记录保存失败，请保持此页面并重试。')
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isFinished, state.isSavingRecord])

  useEffect(() => {
    let intervalId: number
    if (state.isTyping) {
      intervalId = window.setInterval(() => {
        dispatch({ type: TypingStateActionType.TICK_TIMER })
      }, 1000)
    }
    return () => clearInterval(intervalId)
  }, [state.isTyping, dispatch])

  useConfetti(state.isFinished)

  const skipButton = (
    <Tooltip content="跳过该词">
      <button
        className={`${
          state.isShowSkip ? 'opacity-100' : 'pointer-events-none w-0 px-0 opacity-0'
        } rounded-[var(--wenyan-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--wenyan-ink-muted)] transition-all hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]`}
        onClick={skipWord}
      >
        跳过
      </button>
    </Tooltip>
  )

  return (
    <TypingContext.Provider value={{ state: state, dispatch }}>
      {state.isFinished && <ResultScreen />}
      {saveError && (
        <div role="alert" className="wenyan-surface fixed bottom-4 left-4 z-50 p-4 text-sm text-[var(--wenyan-danger)]">
          {saveError}
          <button className="ml-3 underline" onClick={() => {
            void saveChapterRecord(state, searchParams.get('taskRun')).then(() => setSaveError('')).catch(() => setSaveError('保存仍未成功，请检查浏览器存储空间后重试。'))
          }}>重试保存</button>
        </div>
      )}

      <main className="flex min-h-screen w-full flex-col bg-[var(--wenyan-paper)]">
        {state.isTyping ? (
          <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-6 text-[11px] text-[var(--wenyan-ink-muted)]">
            <Link to="/today" aria-label="今日学习" className="wenyan-brand text-[13px] font-semibold no-underline opacity-70 transition-opacity hover:opacity-100">
              Wenyan
            </Link>
            <div className="flex items-center gap-3">
              <span>{idDictionaryMap[currentDictId]?.name} · 第 {currentChapter + 1} 章</span>
              {state.chapterData.words.length > 0 && (
                <span className="tabular-nums">{Math.min(state.chapterData.index + 1, state.chapterData.words.length)} / {state.chapterData.words.length}</span>
              )}
              <StartButton isLoading={isLoading || Boolean(wordListError)} />
              {skipButton}
            </div>
          </div>
        ) : (
          <Header />
        )}

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
          {!state.isTyping && (
            <div className="flex items-center justify-between gap-6 border-b border-[var(--wenyan-line-soft)] py-4">
              <DictChapterButton />
              <div className="flex items-center gap-2">
                <Switcher />
                <StartButton isLoading={isLoading || Boolean(wordListError)} />
                {skipButton}
              </div>
            </div>
          )}

          <div className="relative flex flex-1 flex-col items-center">
            <div className="flex min-h-[420px] w-full flex-1 items-center justify-center">
              {wordListError ? (
                <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
                  <h2 className="text-lg font-medium text-[var(--wenyan-ink)]">词库暂时无法加载</h2>
                  <p className="wenyan-muted text-sm">{wordListError.message}</p>
                  <button type="button" disabled={retryingWords} className="wenyan-button-secondary" onClick={() => {
                    setRetryingWords(true)
                    void retryWordList().catch(() => undefined).finally(() => setRetryingWords(false))
                  }}>{retryingWords ? '正在重试…' : '重新加载词库'}</button>
                </div>
              ) : isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--wenyan-line)] border-r-transparent" role="status" />
              ) : (
                !state.isFinished && <WordPanel />
              )}
            </div>
            <Speed />
          </div>
        </div>
      </main>
      <WordList />
    </TypingContext.Provider>
  )
}

export default App