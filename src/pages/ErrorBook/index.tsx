import DropdownExport from './DropdownExport'
import ErrorRow from './ErrorRow'
import type { ISortType } from './HeadWrongNumber'
import HeadWrongNumber from './HeadWrongNumber'
import Pagination, { ITEM_PER_PAGE } from './Pagination'
import RowDetail from './RowDetail'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { LoadingUI } from '@/components/Loading'
import Header from '@/components/Header'
import { db, useDeleteWordRecord } from '@/utils/db'
import type { WordRecord } from '@/utils/db/record'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useState } from 'react'

export function ErrorBook() {
  const [groupedRecords, setGroupedRecords] = useState<groupedWordRecords[]>([])
  const [loading, setLoading] = useState(true)
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
    setLoading(true)
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
      .finally(() => setLoading(false))
  }, [reload])

  const handleDelete = async (word: string, dict: string) => {
    await deleteWordRecord(word, dict)
    setReload((previous) => !previous)
  }

  return (
    <div className="wenyan-studio-shell flex min-h-screen flex-col text-[var(--wenyan-ink)]">
      <div className={`transition-[filter] duration-150 ${currentRowDetail ? 'blur-[1px]' : ''}`}>
        <Header />
      </div>
      <main className={`mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-9 transition-[filter] duration-150 ${currentRowDetail ? 'blur-[1px]' : ''}`}>
        <div className="mb-7 flex items-end justify-between gap-6">
          <div>
            <h1 className="wenyan-page-title">错词</h1>
            <p className="wenyan-muted mt-2 text-sm">{loading ? '正在整理…' : `${groupedRecords.length} 个词`}</p>
          </div>
          {!loading && <DropdownExport renderRecords={sortedRecords} />}
        </div>

        {loading ? (
          <section className="wenyan-surface flex min-h-[260px] items-center justify-center">
            <LoadingUI label="正在整理错词" />
          </section>
        ) : groupedRecords.length === 0 ? (
          <div className="wenyan-muted flex min-h-[280px] items-center justify-center border-y border-[var(--wenyan-line-soft)] text-sm">
            还没有错词记录
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]">
            <div className="wenyan-muted grid grid-cols-[1.2fr_3fr_100px_140px_36px] items-center gap-4 border-b border-[var(--wenyan-line-soft)] px-4 py-3 text-[10px]">
              <span>单词</span>
              <span>释义</span>
              <HeadWrongNumber sortType={sortType} setSortType={setSort} />
              <span>词书</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--wenyan-line-soft)]">
              {renderRecords.map((record) => (
                <ErrorRow key={`${record.dict}-${record.word}`} record={record} onDelete={() => handleDelete(record.word, record.dict)} />
              ))}
            </div>
          </div>
        )}

        {!loading && groupedRecords.length > ITEM_PER_PAGE && (
          <Pagination className="mt-5" page={currentPage} setPage={setPage} totalPages={totalPages} />
        )}
      </main>
      {currentRowDetail && <RowDetail currentRowDetail={currentRowDetail} allRecords={sortedRecords} />}
    </div>
  )
}
