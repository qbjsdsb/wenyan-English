import { isValidTypingCheckpoint, typingCheckpointId, typingContentSignature } from './checkpoint'
import { DictChapterButton } from './components/DictChapterButton'
import ResultScreen from './components/ResultScreen'
import Speed from './components/Speed'
import StartButton from './components/StartButton'
import Switcher from './components/Switcher'
import WordList from './components/WordList'
import WordPanel from './components/WordPanel'
import { useWordList } from './hooks/useWordList'
import { ignoresStudyKey } from './keyboard'
import { TypingContext, TypingStateActionType, initialState, typingReducer } from './store'
import Header from '@/components/Header'
import Tooltip from '@/components/Tooltip'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentChapterAtom, currentDictIdAtom, isReviewModeAtom, randomConfigAtom, reviewModeInfoAtom } from '@/store'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { IsDesktop, isLegal } from '@/utils'
import { db, useSaveChapterRecord } from '@/utils/db'
import { useMixPanelChapterLogUploader } from '@/utils/mixpanel'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useImmerReducer } from 'use-immer'

const App: React.FC = () => {
  const [state, dispatch] = useImmerReducer(typingReducer, structuredClone(initialState))
  const [preparingChapter, setPreparingChapter] = useState(true)
  const isLoading = preparingChapter || state.chapterData.words.length === 0
  const [ownerUserId, setOwnerUserId] = useState(getLocalLearningOwnerId)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const { words, fromCache, error: wordListError, retry: retryWordList } = useWordList()
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
  const [chapterSaved, setChapterSaved] = useState(false)
  const [savingChapter, setSavingChapter] = useState(false)
  const chapterSaveInFlight = useRef(false)

  const persistChapter = async () => {
    if (chapterSaveInFlight.current) return
    chapterSaveInFlight.current = true
    setSavingChapter(true)
    setSaveError('')
    try {
      await saveChapterRecord(state, searchParams.get('taskRun'))
      setChapterSaved(true)
    } catch {
      setSaveError('本次章节记录尚未保存。请保持此页面，检查浏览器存储空间后重试。')
    } finally {
      chapterSaveInFlight.current = false
      setSavingChapter(false)
    }
  }

  const reviewModeInfo = useAtomValue(reviewModeInfoAtom)
  const isReviewMode = useAtomValue(isReviewModeAtom)
  const checkpointEnabled = !isReviewMode && !searchParams.has('smartSession') && idDictionaryMap[currentDictId]?.language === 'en'
  const taskRunId = searchParams.get('taskRun')

  useEffect(() => {
    const changed = () => {
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
      setOwnerUserId(getLocalLearningOwnerId())
    }
    window.addEventListener('wenyan-learning-owner-changed', changed)
    return () => window.removeEventListener('wenyan-learning-owner-changed', changed)
  }, [dispatch])

  const restartChapter = useCallback(
    async (shouldShuffle: boolean) => {
      if (state.isSavingRecord) return
      setPreparingChapter(true)
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
      try {
        if (state.checkpoint) await db.typingCheckpoints.delete(state.checkpoint.id)
        setRecoveryMessage('')
        dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle })
      } catch {
        setRecoveryMessage('暂时无法重新开始。已保存的进度仍在，请检查本机存储后重试。')
      } finally {
        setPreparingChapter(false)
      }
    },
    [dispatch, state.isSavingRecord, state.checkpoint],
  )

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
    const onVisibility = () => {
      if (document.hidden) onBlur()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dispatch])

  useEffect(() => {
    if (['en', 'de', 'romaji'].includes(idDictionaryMap[currentDictId]?.language)) return
    if (!state.isTyping && !state.isFinished && !state.isSavingRecord) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (
          !ignoresStudyKey(e) &&
          !isLoading &&
          !wordListError &&
          e.key !== 'Enter' &&
          (isLegal(e.key) || e.key === ' ') &&
          !e.altKey &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          e.preventDefault()
          dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
        }
      }
      window.addEventListener('keydown', onKeyDown)

      return () => window.removeEventListener('keydown', onKeyDown)
    }
  }, [state.isTyping, state.isFinished, state.isSavingRecord, isLoading, wordListError, dispatch, currentDictId])

  useEffect(() => {
    if (!words.length) return
    let active = true
    setPreparingChapter(true)
    setRecoveryMessage('')
    void (async () => {
      const identity = checkpointEnabled
        ? {
            id: typingCheckpointId(ownerUserId, currentDictId, currentChapter, taskRunId),
            runId: crypto.randomUUID(),
            ownerUserId,
            dictId: currentDictId,
            chapter: currentChapter,
            taskRunId,
            contentSignature: typingContentSignature(words),
          }
        : undefined
      if (identity) {
        try {
          const saved = await db.typingCheckpoints.get(identity.id)
          if (saved && isValidTypingCheckpoint(saved, words, ownerUserId)) {
            const records = await db.wordRecords.bulkGet(saved.state.chapterData.wordRecordIds)
            if (records.every((record) => record && record.dict === currentDictId && record.chapter === currentChapter)) {
              if (!active) return
              dispatch({ type: TypingStateActionType.RESTORE_CHAPTER, payload: saved.state })
              setRecoveryMessage('已恢复上次保存的位置。未完成的词从头输入，已保存的记录仍然保留。')
              setPreparingChapter(false)
              return
            }
          }
          if (saved) {
            await db.typingCheckpoints.delete(identity.id)
            if (active) setRecoveryMessage('词库或本机进度发生变化，本章从头开始；之前的学习记录仍然保留。')
          }
        } catch {
          if (active) setRecoveryMessage('暂时无法读取上次的位置。本章从头开始，完成单词后仍会尝试保存。')
        }
      }
      if (!active) return
      const initialIndex = isReviewMode && reviewModeInfo.reviewRecord?.index ? reviewModeInfo.reviewRecord.index : 0
      dispatch({
        type: TypingStateActionType.SETUP_CHAPTER,
        payload: { words, shouldShuffle: randomConfig.isOpen, initialIndex, checkpoint: identity },
      })
      setPreparingChapter(false)
    })()
    return () => {
      active = false
    }
    // Preference changes apply on the next restart, not by resetting live progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, checkpointEnabled, ownerUserId, currentDictId, currentChapter, taskRunId])

  useEffect(() => {
    if (!state.isFinished) {
      savedChapter.current = false
      setChapterSaved(false)
      setSaveError('')
    }
    if (state.isFinished && !state.isSavingRecord && !savedChapter.current) {
      savedChapter.current = true
      chapterLogUploader()
      void persistChapter()
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

  const skipButton = (
    <Tooltip content="跳过该词">
      <button
        aria-label="Skip"
        disabled={state.isSavingRecord}
        className={`${
          state.isShowSkip ? 'opacity-100' : 'pointer-events-none w-0 px-0 opacity-0'
        } rounded-[var(--wenyan-radius-sm)] px-2.5 py-1.5 text-xs text-[var(--wenyan-ink-muted)] transition-all hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]`}
        onClick={(event) => {
          skipWord()
          event.currentTarget.blur()
        }}
      >
        跳过
      </button>
    </Tooltip>
  )

  return (
    <TypingContext.Provider value={{ state, dispatch, restartChapter }}>
      {state.isFinished && chapterSaved && <ResultScreen />}
      {state.isFinished && !chapterSaved && (
        <div className="wenyan-completion-stage fixed inset-0 z-50 grid place-items-center px-6">
          <section className="wenyan-surface w-full max-w-md p-8" aria-label="保存学习记录">
            <h2 className="text-xl font-semibold">这一段练习结束了</h2>
            {saveError ? (
              <p role="alert" className="mt-4 text-sm leading-6 text-[var(--wenyan-danger)]">
                {saveError}
              </p>
            ) : (
              <p role="status" className="wenyan-muted mt-4 text-sm">
                正在把学习记录保存到本机…
              </p>
            )}
            {saveError && (
              <button disabled={savingChapter} className="wenyan-button-primary mt-6" onClick={() => void persistChapter()}>
                重试保存
              </button>
            )}
          </section>
        </div>
      )}

      <main className={`wenyan-focus-shell ${state.isTyping ? 'is-active' : ''} flex min-h-screen w-full flex-col`}>
        {state.isTyping ? (
          <div className="wenyan-focus-bar">
            <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-6 text-[11px] text-[var(--wenyan-ink-muted)]">
              <Link
                to="/today"
                aria-label="今日学习"
                className="wenyan-brand text-[14px] font-semibold no-underline opacity-80 transition-opacity hover:opacity-100"
              >
                Wenyan
              </Link>
              <div className="flex items-center gap-2.5">
                <span>
                  {idDictionaryMap[currentDictId]?.name} ·{' '}
                  {isReviewMode ? (searchParams.has('smartSession') ? '本段词汇练习' : '错词复习') : `第 ${currentChapter + 1} 章`}
                </span>
                {state.chapterData.words.length > 0 && (
                  <span className="wenyan-mono text-[10px] text-[var(--wenyan-ink-secondary)]">
                    {Math.min(state.chapterData.index + 1, state.chapterData.words.length)} / {state.chapterData.words.length}
                  </span>
                )}
                <span aria-hidden="true" className="mx-0.5 h-3 w-px bg-[var(--wenyan-line-soft)]" />
                <WordList inline />
                <StartButton isLoading={isLoading || Boolean(wordListError) || state.isFinished} />
                {skipButton}
              </div>
            </div>
          </div>
        ) : (
          <Header />
        )}

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
          {!state.isTyping && (
            <div className="wenyan-setup-bar my-4 flex items-center justify-between gap-6 px-4 py-3">
              <DictChapterButton />
              <div className="flex items-center gap-1.5">
                <WordList inline />
                <Switcher />
                <StartButton isLoading={isLoading || Boolean(wordListError) || state.isFinished} />
                {skipButton}
              </div>
            </div>
          )}

          {fromCache && !state.isTyping && (
            <p role="status" className="wenyan-muted text-center text-xs">
              正在使用本机保存的词库，可以继续练习。
            </p>
          )}
          {!state.isTyping && !isLoading && recoveryMessage && (
            <p role="status" className="wenyan-recovery-note mx-auto mt-2 max-w-lg text-center text-xs leading-6">
              {recoveryMessage}
            </p>
          )}
          <div className="relative flex flex-1 flex-col items-center">
            <div className="flex min-h-[430px] w-full flex-1 items-center justify-center">
              {wordListError ? (
                <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
                  <h2 className="text-lg font-medium text-[var(--wenyan-ink)]">词库暂时无法加载</h2>
                  <p className="wenyan-muted text-sm">{wordListError.message}</p>
                  <button
                    type="button"
                    disabled={retryingWords}
                    className="wenyan-button-secondary"
                    onClick={() => {
                      setRetryingWords(true)
                      void retryWordList()
                        .catch(() => undefined)
                        .finally(() => setRetryingWords(false))
                    }}
                  >
                    {retryingWords ? '正在重试…' : '重新加载词库'}
                  </button>
                </div>
              ) : isLoading ? (
                <div role="status" className="flex flex-col items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--wenyan-line)] border-r-transparent"
                  />
                  <span className="wenyan-muted text-sm">正在准备这一章的单词…</span>
                </div>
              ) : (
                !state.isFinished && <WordPanel />
              )}
            </div>
            <Speed />
          </div>
        </div>
      </main>
    </TypingContext.Provider>
  )
}

export default App
