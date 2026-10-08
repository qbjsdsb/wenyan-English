import { useDeleteWordRecord } from '../../../utils/db'
import Chapter from '../Chapter'
import { ErrorTable } from '../ErrorTable'
import { getRowsFromErrorWordData } from '../ErrorTable/columns'
import { ReviewDetail } from '../ReviewDetail'
import useErrorWordData from '../hooks/useErrorWords'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import type { Dictionary } from '@/typings'
import range from '@/utils/range'
import { useAtom, useSetAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

enum Tab {
  Chapters = 'chapters',
  Errors = 'errors',
  Review = 'review',
}

const tabClass =
  'h-8 border-b-2 border-transparent px-2 text-xs font-medium text-[var(--wenyan-ink-secondary)] transition-colors hover:text-[var(--wenyan-ink)] data-[state=on]:border-[var(--wenyan-accent)] data-[state=on]:text-[var(--wenyan-ink)] disabled:opacity-100'

export default function DictDetail({ dictionary: dict }: { dictionary: Dictionary }) {
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)
  const [curTab, setCurTab] = useState<Tab>(Tab.Chapters)
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const navigate = useNavigate()
  const { deleteWordRecord } = useDeleteWordRecord()
  const [reload, setReload] = useState(false)

  const chapter = useMemo(() => (dict.id === currentDictId ? currentChapter : 0), [currentChapter, currentDictId, dict.id])
  const { errorWordData, isLoading, error } = useErrorWordData(dict, reload)

  const tableData = useMemo(() => getRowsFromErrorWordData(errorWordData), [errorWordData])

  const onDelete = useCallback(
    async (word: string) => {
      await deleteWordRecord(word, dict.id)
      setReload((old) => !old)
    },
    [deleteWordRecord, dict.id],
  )

  const onChangeChapter = useCallback(
    (index: number) => {
      setCurrentDictId(dict.id)
      setCurrentChapter(index)
      setReviewModeInfo((old) => ({ ...old, isReviewMode: false }))
      navigate('/')
    },
    [dict.id, navigate, setCurrentChapter, setCurrentDictId, setReviewModeInfo],
  )

  const handleTabChange = useCallback(
    (value: Tab) => {
      if (value && value !== curTab) setCurTab(value)
    },
    [curTab],
  )

  return (
    <div className="flex flex-col px-1 pb-1 pt-0.5 text-[var(--wenyan-ink)]">
      <div className="mb-5 border-b border-[var(--wenyan-line-soft)] pb-4">
        <div className="flex items-end justify-between gap-8">
          <div className="min-w-0">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--wenyan-ink)]">{dict.name}</h3>
            <p className="wenyan-muted mt-1.5 text-[11px]">{dict.chapterCount} 章节 · {dict.length} 词</p>
          </div>

          <ToggleGroup type="single" value={curTab} onValueChange={handleTabChange} className="shrink-0 gap-4">
            <ToggleGroupItem value={Tab.Chapters} disabled={curTab === Tab.Chapters} className={tabClass}>章节</ToggleGroupItem>
            {errorWordData.length > 0 && (
              <>
                <ToggleGroupItem value={Tab.Errors} disabled={curTab === Tab.Errors} className={tabClass}>错词</ToggleGroupItem>
                <ToggleGroupItem value={Tab.Review} disabled={curTab === Tab.Review} className={tabClass}>回顾</ToggleGroupItem>
              </>
            )}
          </ToggleGroup>
        </div>
        <p className="wenyan-body mt-3 max-w-2xl text-[13px] leading-6">{dict.description}</p>
      </div>

      <Tabs value={curTab} className="h-[28rem] w-full">
        <TabsContent value={Tab.Chapters} className="h-full">
          <ScrollArea className="h-[28rem] pr-3">
            <div className="flex w-full flex-wrap gap-2.5">
              {range(0, dict.chapterCount, 1).map((index) => (
                <Chapter
                  key={`${dict.id}-${index}`}
                  index={index}
                  checked={chapter === index}
                  dictID={dict.id}
                  onChange={onChangeChapter}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value={Tab.Errors} className="h-full">
          <ErrorTable data={tableData} isLoading={isLoading} error={error} onDelete={onDelete} />
        </TabsContent>
        <TabsContent value={Tab.Review} className="h-full">
          <ReviewDetail errorData={errorWordData} dict={dict} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
