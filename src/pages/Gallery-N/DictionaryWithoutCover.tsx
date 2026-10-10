import DictDetail from './DictDetail'
import { useDictStats } from './hooks/useDictStats'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import useIntersectionObserver from '@/hooks/useIntersectionObserver'
import { currentDictIdAtom } from '@/store'
import type { Dictionary } from '@/typings'
import { calcChapterCount } from '@/utils'
import * as Progress from '@radix-ui/react-progress'
import { ChevronRight } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { useMemo, useRef } from 'react'

interface Props {
  dictionary: Dictionary
  withTopBorder?: boolean
}

export default function DictionaryComponent({ dictionary, withTopBorder = false }: Props) {
  const currentDictID = useAtomValue(currentDictIdAtom)
  const divRef = useRef<HTMLButtonElement>(null)
  const entry = useIntersectionObserver(divRef, {})
  const isVisible = !!entry?.isIntersecting
  const dictStats = useDictStats(dictionary.id, isVisible)
  const chapterCount = useMemo(() => calcChapterCount(dictionary.length), [dictionary.length])
  const isSelected = currentDictID === dictionary.id
  const progress = useMemo(
    () => (dictStats ? Math.ceil((dictStats.exercisedChapterCount / chapterCount) * 100) : 0),
    [dictStats, chapterCount],
  )
  const legacyFallbackCount = dictStats?.legacyFallbackCount ?? 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`选择词书：${dictionary.name}`}
          ref={divRef}
          className={`${withTopBorder ? 'border-t border-[var(--wenyan-line-soft)]' : ''} ${
            isSelected ? 'bg-[color-mix(in_srgb,var(--wenyan-accent-soft)_58%,transparent)]' : ''
          } group flex min-h-[76px] w-full cursor-pointer items-center gap-4 px-3 py-3.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--wenyan-paper-muted)_78%,transparent)] wenyan-library-choice`}
        >
          <span
            aria-hidden="true"
            className={`${isSelected ? 'bg-[var(--wenyan-accent)]' : 'bg-[var(--wenyan-line-soft)]'} h-8 w-[3px] shrink-0 rounded-full transition-colors`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h3 className={`truncate text-[14px] font-semibold ${isSelected ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink)]'}`}>
                {dictionary.name}
              </h3>
              {isSelected && <span className="text-[10px] font-medium text-[var(--wenyan-accent)]">当前</span>}
            </div>
            <TooltipProvider>
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <p className="wenyan-muted mt-1 max-w-2xl truncate text-xs leading-5">{dictionary.description}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{dictionary.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {progress > 0 && (
              <Progress.Root value={progress} max={100} className="mt-2 h-[2px] w-32 overflow-hidden rounded-full bg-[var(--wenyan-line-soft)]">
                <Progress.Indicator
                  className="h-full rounded-full bg-[var(--wenyan-accent)] transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </Progress.Root>
            )}
          </div>

          <div className="wenyan-muted flex shrink-0 items-center gap-4 text-[11px]">
            <span className="wenyan-mono">{dictionary.length} 词</span>
            {progress > 0 && (
              <span
                className="wenyan-mono tabular-nums"
                title={
                  legacyFallbackCount > 0
                    ? `有练习记录的章节占比，不代表词义掌握；其中 ${legacyFallbackCount} 章来自旧版本机记录`
                    : '有练习记录的章节占比，不代表词义掌握'
                }
              >
                已练 {progress}% 章节{legacyFallbackCount > 0 ? ' · 含旧记录' : ''}
              </span>
            )}
            <ChevronRight aria-hidden="true" size={14} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="w-[54rem] max-w-[calc(100vw-64px)] !rounded-[var(--wenyan-radius-lg)] border-[var(--wenyan-line)] bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)] shadow-[var(--wenyan-shadow)]">
        <DictDetail dictionary={dictionary} />
      </DialogContent>
    </Dialog>
  )
}
