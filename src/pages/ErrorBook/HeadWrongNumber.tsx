import classNames from 'classnames'
import type { FC } from 'react'
import { useCallback } from 'react'
import DownIcon from '~icons/fa/sort-down'
import UPIcon from '~icons/fa/sort-up'

type IHeadWrongNumberProps = {
  className?: string
  sortType: ISortType
  setSortType: (sortType: ISortType) => void
}

export type ISortType = 'asc' | 'desc' | 'none'

const HeadWrongNumber: FC<IHeadWrongNumberProps> = ({ className, sortType, setSortType }) => {
  const onClick = useCallback(() => {
    const sortTypes: Record<ISortType, ISortType> = { asc: 'desc', desc: 'none', none: 'asc' }
    setSortType(sortTypes[sortType])
  }, [setSortType, sortType])

  return (
    <button type="button" className={`flex items-center gap-1.5 text-left ${className ?? ''}`} onClick={onClick}>
      <span>累计按错</span>
      <span className="flex flex-col text-[9px] leading-[7px]">
        <UPIcon className={classNames({ 'text-gray-800 dark:text-gray-300': sortType === 'asc', 'text-gray-300 dark:text-gray-700': sortType !== 'asc' })} />
        <DownIcon className={classNames({ 'text-gray-800 dark:text-gray-300': sortType === 'desc', 'text-gray-300 dark:text-gray-700': sortType !== 'desc' })} />
      </span>
    </button>
  )
}

export default HeadWrongNumber
