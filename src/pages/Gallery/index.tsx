import ChapterGroup from './ChapterGroup'
import DictionaryGroup from './DictionaryGroup'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { dictionaries } from '@/resources/dictionary'
import { currentChapterAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import groupBy from '@/utils/groupBy'
import { useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import { useHotkeys } from 'react-hotkeys-hook'
import { Link, useNavigate } from 'react-router-dom'

const GalleryPage: React.FC = () => {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const currentChapter = useAtomValue(currentChapterAtom)
  const [query, setQuery] = useState('')
  const setReview = useSetAtom(reviewModeInfoAtom)
  const leaveReview = () => setReview((old) => ({ ...old, isReviewMode: false }))
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return dictionaries.filter((dict) => `${dict.name} ${dict.description} ${dict.category}`.toLocaleLowerCase().includes(needle))
  }, [query])
  const groups = Object.entries(groupBy(matches, (dict) => dict.category))
  const navigate = useNavigate()

  useHotkeys('esc', () => { leaveReview(); navigate('/') }, { ignoreEventWhen: ignoresStudyKey, preventDefault: true })

  return (
    <Layout>
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h1 className="wenyan-page-title">词库</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              {currentDictInfo.name} · 第 {currentChapter + 1} 章
            </p>
          </div>
          <Link
            to="/"
            onClick={leaveReview}
            className="wenyan-button-primary inline-flex items-center gap-3 no-underline"
          >
            开始学习 <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid min-h-0 flex-1 gap-10 md:grid-cols-[280px_minmax(0,1fr)]">
          <section aria-label="词书选择" className="min-h-0 border-t border-black/[0.08] pt-5 dark:border-white/[0.09]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-200">词书</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">{matches.length} 本</span>
            </div>
            <div className="relative mb-4">
              <Search aria-hidden="true" size={15} className="wenyan-muted pointer-events-none absolute left-3 top-3" />
              <input aria-label="搜索词书" type="search" placeholder="搜索词书、考试名称" value={query}
                onChange={(event) => setQuery(event.target.value)} className="wenyan-input w-full py-2 pl-9 pr-3 text-sm" />
            </div>
            {matches.length === 0 && <div role="status" className="wenyan-soft-surface p-5 text-sm">
              <p>没有找到匹配的词书</p>
              <button className="wenyan-link mt-3" onClick={() => setQuery('')}>清除搜索</button>
            </div>}
            <div className="customized-scrollbar max-h-[calc(100vh-290px)] overflow-y-auto pr-2">
              {groups.map(([name, items]) => (
                <DictionaryGroup key={name} title={name} dictionaries={items} />
              ))}
            </div>
          </section>

          <section aria-label="章节选择" className="min-h-0 border-t border-black/[0.08] pt-5 dark:border-white/[0.09]">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <div><h2 className="text-sm font-medium text-gray-900 dark:text-gray-200">{currentDictInfo.name}</h2><p className="wenyan-muted mt-1 text-xs">选择章节，再开始学习</p></div>
              <span className="text-xs text-gray-400 dark:text-gray-600">{currentDictInfo.length} 词</span>
            </div>
            <div className="customized-scrollbar max-h-[calc(100vh-190px)] overflow-y-auto pr-2">
              <ChapterGroup totalWords={currentDictInfo.length} />
            </div>
          </section>
        </div>
      </main>
    </Layout>
  )
}

GalleryPage.displayName = 'GalleryPage'

export default GalleryPage
