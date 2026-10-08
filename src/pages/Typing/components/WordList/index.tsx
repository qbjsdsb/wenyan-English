import { TypingContext, TypingStateActionType } from '../../store'
import WordCard from './WordCard'
import Drawer from '@/components/Drawer'
import Tooltip from '@/components/Tooltip'
import { currentChapterAtom, currentDictInfoAtom, isReviewModeAtom } from '@/store'
import { Dialog } from '@headlessui/react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { atom, useAtomValue } from 'jotai'
import { useContext, useState } from 'react'
import ListIcon from '~icons/tabler/list'
import IconX from '~icons/tabler/x'

const currentDictTitle = atom((get) => {
  const isReviewMode = get(isReviewModeAtom)
  if (isReviewMode) return `${get(currentDictInfoAtom).name} 错题复习`
  return `${get(currentDictInfoAtom).name} 第 ${get(currentChapterAtom) + 1} 章`
})

export default function WordList() {
  const { state, dispatch } = useContext(TypingContext)!
  const [isOpen, setIsOpen] = useState(false)
  const currentDictTitleValue = useAtomValue(currentDictTitle)

  function closeModal() {
    setIsOpen(false)
  }

  function openModal() {
    setIsOpen(true)
    dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
  }

  return (
    <>
      <Tooltip content="本章词表" placement="top">
        <button
          type="button"
          onClick={openModal}
          aria-label="本章词表"
          className="fixed bottom-5 left-5 z-20 grid h-9 w-9 place-items-center rounded-[var(--wenyan-radius-sm)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink-muted)] shadow-[0_4px_18px_rgba(0,0,0,0.04)] transition-colors hover:border-[var(--wenyan-line)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
        >
          <ListIcon className="h-4 w-4" />
        </button>
      </Tooltip>

      <Drawer open={isOpen} onClose={closeModal} classNames="bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)]">
        <Dialog.Title as="h3" className="flex items-center justify-between border-b border-[var(--wenyan-line-soft)] p-4 text-sm font-semibold leading-6">
          {currentDictTitleValue}
          <button type="button" onClick={closeModal} aria-label="关闭词表" className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]">
            <IconX className="h-4 w-4" />
          </button>
        </Dialog.Title>
        <ScrollArea.Root className="flex-1 select-none overflow-y-auto">
          <ScrollArea.Viewport className="h-full w-full px-3 py-2">
            <div className="flex h-full w-full flex-col gap-1">
              {state.chapterData.words?.map((word, index) => (
                <WordCard word={word} key={`${word.name}_${index}`} isActive={state.chapterData.index === index} />
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent" orientation="vertical" />
        </ScrollArea.Root>
      </Drawer>
    </>
  )
}
