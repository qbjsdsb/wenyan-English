import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { currentDictInfoAtom } from '@/store'
import type { Word } from '@/typings'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'

export default function WordCard({
  word,
  isActive,
  completed,
  index,
}: {
  word: Word
  isActive: boolean
  completed: boolean
  index: number
}) {
  const currentLanguage = useAtomValue(currentDictInfoAtom).language
  const item = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isActive) item.current?.scrollIntoView({ block: 'nearest' })
  }, [isActive])

  return (
    <div
      ref={item}
      aria-current={isActive ? 'step' : undefined}
      className={`wenyan-word-list-item flex select-text items-start gap-3 px-3 py-4 ${isActive ? 'is-current' : ''}`}
    >
      <span aria-hidden="true" className="wenyan-muted wenyan-mono w-5 shrink-0 pt-1 text-right text-[10px]">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="wenyan-mono select-all text-lg font-medium leading-6 text-[var(--wenyan-ink)]">
            {['romaji', 'hapin'].includes(currentLanguage) ? word.notation : word.name}
          </p>
          <span className={`text-[10px] ${isActive ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink-muted)]'}`}>
            {isActive ? '当前位置' : completed ? '已练' : '待练'}
          </span>
        </div>
        <p className="wenyan-muted mt-2 text-sm leading-6">{word.trans.join('；')}</p>
      </div>
      <WordPronunciationIcon word={word} lang={currentLanguage} className="h-8 w-8 shrink-0" />
    </div>
  )
}
