import EmptyState from '@/components/EmptyState'
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
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { buildActiveSpellingErrorsFromAttempts, visibleSpellingAttemptsWithLegacy } from '@/learning/spellingEvidence'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentDictIdAtom } from '@/store'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAtom } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ERROR_PRACTICE_WINDOW_MS = 14 * 86_400_000

export function ErrorBook() {
  const owner = useLearningOwner()
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [sortType, setSortType] = useState<ISortType>('desc')
  const [retry, setRetry] = useState(0)
  const [currentRowDetail, setCurrentRowDetail] = useAtom(currentRowDetailAtom)
  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)

  useEffect(() => {
    setCurrentRowDetail(null)
    setCurrentPage(1)
  }, [owner, setCurrentRowDetail])

  const data = useLiveQuery(async () => {
    try {
      const [events, wordRecords] = await Promise.all([
        db.learningEvents.where('eventType').equals('word_attempted').toArray(),
        db.wordRecords.toArray(),
      ])
      const evidence = visibleSpellingAttemptsWithLegacy(events, wordRecords, owner)
      return {
        records: buildActiveSpellingErrorsFromAttempts(evidence.records) as groupedWordRecords[],
        legacyCount: evidence.legacyCount,
        error: false,
      }
    } catch {
      return { records: [] as groupedWordRecords[], legacyCount: 0, error: true }
    }
  }, [owner, retry])
  const loading = data === undefined
  const loadError = data?.error ?? false
  const groupedRecords = data?.records ?? []
  const legacyCount = data?.legacyCount ?? 0
  const totalPages = useMemo(() => Math.max(1, Math.ceil(groupedRecords.length / ITEM_PER_PAGE)), [groupedRecords.length])

  useEffect(() => { setCurrentPage((page) => Math.min(page, totalPages)) }, [totalPages])

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

  const practiceEligibleRecords = useMemo(() => {
    const cutoff = Date.now() - ERROR_PRACTICE_WINDOW_MS
    return groupedRecords.filter((record) => (
      record.latestSource === 'fact' &&
      record.latestOccurredAt >= cutoff &&
      Boolean(idDictionaryMap[record.dict]) &&
      idDictionaryMap[record.dict]?.language === 'en'
    ))
  }, [groupedRecords])
  const practiceDictId = useMemo(() => {
    if (practiceEligibleRecords.some((record) => record.dict === currentDictId)) return currentDictId
    return practiceEligibleRecords[0]?.dict
  }, [currentDictId, practiceEligibleRecords])
  const practiceDictName = practiceDictId ? idDictionaryMap[practiceDictId]?.name : undefined

  const startErrorPractice = () => {
    if (!practiceDictId || !idDictionaryMap[practiceDictId]) return
    setCurrentDictId(practiceDictId)
    navigate('/practice?mode=spelling&pool=errors')
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
            <p className="wenyan-muted mt-2 text-sm">{loading ? '正在整理…' : `${groupedRecords.length} 个最近一次仍拼错的词`}</p>
          </div>
          {!loading && !loadError && (
            <div className="flex items-center gap-3">
              {practiceDictId && (
                <button type="button" onClick={startErrorPractice} className="wenyan-button-secondary">
                  练{practiceDictName ? ` ${practiceDictName} ` : ' '}近期错词
                </button>
              )}
              <DropdownExport renderRecords={sortedRecords} />
            </div>
          )}
        </div>

        <p className="wenyan-muted mb-3 max-w-3xl text-xs leading-6">
          这里按当前账号可见的真实拼写事实整理，并保留升级前无法归属账号的旧版本机历史：只有最近一次仍有拼写错误的词会留下；之后拼对会自动离开。历史学习事实不会被“删除”。
        </p>
        {legacyCount > 0 && (
          <p className="wenyan-muted mb-5 max-w-3xl text-[11px] leading-5">
            当前还显示 {legacyCount} 条去重后的旧版本机拼写记录。它们只用于保留历史，不会被重新写成或上传为学习事实；“近期错词”练习只使用最近 14 天、当前可用词书里的新版事实。
          </p>
        )}
        {legacyCount === 0 && (
          <p className="wenyan-muted mb-5 max-w-3xl text-[11px] leading-5">
            跨词书有错词时，右上角练习会锁定一本仍可用的词书，并只练最近 14 天仍未纠正的错词。
          </p>
        )}

        {loading ? (
          <section className="wenyan-surface flex min-h-[260px] items-center justify-center">
            <LoadingUI label="正在整理错词" />
          </section>
        ) : loadError ? (
          <section className="wenyan-surface p-7" role="alert"><p>暂时无法读取当前账号的拼写记录。</p><button className="wenyan-button-secondary mt-4" onClick={() => setRetry((value) => value + 1)}>重新读取</button></section>
        ) : groupedRecords.length === 0 ? (
          <EmptyState title="目前没有待处理错词" description="最近一次已经拼对的词会自动离开这里；没有记录也不会被当成已经掌握。" />
        ) : (
          <div className="overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]">
            <div className="wenyan-muted grid grid-cols-[1.2fr_3fr_110px_150px] items-center gap-4 border-b border-[var(--wenyan-line-soft)] px-4 py-3 text-[10px]">
              <span>单词</span>
              <span>释义</span>
              <HeadWrongNumber sortType={sortType} setSortType={setSort} />
              <span>词书</span>
            </div>
            <div className="divide-y divide-[var(--wenyan-line-soft)]">
              {renderRecords.map((record) => (
                <ErrorRow key={`${record.dict}-${record.word}`} record={record} />
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
