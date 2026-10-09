import { TypingContext, TypingStateActionType } from '../../store'
import WordCard from './WordCard'
import Drawer from '@/components/Drawer'
import Tooltip from '@/components/Tooltip'
import { currentChapterAtom, currentDictInfoAtom, isReviewModeAtom } from '@/store'
import { Dialog } from '@headlessui/react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { atom, useAtom, useAtomValue } from 'jotai'
import { Search } from 'lucide-react'
import { useContext, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ListIcon from '~icons/tabler/list'
import IconX from '~icons/tabler/x'

const currentDictTitle = atom((get) => {
  const isReviewMode = get(isReviewModeAtom)
  if (isReviewMode) return `${get(currentDictInfoAtom).name} 错题复习`
  return `${get(currentDictInfoAtom).name} 第 ${get(currentChapterAtom) + 1} 章`
})

const wordListOpenAtom = atom(false)

export default function WordList({ inline = false }: { inline?: boolean }) {
  const { state, dispatch } = useContext(TypingContext)!
  const [isOpen, setIsOpen] = useAtom(wordListOpenAtom)
  const currentDictTitleValue = useAtomValue(currentDictTitle)
  const [query, setQuery] = useState('')
  const [searchParams] = useSearchParams()
  const visibleWords = useMemo(
    () =>
      state.chapterData.words
        .map((word, index) => ({ word, index }))
        .filter(({ word }) => `${word.name} ${word.trans.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
    [state.chapterData.words, query],
  )

  function closeModal() {
    setIsOpen(false)
  }

  function openModal() {
    setQuery('')
    setIsOpen(true)
    dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
  }

  return (
    <>
      <Tooltip content="本章词表" placement={inline ? 'bottom' : 'top'}>
        <button
          type="button"
          onClick={openModal}
          aria-label="本章词表"
          className={`${
            inline
              ? 'grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
              : 'fixed bottom-5 left-5 z-20 grid h-9 w-9 place-items-center rounded-[var(--wenyan-radius-sm)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink-muted)] shadow-[0_4px_18px_rgba(0,0,0,0.04)] hover:border-[var(--wenyan-line)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
          } transition-colors`}
        >
          <ListIcon className="h-4 w-4" />
        </button>
      </Tooltip>

      <Drawer open={isOpen} onClose={closeModal} classNames="bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)]">
        <Dialog.Title
          as="h3"
          className="flex items-center justify-between border-b border-[var(--wenyan-line-soft)] p-4 text-sm font-semibold leading-6"
        >
          {searchParams.has('smartSession') ? '本段词汇练习' : currentDictTitleValue}
          <button
            type="button"
            onClick={closeModal}
            aria-label="关闭词表"
            className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </Dialog.Title>
        <div className="border-b border-[var(--wenyan-line-soft)] px-5 py-4">
          <p className="wenyan-muted mb-3 text-xs">
            第 {Math.min(state.chapterData.index + 1, state.chapterData.words.length)} 个 / {state.chapterData.words.length} 个词 · 已练{' '}
            {state.chapterData.completedWordIndexes.length} 个
          </p>
          <div className="relative">
            <Search aria-hidden="true" size={14} className="wenyan-muted pointer-events-none absolute left-3 top-3" />
            <input
              type="search"
              aria-label="搜索本章单词或释义"
              placeholder="查找单词或释义"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="wenyan-input w-full py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <ScrollArea.Root className="flex-1 select-none overflow-y-auto">
          <ScrollArea.Viewport className="h-full w-full px-3 py-2">
            <div className="flex w-full flex-col gap-1">
              {visibleWords.map(({ word, index }) => (
                <WordCard
                  word={word}
                  key={`${word.name}_${index}`}
                  index={index}
                  completed={state.chapterData.completedWordIndexes.includes(index)}
                  isActive={state.chapterData.index === index}
                />
              ))}
              {visibleWords.length === 0 && (
                <p role="status" className="wenyan-muted py-12 text-center text-sm">
                  本段没有匹配的词
                </p>
              )}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent" orientation="vertical" />
        </ScrollArea.Root>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--wenyan-line-soft)] px-5 py-4">
          <p className="wenyan-muted text-xs">练习已暂停，可以安心查看。</p>
          <button
            type="button"
            className="wenyan-button-primary"
            disabled={state.isSavingRecord || state.isFinished || !state.chapterData.words.length}
            onClick={() => {
              closeModal()
              dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
            }}
          >
            继续练习
          </button>
        </div>
      </Drawer>
    </>
  )
}
