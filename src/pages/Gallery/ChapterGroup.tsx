import ChapterButton from './ChapterButton'
import { CHAPTER_LENGTH } from '@/constants'
import { currentChapterAtom, currentDictInfoAtom, reviewModeInfoAtom } from '@/store'
import range from '@/utils/range'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'

const ChapterGroup: React.FC<ChapterGroupProps> = ({ totalWords }) => {
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const setReview = useSetAtom(reviewModeInfoAtom)
  const { id: dictID, chapterCount } = useAtomValue(currentDictInfoAtom)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {range(0, chapterCount, 1).map((index) => (
        <ChapterButton
          wordCount={index + 1 === chapterCount ? totalWords % CHAPTER_LENGTH || CHAPTER_LENGTH : CHAPTER_LENGTH}
          key={`${dictID}-${index}`}
          selected={currentChapter === index}
          index={index}
          onClick={() => { setReview((old) => ({ ...old, isReviewMode: false })); setCurrentChapter(index) }}
        />
      ))}
    </div>
  )
}

export default ChapterGroup

export type ChapterGroupProps = {
  totalWords: number
}
