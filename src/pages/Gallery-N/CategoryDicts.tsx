import DictTagSwitcher from './DictTagSwitcher'
import DictionaryComponent from './DictionaryWithoutCover'
import { currentDictInfoAtom } from '@/store'
import type { Dictionary } from '@/typings'
import { findCommonValues } from '@/utils'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'

export default function DictionaryGroup({ groupedDictsByTag }: { groupedDictsByTag: Record<string, Dictionary[]> }) {
  const tagList = useMemo(() => Object.keys(groupedDictsByTag), [groupedDictsByTag])
  const [currentTag, setCurrentTag] = useState(tagList.length > 0 ? tagList[0] : '')
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const hasMultipleTags = tagList.length > 1

  const onChangeCurrentTag = useCallback((tag: string) => {
    setCurrentTag(tag)
  }, [])

  useEffect(() => {
    const commonTags = findCommonValues(tagList, currentDictInfo.tags)
    if (commonTags.length > 0) setCurrentTag(commonTags[0])
  }, [currentDictInfo.tags, tagList])

  const list = (
    <div className="wenyan-library-list overflow-hidden bg-transparent">
      {currentTag && groupedDictsByTag[currentTag] ? (
        groupedDictsByTag[currentTag].map((dict, index) => (
          <DictionaryComponent key={dict.id} dictionary={dict} withTopBorder={index > 0} />
        ))
      ) : (
        <div className="wenyan-muted py-8 text-center text-sm">当前分类下没有可用的词典</div>
      )}
    </div>
  )

  if (!hasMultipleTags) return list

  return (
    <div className="wenyan-library-group">
      <aside aria-label="词库分类">
        <DictTagSwitcher tagList={tagList} currentTag={currentTag} onChangeCurrentTag={onChangeCurrentTag} vertical />
      </aside>
      {list}
    </div>
  )
}
