import ChapterGroup from './ChapterGroup'
import DictionaryGroup from './DictionaryGroup'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { dictionaries } from '@/resources/dictionary'
import { currentChapterAtom, currentDictInfoAtom } from '@/store'
import groupBy from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import type React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Link, useNavigate } from 'react-router-dom'

const GalleryPage: React.FC = () => {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const currentChapter = useAtomValue(currentChapterAtom)
  const groups = Object.entries(groupBy(dictionaries, (dict) => dict.category))
  const navigate = useNavigate()

  useHotkeys('enter,esc', () => navigate('/'), { preventDefault: true })

  return (
    <Layout>
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-gray-950 dark:text-gray-100">词库</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              {currentDictInfo.name} · 第 {currentChapter + 1} 章
            </p>
          </div>
          <Link
            to="/"
            className="rounded-lg bg-[#1d1d1b] px-4 py-2.5 text-sm font-medium text-white no-underline transition-colors hover:bg-black dark:bg-[#eeeeea] dark:text-[#111210] dark:hover:bg-white"
          >
            开始学习
          </Link>
        </div>

        <div className="grid min-h-0 flex-1 gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section aria-label="词书选择" className="min-h-0 border-t border-black/[0.08] pt-5 dark:border-white/[0.09]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-200">词书</h2>
              <span className="text-xs text-gray-400 dark:text-gray-600">{dictionaries.length} 本</span>
            </div>
            <div className="customized-scrollbar max-h-[calc(100vh-190px)] overflow-y-auto pr-2">
              {groups.map(([name, items]) => (
                <DictionaryGroup key={name} title={name} dictionaries={items} />
              ))}
            </div>
          </section>

          <section aria-label="章节选择" className="min-h-0 border-t border-black/[0.08] pt-5 dark:border-white/[0.09]">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-200">章节</h2>
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
