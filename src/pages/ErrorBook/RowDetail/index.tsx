/* eslint-disable react/prop-types */
import { LoadingWordUI } from '../LoadingWordUI'
import useGetWord from '../hooks/useGetWord'
import { currentRowDetailAtom } from '../store'
import type { groupedWordRecords } from '../type'
import DataTag from './DataTag'
import RowPagination from './RowPagination'
import type { WordPronunciationIconRef } from '@/components/WordPronunciationIcon'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import Phonetic from '@/pages/Typing/components/WordPanel/components/Phonetic'
import Letter from '@/pages/Typing/components/WordPanel/components/Word/Letter'
import { idDictionaryMap } from '@/resources/dictionary'
import { useSetAtom } from 'jotai'
import { useCallback, useMemo, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import HashtagIcon from '~icons/heroicons/chart-pie-20-solid'
import CheckCircle from '~icons/heroicons/check-circle-20-solid'
import ClockIcon from '~icons/heroicons/clock-20-solid'
import XCircle from '~icons/heroicons/x-circle-20-solid'
import IconX from '~icons/tabler/x'

type RowDetailProps = {
  currentRowDetail: groupedWordRecords
  allRecords: groupedWordRecords[]
}

const RowDetail: React.FC<RowDetailProps> = ({ currentRowDetail, allRecords }) => {
  const setCurrentRowDetail = useSetAtom(currentRowDetailAtom)
  const dictInfo = idDictionaryMap[currentRowDetail.dict]
  const { word, isLoading, hasError } = useGetWord(currentRowDetail.word, dictInfo)
  const wordPronunciationIconRef = useRef<WordPronunciationIconRef>(null)

  const rowDetailData: RowDetailData = useMemo(() => {
    const time = currentRowDetail.records.length > 0
      ? currentRowDetail.records.reduce((acc, cur) => acc + cur.totalTime, 0) / currentRowDetail.records.length
      : 0
    const correctCount = currentRowDetail.records.length
    const wrongCount = currentRowDetail.wrongCount
    return {
      time: (time / 1000).toFixed(2),
      sumCount: correctCount + wrongCount,
      correctCount,
      wrongCount,
    }
  }, [currentRowDetail.records, currentRowDetail.wrongCount])

  const onClose = useCallback(() => setCurrentRowDetail(null), [setCurrentRowDetail])

  useHotkeys('esc', (event) => {
    onClose()
    event.stopPropagation()
  }, { preventDefault: true })

  useHotkeys('ctrl+j', () => wordPronunciationIconRef.current?.play(), [], { enableOnFormTags: true, preventDefault: true })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6 backdrop-blur-[2px]">
      <button aria-label="关闭错词详情" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="wenyan-surface relative z-10 w-full max-w-xl px-8 py-8">
        <button
          type="button"
          aria-label="关闭"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] transition-colors hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
          onClick={onClose}
        >
          <IconX className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center pt-4 text-center">
          <div>
            {currentRowDetail.word.split('').map((letter, index) => (
              <Letter key={`${index}-${letter}`} letter={letter} visible state="normal" />
            ))}
          </div>
          <div className="relative mt-1 flex h-8 items-center">
            {word ? <Phonetic word={word} /> : <LoadingWordUI isLoading={isLoading} hasError={hasError} />}
            {word && (
              <WordPronunciationIcon
                lang={dictInfo.language}
                word={word}
                className="absolute -right-7 top-1/2 h-5 w-5 -translate-y-1/2"
                ref={wordPronunciationIconRef}
              />
            )}
          </div>
          <div className="wenyan-body mt-2 max-w-md text-sm leading-7">
            {word ? word.trans.join('；') : <LoadingWordUI isLoading={isLoading} hasError={hasError} />}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-[var(--wenyan-line-soft)] py-5">
          <DataTag icon={ClockIcon} name="平均用时" data={rowDetailData.time} />
          <DataTag icon={HashtagIcon} name="练习次数" data={rowDetailData.sumCount} />
          <DataTag icon={CheckCircle} name="正确次数" data={rowDetailData.correctCount} />
          <DataTag icon={XCircle} name="错误次数" data={rowDetailData.wrongCount} />
        </div>

        <RowPagination className="mt-6 justify-center" allRecords={allRecords} />
      </section>
    </div>
  )
}

type RowDetailData = {
  time: string
  sumCount: number
  correctCount: number
  wrongCount: number
}

export default RowDetail
