import DictionaryGroup from './CategoryDicts'
import DictRequest from './DictRequest'
import { LanguageTabSwitcher } from './LanguageTabSwitcher'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { ignoresStudyKey } from '@/pages/Typing/keyboard'
import { dictionaries } from '@/resources/dictionary'
import { currentDictInfoAtom } from '@/store'
import type { Dictionary, LanguageCategoryType } from '@/typings'
import groupBy, { groupByDictTags } from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import { Search } from 'lucide-react'
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
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
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const currentDictInfo = useAtomValue(currentDictInfoAtom)

  const { groupedByCategoryAndTag, filteredCount } = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const currentLanguageCategoryDicts = dictionaries.filter((dict) => dict.languageCategory === galleryState.currentLanguageTab)
    const filteredDicts = needle
      ? currentLanguageCategoryDicts.filter((dict) =>
          [dict.id, dict.name, dict.description, dict.category, ...dict.tags]
            .join(' ')
            .toLocaleLowerCase()
            .includes(needle),
        )
      : currentLanguageCategoryDicts
    const groupedByCategory = Object.entries(groupBy(filteredDicts, (dict) => dict.category))
    const groupedByCategoryAndTag = groupedByCategory.map(
      ([category, dicts]) => [category, groupByDictTags(dicts)] as [string, Record<string, Dictionary[]>],
    )

    return {
      groupedByCategoryAndTag,
      filteredCount: filteredDicts.length,
    }
  }, [galleryState.currentLanguageTab, query])

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

  useEffect(() => {
    setQuery('')
  }, [galleryState.currentLanguageTab])

  return (
    <Layout>
      <GalleryContext.Provider value={{ state: galleryState, setState: setGalleryState }}>
        <Header />
        <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-9">
          <div className="mb-8 flex items-end justify-between gap-8">
            <div>
              <h1 className="wenyan-page-title">词库</h1>
              <p className="wenyan-muted mt-2 text-sm">{currentDictInfo.name} · {currentDictInfo.length} 词</p>
            </div>
            <DictRequest />
          </div>

          <div className="mb-6 border-b border-[var(--wenyan-line-soft)] pb-3">
            <LanguageTabSwitcher />
          </div>

          <div className="mb-9 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search aria-hidden="true" size={15} className="wenyan-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                aria-label="搜索词书"
                type="search"
                placeholder="搜索词书、考试名称"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="wenyan-input w-full py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            {query && <span className="wenyan-muted shrink-0 text-xs">{filteredCount} 本匹配</span>}
          </div>

          {filteredCount === 0 ? (
            <div role="status" className="wenyan-soft-surface p-7 text-sm">
              <p className="font-medium text-[var(--wenyan-ink)]">没有找到匹配的词书</p>
              <p className="wenyan-muted mt-2">换一个关键词，或清除搜索查看当前语言下的全部词书。</p>
              <button type="button" className="wenyan-link mt-4" onClick={() => setQuery('')}>清除搜索</button>
            </div>
          ) : (
            <div className="space-y-11">
              {groupedByCategoryAndTag.map(([category, groupeByTag]) => (
                <section key={category}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="wenyan-section-title">{category}</h2>
                  </div>
                  <DictionaryGroup groupedDictsByTag={groupeByTag} />
                </section>
              ))}
            </div>
          )}

          <details className="wenyan-muted mt-14 border-t border-[var(--wenyan-line-soft)] pt-4 text-xs">
            <summary className="wenyan-link cursor-pointer select-none text-xs">词典数据说明</summary>
            <p className="mt-3 max-w-3xl leading-6">
              词典数据来自开源项目与社区贡献，仅供个人学习和研究使用。若你是数据版权所有者并希望调整或移除相关内容，请通过项目渠道联系。
            </p>
          </details>
        </main>
      </GalleryContext.Provider>
    </Layout>
  )
}
