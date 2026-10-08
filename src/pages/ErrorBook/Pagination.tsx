import type { FC } from 'react'
import { useCallback } from 'react'
import NextIcon from '~icons/ooui/next-ltr'
import PrevIcon from '~icons/ooui/next-rtl'

type IPaginationProps = {
  className?: string
  page: number
  setPage: (page: number) => void
  totalPages: number
}

export const ITEM_PER_PAGE = 20

const Pagination: FC<IPaginationProps> = ({ className, page, setPage, totalPages }) => {
  const nextPage = useCallback(() => setPage(page + 1), [page, setPage])
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage])
  const control = 'grid h-8 w-8 place-items-center rounded-md border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-25 dark:border-white/[0.09] dark:text-gray-500 dark:hover:bg-white/[0.04]'

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <button aria-label="上一页" className={control} disabled={page <= 1} onClick={prevPage}>
        <PrevIcon />
      </button>
      <span className="min-w-14 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600">{page} / {totalPages}</span>
      <button aria-label="下一页" className={control} disabled={page >= totalPages} onClick={nextPage}>
        <NextIcon />
      </button>
    </div>
  )
}

export default Pagination
