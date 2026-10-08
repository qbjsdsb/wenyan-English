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

  const onClick = useCallback(() => {
    setCurrentRowDetail(record)
    recordErrorBookAction('detail')
  }, [record, setCurrentRowDetail])

  return (
    <div
      className="grid cursor-pointer grid-cols-[1.2fr_3fr_100px_140px_36px] items-center gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
    >
      <span className="font-medium text-gray-900 dark:text-gray-200">{record.word}</span>
      <span className="truncate text-gray-500 dark:text-gray-500">
        {word ? word.trans.join('；') : <LoadingWordUI isLoading={isLoading} hasError={hasError} />}
      </span>
      <span className="tabular-nums text-gray-500 dark:text-gray-500">{record.wrongCount}</span>
      <span className="truncate text-xs text-gray-400 dark:text-gray-600">{dictInfo?.name}</span>
      <span
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`删除 ${record.word} 的错词记录`}
                className="grid h-8 w-8 place-items-center rounded-md text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
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
