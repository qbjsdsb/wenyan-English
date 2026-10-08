import DropdownExport from './DropdownExport'
import ErrorRow from './ErrorRow'
import type { ISortType } from './HeadWrongNumber'
import HeadWrongNumber from './HeadWrongNumber'
import Pagination, { ITEM_PER_PAGE } from './Pagination'
import RowDetail from './RowDetail'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { db, useDeleteWordRecord } from '@/utils/db'
import type { WordRecord } from '@/utils/db/record'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useState } from 'react'

export function ErrorBook() {
  const [groupedRecords, setGroupedRecords] = useState<groupedWordRecords[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(groupedRecords.length / ITEM_PER_PAGE)), [groupedRecords.length])
  const [sortType, setSortType] = useState<ISortType>('asc')
  const currentRowDetail = useAtomValue(currentRowDetailAtom)
  const { deleteWordRecord } = useDeleteWordRecord()
  const [reload, setReload] = useState(false)

  const setPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const setSort = (nextSortType: ISortType) => {
    setSortType(nextSortType)
    setCurrentPage(1)
  }

  const sortedRecords = useMemo(() => {
    if (sortType === 'none') return groupedRecords
    return [...groupedRecords].sort((a, b) => (sortType === 'asc' ? a.wrongCount - b.wrongCount : b.wrongCount - a.wrongCount))
  }, [groupedRecords, sortType])

  const renderRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEM_PER_PAGE
    return sortedRecords.slice(start, start + ITEM_PER_PAGE)
  }, [currentPage, sortedRecords])

  useEffect(() => {
    db.wordRecords
      .where('wrongCount')
      .above(0)
      .toArray()
      .then((records) => {
        const groups: groupedWordRecords[] = []
        records.forEach((record) => {
          let group = groups.find((item) => item.word === record.word && item.dict === record.dict)
          if (!group) {
            group = { word: record.word, dict: record.dict, records: [], wrongCount: 0 }
            groups.push(group)
          }
          group.records.push(record as WordRecord)
        })
        groups.forEach((group) => {
          group.wrongCount = group.records.reduce((total, current) => total + current.wrongCount, 0)
        })
        setGroupedRecords(groups)
      })
  }, [reload])

  const handleDelete = async (word: string, dict: string) => {
    await deleteWordRecord(word, dict)
    setReload((previous) => !previous)
  }

  return (
    <div className="flex min-h-screen flex-col text-gray-900 dark:text-gray-100">
      <div className={currentRowDetail ? 'blur-[1px]' : undefined}>
        <Header />
      </div>
      <main className={`mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 ${currentRowDetail ? 'blur-[1px]' : ''}`}>
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-gray-950 dark:text-gray-100">错词</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">{groupedRecords.length} 个词</p>
          </div>
          <DropdownExport renderRecords={sortedRecords} />
        </div>

        {groupedRecords.length === 0 ? (
          <div className="flex flex-1 items-center justify-center border-y border-black/[0.08] py-20 text-sm text-gray-400 dark:border-white/[0.09] dark:text-gray-600">
            还没有错词记录
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col border-y border-black/[0.08] dark:border-white/[0.09]">
            <div className="grid grid-cols-[1.2fr_3fr_100px_140px_36px] items-center gap-4 border-b border-black/[0.06] px-4 py-3 text-[11px] text-gray-400 dark:border-white/[0.07] dark:text-gray-600">
              <span>单词</span>
              <span>释义</span>
              <HeadWrongNumber sortType={sortType} setSortType={setSort} />
              <span>词书</span>
              <span />
            </div>
            <ScrollArea.Root className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea.Viewport className="h-full">
                <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {renderRecords.map((record) => (
                    <ErrorRow
                      key={`${record.dict}-${record.word}`}
                      record={record}
                      onDelete={() => handleDelete(record.word, record.dict)}
                    />
                  ))}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent" orientation="vertical" />
            </ScrollArea.Root>
          </div>
        )}

        {groupedRecords.length > ITEM_PER_PAGE && (
          <Pagination className="mt-5 self-center" page={currentPage} setPage={setPage} totalPages={totalPages} />
        )}
      </main>
      <div className={currentRowDetail ? 'blur-[1px]' : undefined}>
        <Footer />
      </div>
      {currentRowDetail && <RowDetail currentRowDetail={currentRowDetail} allRecords={sortedRecords} />}
    </div>
  )
}
