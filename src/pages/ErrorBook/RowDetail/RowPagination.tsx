import { currentRowDetailAtom } from '../store'
import type { groupedWordRecords } from '../type'
import { useAtom } from 'jotai'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import NextIcon from '~icons/ooui/next-ltr'
import PrevIcon from '~icons/ooui/next-rtl'

type IRowPaginationProps = {
  className?: string
  allRecords: groupedWordRecords[]
}

export const ITEM_PER_PAGE = 20

const RowPagination: FC<IRowPaginationProps> = ({ className, allRecords }) => {
  const [currentRowDetail, setCurrentRowDetail] = useAtom(currentRowDetailAtom)
  const currentIndex = useMemo(() => {
    if (!currentRowDetail) return -1
    return allRecords.findIndex((record) => record.word === currentRowDetail.word && record.dict === currentRowDetail.dict)
  }, [currentRowDetail, allRecords])

  const nextRowDetail = useCallback(() => {
    if (!currentRowDetail || currentIndex < 0 || currentIndex + 1 >= allRecords.length) return
    setCurrentRowDetail(allRecords[currentIndex + 1])
  }, [currentRowDetail, currentIndex, allRecords, setCurrentRowDetail])

  const prevRowDetail = useCallback(() => {
    if (!currentRowDetail || currentIndex <= 0) return
    setCurrentRowDetail(allRecords[currentIndex - 1])
  }, [currentRowDetail, currentIndex, setCurrentRowDetail, allRecords])

  useHotkeys('left', (event) => {
    prevRowDetail()
    event.stopPropagation()
  }, { preventDefault: true })

  useHotkeys('right', (event) => {
    nextRowDetail()
    event.stopPropagation()
  }, { preventDefault: true })

  const control = 'grid h-8 w-8 place-items-center rounded-md border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-25 dark:border-white/[0.09] dark:text-gray-500 dark:hover:bg-white/[0.04]'

  return (
    <div className={`flex select-none items-center gap-3 ${className ?? ''}`}>
      <button aria-label="上一个错词" className={control} disabled={currentIndex <= 0} onClick={prevRowDetail}>
        <PrevIcon />
      </button>
      <span className="min-w-14 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600">{currentIndex + 1} / {allRecords.length}</span>
      <button aria-label="下一个错词" className={control} disabled={currentIndex < 0 || currentIndex + 1 >= allRecords.length} onClick={nextRowDetail}>
        <NextIcon />
      </button>
    </div>
  )
}

export default RowPagination
