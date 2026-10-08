import { LoadingWordUI } from './LoadingWordUI'
import useGetWord from './hooks/useGetWord'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { idDictionaryMap } from '@/resources/dictionary'
import { recordErrorBookAction } from '@/utils'
import { useSetAtom } from 'jotai'
import { Trash2 } from 'lucide-react'
import type { FC } from 'react'
import { useCallback } from 'react'

type IErrorRowProps = {
  record: groupedWordRecords
  onDelete: () => void
}

const ErrorRow: FC<IErrorRowProps> = ({ record, onDelete }) => {
  const setCurrentRowDetail = useSetAtom(currentRowDetailAtom)
  const dictInfo = idDictionaryMap[record.dict]
  const { word, isLoading, hasError } = useGetWord(record.word, dictInfo)
  const emberLevel = record.wrongCount >= 5 ? '3' : record.wrongCount >= 3 ? '2' : '1'

  const onClick = useCallback(() => {
    setCurrentRowDetail(record)
    recordErrorBookAction('detail')
  }, [record, setCurrentRowDetail])

  return (
    <div
      className="grid cursor-pointer grid-cols-[1.2fr_3fr_100px_140px_36px] items-center gap-4 px-4 py-3.5 text-sm transition-[background-color,transform] duration-150 hover:bg-[var(--wenyan-paper-muted)]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
    >
      <span className="font-medium text-[var(--wenyan-ink)]">{record.word}</span>
      <span className="truncate text-[var(--wenyan-ink-secondary)]">
        {word ? word.trans.join('；') : <LoadingWordUI isLoading={isLoading} hasError={hasError} />}
      </span>
      <span className="wenyan-ember-count tabular-nums text-[var(--wenyan-ink-secondary)]">
        <span className="wenyan-ember-dot" data-level={emberLevel} aria-hidden="true" />
        {record.wrongCount}
      </span>
      <span className="wenyan-muted truncate text-xs">{dictInfo?.name}</span>
      <span
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`删除 ${record.word} 的错词记录`}
                className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--wenyan-danger)_8%,transparent)] hover:text-[var(--wenyan-danger)]"
              >
                <Trash2 aria-hidden="true" size={14} strokeWidth={1.7} />
              </button>
            </TooltipTrigger>
            <TooltipContent><p>删除记录</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
    </div>
  )
}

export default ErrorRow
