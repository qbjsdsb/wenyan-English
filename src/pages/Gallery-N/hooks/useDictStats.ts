import { db } from '@/utils/db'
import type { IChapterRecord } from '@/utils/db/record'
import { useEffect, useState } from 'react'

export function useDictStats(dictID: string, isStartLoad: boolean) {
  const [dictStats, setDictStats] = useState<IDictStats | null>(null)

  useEffect(() => {
    const fetchDictStats = async () => {
      const stats = await getDictStats(dictID)
      setDictStats(stats)
    }

    if (isStartLoad && !dictStats) {
      fetchDictStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictID, isStartLoad])

  return dictStats
}

interface IDictStats {
  exercisedChapterCount: number
}

async function getDictStats(dict: string): Promise<IDictStats> {
  const records: IChapterRecord[] = await db.chapterRecords.where({ dict }).toArray()
  // Review blocks use chapter -1 and are not an extra completed dictionary chapter.
  const allChapter = records.map(({ chapter }) => chapter).filter((chapter): chapter is number =>
    typeof chapter === 'number' && Number.isInteger(chapter) && chapter >= 0)
  const uniqueChapter = new Set(allChapter)
  const exercisedChapterCount = uniqueChapter.size

  return { exercisedChapterCount }
}
