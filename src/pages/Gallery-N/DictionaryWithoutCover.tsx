import DictDetail from './DictDetail'
import { useDictStats } from './hooks/useDictStats'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import useIntersectionObserver from '@/hooks/useIntersectionObserver'
import { currentDictIdAtom } from '@/store'
import type { Dictionary } from '@/typings'
import { calcChapterCount } from '@/utils'
import * as Progress from '@radix-ui/react-progress'
import { useAtomValue } from 'jotai'
import { useMemo, useRef } from 'react'

interface Props {
  dictionary: Dictionary
}

export default function DictionaryComponent({ dictionary }: Props) {
  const currentDictID = useAtomValue(currentDictIdAtom)

  const divRef = useRef<HTMLDivElement>(null)
  const entry = useIntersectionObserver(divRef, {})
  const isVisible = !!entry?.isIntersecting
  const dictStats = useDictStats(dictionary.id, isVisible)
  const chapterCount = useMemo(() => calcChapterCount(dictionary.length), [dictionary.length])
  const isSelected = currentDictID === dictionary.id
  const progress = useMemo(
    () => (dictStats ? Math.ceil((dictStats.exercisedChapterCount / chapterCount) * 100) : 0),
    [dictStats, chapterCount],
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          ref={divRef}
          className={`group flex min-h-[126px] w-full cursor-pointer flex-col justify-between rounded-[var(--wenyan-radius-md)] border p-4 text-left transition-colors focus:outline-none ${
            isSelected
              ? 'border-[color-mix(in_srgb,var(--wenyan-accent)_45%,var(--wenyan-line))] bg-[var(--wenyan-accent-soft)]'
              : 'border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)] hover:border-[var(--wenyan-line)] hover:bg-[var(--wenyan-paper-muted)]'
          }`}
          role="button"
          tabIndex={0}
        >
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className={`truncate text-[15px] font-semibold ${isSelected ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink)]'}`}>
                {dictionary.name}
              </h3>
              {isSelected && <span className="shrink-0 text-[10px] font-medium text-[var(--wenyan-accent)]">当前</span>}
            </div>
            <TooltipProvider>
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <p className="wenyan-muted mt-2 max-w-full truncate text-xs leading-5">{dictionary.description}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{dictionary.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="mt-4">
            <div className="wenyan-muted flex items-center justify-between text-[11px]">
              <span>{dictionary.length} 词</span>
              {progress > 0 && <span>{progress}%</span>}
            </div>
            {progress > 0 && (
              <Progress.Root value={progress} max={100} className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[var(--wenyan-line-soft)]">
                <Progress.Indicator
                  className="h-full rounded-full bg-[var(--wenyan-accent)] transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </Progress.Root>
            )}
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="w-[60rem] max-w-none !rounded-[var(--wenyan-radius-lg)] border-[var(--wenyan-line)] bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)] shadow-[var(--wenyan-shadow)]">
        <DictDetail dictionary={dictionary} />
      </DialogContent>
    </Dialog>
  )
}
