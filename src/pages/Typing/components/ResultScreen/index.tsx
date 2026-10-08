import { TypingContext, TypingStateActionType } from '../../store'
import ShareButton from '../ShareButton'
import WordChip from './WordChip'
import Tooltip from '@/components/Tooltip'
import {
  currentChapterAtom,
  currentDictInfoAtom,
  isReviewModeAtom,
  randomConfigAtom,
  reviewModeInfoAtom,
  wordDictationConfigAtom,
} from '@/store'
import { Transition } from '@headlessui/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import IexportWords from '~icons/icon-park-outline/excel'
import IconX from '~icons/tabler/x'

const ResultScreen = () => {
  const { state, dispatch } = useContext(TypingContext)!
  const setWordDictationConfig = useSetAtom(wordDictationConfigAtom)
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const randomConfig = useAtomValue(randomConfigAtom)
  const navigate = useNavigate()
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const isReviewMode = useAtomValue(isReviewModeAtom)

  useEffect(() => {
    dispatch({ type: TypingStateActionType.TICK_TIMER, addTime: 0 })
  }, [dispatch])

  const exportWords = useCallback(() => {
    const { words, userInputLogs } = state.chapterData
    const exportData = userInputLogs.map((log) => {
      const word = words[log.index]
      const wordName = word.name
      return {
        ...word,
        trans: word.trans.join(';'),
        correctCount: log.correctCount,
        wrongCount: log.wrongCount,
        wrongLetters: Object.entries(log.LetterMistakes)
          .map(([key, mistakes]) => `${wordName[Number(key)]}:${mistakes.length}`)
          .join(';'),
      }
    })

    import('xlsx')
      .then(({ utils, writeFileXLSX }) => {
        const ws = utils.json_to_sheet(exportData)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, 'Data')
        writeFileXLSX(wb, `${currentDictInfo.name}第${currentChapter + 1}章.xlsx`)
      })
      .catch(() => {
        console.log('写入 xlsx 模块导入失败')
      })
  }, [currentChapter, currentDictInfo.name, state.chapterData])

  const wrongWords = useMemo(() => {
    return state.chapterData.userInputLogs
      .filter((log) => log.wrongCount > 0)
      .map((log) => state.chapterData.words[log.index])
      .filter((word) => word !== undefined)
  }, [state.chapterData.userInputLogs, state.chapterData.words])

  const isLastChapter = useMemo(() => currentChapter >= currentDictInfo.chapterCount - 1, [currentChapter, currentDictInfo])

  const timeString = useMemo(() => {
    const seconds = state.timerData.time
    const minutes = Math.floor(seconds / 60)
    const minuteString = minutes < 10 ? '0' + minutes : minutes + ''
    const restSeconds = seconds % 60
    const secondString = restSeconds < 10 ? '0' + restSeconds : restSeconds + ''
    return `${minuteString}:${secondString}`
  }, [state.timerData.time])

  const repeatButtonHandler = useCallback(async () => {
    if (isReviewMode) return
    setWordDictationConfig((old) => (old.isOpen && old.openBy === 'auto' ? { ...old, isOpen: false } : old))
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: randomConfig.isOpen })
  }, [isReviewMode, setWordDictationConfig, dispatch, randomConfig.isOpen])

  const dictationButtonHandler = useCallback(async () => {
    if (isReviewMode) return
    setWordDictationConfig((old) => ({ ...old, isOpen: true, openBy: 'auto' }))
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: randomConfig.isOpen })
  }, [isReviewMode, setWordDictationConfig, dispatch, randomConfig.isOpen])

  const nextButtonHandler = useCallback(() => {
    if (isReviewMode) return
    setWordDictationConfig((old) => (old.isOpen && old.openBy === 'auto' ? { ...old, isOpen: false } : old))
    if (!isLastChapter) {
      setCurrentChapter((old) => old + 1)
      dispatch({ type: TypingStateActionType.NEXT_CHAPTER })
    }
  }, [dispatch, isLastChapter, isReviewMode, setCurrentChapter, setWordDictationConfig])

  const exitButtonHandler = useCallback(() => {
    if (isReviewMode) {
      setCurrentChapter(0)
      setReviewModeInfo((old) => ({ ...old, isReviewMode: false }))
    } else {
      dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: false })
    }
  }, [dispatch, isReviewMode, setCurrentChapter, setReviewModeInfo])

  const onNavigateToGallery = useCallback(() => {
    setCurrentChapter(0)
    setReviewModeInfo((old) => ({ ...old, isReviewMode: false }))
    navigate('/gallery')
  }, [navigate, setCurrentChapter, setReviewModeInfo])

  useHotkeys('enter', nextButtonHandler, { preventDefault: true })
  useHotkeys('space', (event) => {
    event.stopPropagation()
    repeatButtonHandler()
  }, { preventDefault: true })
  useHotkeys('shift+enter', dictationButtonHandler, { preventDefault: true })

  const title = `${currentDictInfo.name} · ${isReviewMode ? '错词复习' : `第 ${currentChapter + 1} 章`}`

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 px-6 py-8 backdrop-blur-[2px]">
      <Transition
        appear
        show
        enter="ease-out duration-150"
        enterFrom="opacity-0 translate-y-1 scale-[0.99]"
        enterTo="opacity-100 translate-y-0 scale-100"
      >
        <div className="flex min-h-full items-center justify-center">
          <section className="wenyan-surface relative w-full max-w-3xl overflow-hidden p-0">
            <div className="flex items-start justify-between gap-6 border-b border-[var(--wenyan-line-soft)] px-7 py-6">
              <div>
                <p className="wenyan-muted text-[10px]">本次学习完成</p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[var(--wenyan-ink)]">{title}</h2>
                {wrongWords.length === 0 && (
                  <p className="mt-2 text-[11px] text-[var(--wenyan-success)]">表现不错！全对了！</p>
                )}
              </div>
              <button
                type="button"
                aria-label="关闭结果页"
                className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
                onClick={exitButtonHandler}
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[var(--wenyan-line-soft)] border-b border-[var(--wenyan-line-soft)] px-7 py-5">
              {[
                [`${state.timerData.accuracy}%`, '正确率'],
                [timeString, '用时'],
                [String(state.timerData.wpm), 'WPM'],
              ].map(([value, label]) => (
                <div key={label} className="text-center">
                  <div className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--wenyan-ink)]">{value}</div>
                  <div className="wenyan-muted mt-1 text-[10px]">{label}</div>
                </div>
              ))}
            </div>

            <div className="px-7 py-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--wenyan-ink)]">错词</h3>
                  <p className="wenyan-muted mt-1 text-[10px]">{wrongWords.length ? `${wrongWords.length} 个词需要再看一眼` : '本章没有错词'}</p>
                </div>
                {!isReviewMode && (
                  <div className="flex items-center gap-2 text-[var(--wenyan-ink-muted)]">
                    <ShareButton />
                    <Tooltip content="导出本章数据">
                      <button
                        type="button"
                        onClick={exportWords}
                        aria-label="导出本章数据"
                        className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
                      >
                        <IexportWords fontSize={16} />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>

              <div className="min-h-[92px] rounded-[var(--wenyan-radius-md)] bg-[var(--wenyan-paper-muted)] p-4">
                {wrongWords.length ? (
                  <div className="flex max-h-40 flex-wrap content-start gap-2 overflow-y-auto customized-scrollbar">
                    {wrongWords.map((word, index) => (
                      <WordChip key={`${index}-${word.name}`} word={word} />
                    ))}
                  </div>
                ) : (
                  <div className="wenyan-muted flex min-h-[60px] items-center justify-center text-xs">保持这个节奏即可</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--wenyan-line-soft)] px-7 py-4">
              <button type="button" aria-label="返回今日学习" className="wenyan-button-secondary" onClick={() => navigate('/today')}>返回今天</button>
              {!isReviewMode && (
                <>
                  <Tooltip content="快捷键：Shift + Enter">
                    <button aria-label="默写本章节" className="wenyan-button-secondary" type="button" onClick={dictationButtonHandler}>默写本章</button>
                  </Tooltip>
                  <Tooltip content="快捷键：Space">
                    <button aria-label="重复本章节" className="wenyan-button-secondary" type="button" onClick={repeatButtonHandler}>再练一遍</button>
                  </Tooltip>
                </>
              )}
              {!isLastChapter && !isReviewMode && (
                <Tooltip content="快捷键：Enter">
                  <button aria-label="下一章节" className="wenyan-button-primary" type="button" onClick={nextButtonHandler}>下一章</button>
                </Tooltip>
              )}
              {isReviewMode && (
                <button aria-label="练习其他章节" className="wenyan-button-primary" type="button" onClick={onNavigateToGallery}>选择其他章节</button>
              )}
            </div>
          </section>
        </div>
      </Transition>
    </div>
  )
}

export default ResultScreen
