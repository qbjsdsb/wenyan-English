import { currentChapterAtom, currentDictIdAtom } from '@/store'
import type { Dictionary } from '@/typings'
import { useAtom, useSetAtom } from 'jotai'
import type React from 'react'
import { useEffect, useRef } from 'react'

const DictionaryCard: React.FC<DictionaryCardProps> = ({ dictionary }) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const selected = currentDictId === dictionary.id

  useEffect(() => {
    if (selected && buttonRef.current !== null) {
      const button = buttonRef.current
      const container = button.parentElement?.parentElement?.parentElement
      const halfHeight = button.getBoundingClientRect().height / 2
      container?.scrollTo({ top: Math.max(button.offsetTop - container.offsetTop - halfHeight, 0), behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      ref={buttonRef}
      className={`${
        selected
          ? 'bg-black/[0.045] text-gray-950 dark:bg-white/[0.07] dark:text-gray-100'
          : 'text-gray-700 hover:bg-black/[0.025] dark:text-gray-400 dark:hover:bg-white/[0.04]'
      } group w-full rounded-lg px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50`}
      type="button"
      onClick={() => {
        setCurrentDictId(dictionary.id)
        setCurrentChapter(0)
      }}
      title="选择词典"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{dictionary.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400 dark:text-gray-600">{dictionary.description}</p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-600">{dictionary.length}</span>
      </div>
    </button>
  )
}

DictionaryCard.displayName = 'DictionaryCard'

export type DictionaryCardProps = {
  dictionary: Dictionary
}

export default DictionaryCard
