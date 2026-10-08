import DictionaryGroup from './CategoryDicts'
import DictRequest from './DictRequest'
import { LanguageTabSwitcher } from './LanguageTabSwitcher'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { dictionaries } from '@/resources/dictionary'
import { currentDictInfoAtom } from '@/store'
import type { Dictionary, LanguageCategoryType } from '@/typings'
import groupBy, { groupByDictTags } from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import { createContext, useCallback, useEffect, useMemo } from 'react'
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
  const navigate = useNavigate()
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

  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  useHotkeys('enter,esc', onBack, { preventDefault: true })

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
              <p className="wenyan-muted mt-2 text-sm">{currentDictInfo.name} · {currentDictInfo.length} 词</p>
            </div>
            <DictRequest />
          </div>

          <div className="mb-9 border-b border-[var(--wenyan-line-soft)] pb-3">
            <LanguageTabSwitcher />
          </div>

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
