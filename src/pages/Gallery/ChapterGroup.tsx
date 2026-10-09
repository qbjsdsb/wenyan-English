import ChapterButton from './ChapterButton'
import { CHAPTER_LENGTH } from '@/constants'
import { currentChapterAtom, currentDictInfoAtom } from '@/store'
import range from '@/utils/range'
import { useAtom, useAtomValue } from 'jotai'
import type React from 'react'

const ChapterGroup: React.FC<ChapterGroupProps> = ({ totalWords }) => {
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const { id: dictID, chapterCount } = useAtomValue(currentDictInfoAtom)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {range(0, chapterCount, 1).map((index) => (
        <ChapterButton
          wordCount={index + 1 === chapterCount ? totalWords % CHAPTER_LENGTH || CHAPTER_LENGTH : CHAPTER_LENGTH}
          key={`${dictID}-${index}`}
          selected={currentChapter === index}
          index={index}
          onClick={() => setCurrentChapter(index)}
        />
      ))}
    </div>
  )
}

export default ChapterGroup

export type ChapterGroupProps = {
  totalWords: number
}
