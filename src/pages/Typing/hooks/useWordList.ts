import { useLearningOwner } from '@/hooks/useLearningOwner'
import { dictionarySource } from '@/utils/dictionaryCache'
import { CHAPTER_LENGTH } from '@/constants'
import { currentChapterAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import type { WordWithIndex } from '@/typings/index'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useMemo } from 'react'
import useSWR from 'swr'

export type UseWordListResult = {
  words: WordWithIndex[]
  fromCache: boolean
  isLoading: boolean
  error: Error | undefined
  retry: () => Promise<void>
}

/**
 * Use word lists from the current selected dictionary.
 */
export function useWordList(): UseWordListResult {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const owner = useLearningOwner()
  const { isReviewMode: rawReviewMode, reviewRecord } = useAtomValue(reviewModeInfoAtom)
  const isReviewMode = rawReviewMode && (reviewRecord?.origin !== 'manual' || reviewRecord.ownerUserId === owner)

  // Keep invalid persisted chapter state out of the render path. Updating the atom
  // in an effect avoids a render-time state write while preserving the old fallback.
  useEffect(() => {
    if (currentDictInfo.chapterCount <= 0) return
    if (currentChapter < 0 || currentChapter >= currentDictInfo.chapterCount) setCurrentChapter(0)
  }, [currentChapter, currentDictInfo.chapterCount, setCurrentChapter])

  // Saved review blocks already carry frozen local content. Normal chapters always
  // come from the selected dictionary, including CET4 chapter 1, so content/version
  // identity has one source of truth and can use the normal validated cache fallback.
  const { data: wordList, error, isLoading, mutate } = useSWR(
    isReviewMode ? null : currentDictInfo.url,
    wordListFetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false },
  )

  const words: WordWithIndex[] = useMemo(() => {
    const newWords = isReviewMode
      ? reviewRecord?.words ?? []
      : wordList?.slice(currentChapter * CHAPTER_LENGTH, (currentChapter + 1) * CHAPTER_LENGTH) ?? []

    // 记录原始 index, 并对 word.trans 做兜底处理
    return newWords.map((word, index) => {
      let trans: string[]
      if (Array.isArray(word.trans)) {
        trans = word.trans.filter((item) => typeof item === 'string')
      } else if (word.trans === null || word.trans === undefined || typeof word.trans === 'object') {
        trans = []
      } else {
        trans = [String(word.trans)]
      }
      return {
        ...word,
        index,
        trans,
      }
    })
  }, [isReviewMode, wordList, reviewRecord?.words, currentChapter])

  return {
    words,
    fromCache: !isReviewMode && dictionarySource(import.meta.env.BASE_URL + currentDictInfo.url.replace(/^\/+/, '')) === 'cache',
    isLoading,
    error,
    retry: async () => { await mutate() },
  }
}
