import DictionaryComponent from './DictionaryWithoutCover'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import { ArrowRight, Search } from 'lucide-react'
import DictionaryGroup from './CategoryDicts'
import DictRequest from './DictRequest'
import { LanguageTabSwitcher } from './LanguageTabSwitcher'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { dictionaries } from '@/resources/dictionary'
import { currentChapterAtom, currentDictInfoAtom } from '@/store'
import type { Dictionary, LanguageCategoryType } from '@/typings'
import groupBy, { groupByDictTags } from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Link, useNavigate } from 'react-router-dom'
import type { Updater } from 'use-immer'
import { useImmer } from 'use-immer'

export type GalleryState = {
  currentLanguageTab: LanguageCategoryType
}

const initialGalleryState: GalleryState = {
  currentLanguageTab: 'en',
}

export const GalleryContext = createContext<{
  state: GalleryState
  setState: Updater<GalleryState>
} | null>(null)

export default function GalleryPage() {
  const [galleryState, setGalleryState] = useImmer<GalleryState>(initialGalleryState)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const currentChapter = useAtomValue(currentChapterAtom)
  const currentDictInfo = useAtomValue(currentDictInfoAtom)

  const { groupedByCategoryAndTag } = useMemo(() => {
    const currentLanguageCategoryDicts = dictionaries.filter((dict) => dict.languageCategory === galleryState.currentLanguageTab)
    const groupedByCategory = Object.entries(groupBy(currentLanguageCategoryDicts, (dict) => dict.category))
    const groupedByCategoryAndTag = groupedByCategory.map(
      ([category, dicts]) => [category, groupByDictTags(dicts)] as [string, Record<string, Dictionary[]>],
    )

    return {
      groupedByCategoryAndTag,
    }
  }, [galleryState.currentLanguageTab])

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return dictionaries.filter((dict) => dict.languageCategory === galleryState.currentLanguageTab &&
      `${dict.id} ${dict.name} ${dict.description} ${dict.category} ${dict.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
  }, [query, galleryState.currentLanguageTab])

  useEffect(() => { setQuery('') }, [galleryState.currentLanguageTab])

  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  useHotkeys('esc', onBack, { ignoreEventWhen: ignoresStudyKey, preventDefault: true })

  useEffect(() => {
    if (currentDictInfo) {
      setGalleryState((state) => {
        state.currentLanguageTab = currentDictInfo.languageCategory
      })
    }
  }, [currentDictInfo, setGalleryState])

  return (
    <Layout>
      <GalleryContext.Provider value={{ state: galleryState, setState: setGalleryState }}>
        <Header />
        <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-9">
          <div className="mb-8 flex items-end justify-between gap-8">
            <div>
              <h1 className="wenyan-page-title">词库</h1>
              <p className="wenyan-muted mt-2 text-sm">{currentDictInfo.name} · 第 {currentChapter + 1} 章</p>
            </div>
            <Link to="/" className="wenyan-button-secondary inline-flex items-center gap-3 no-underline">继续当前学习 <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-6 border-b border-[var(--wenyan-line-soft)] pb-3">
            <LanguageTabSwitcher />
            <div className="relative w-72">
              <Search size={15} aria-hidden="true" className="wenyan-muted pointer-events-none absolute left-3 top-3" />
              <input aria-label="搜索词书" type="search" placeholder="搜索词书、考试名称" value={query}
                onChange={(event) => setQuery(event.target.value)} className="wenyan-input w-full py-2 pl-9 pr-3 text-sm" />
            </div>
          </div>

          {query.trim() ? (
            <section aria-label="搜索结果" className="wenyan-library-results">
              <p role="status" className="wenyan-muted mb-4 text-xs">找到 {matches.length} 本词书</p>
              {matches.length ? <div className="wenyan-library-list">{matches.map((dict, index) => <DictionaryComponent key={dict.id} dictionary={dict} withTopBorder={index > 0} />)}</div> :
                <div className="wenyan-empty-state"><p>没有找到匹配的词书</p><button className="wenyan-button-secondary mt-4" onClick={() => setQuery('')}>清除搜索</button></div>}
            </section>
          ) : <div className="space-y-11">
            {groupedByCategoryAndTag.map(([category, groupeByTag]) => (
              <section key={category}>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="wenyan-section-title">{category}</h2>
                </div>
                <DictionaryGroup groupedDictsByTag={groupeByTag} />
              </section>
            ))}
          </div>}

          <details className="wenyan-muted mt-14 border-t border-[var(--wenyan-line-soft)] pt-4 text-xs">
            <summary className="wenyan-link cursor-pointer select-none text-xs">词典数据说明</summary>
            <div className="mt-4"><DictRequest /></div>
            <p className="mt-3 max-w-3xl leading-6">
              词典数据来自开源项目与社区贡献，仅供个人学习和研究使用。若你是数据版权所有者并希望调整或移除相关内容，请通过项目渠道联系。
            </p>
          </details>
        </main>
      </GalleryContext.Provider>
    </Layout>
  )
}
