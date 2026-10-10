import { useLearningOwner } from '@/hooks/useLearningOwner'
import { eventVisibleToOwner } from '@/learning/spellingEvidence'
import type { ChapterCompletedPayload } from '@/learning/types'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'

export function useDictStats(dictID: string, isStartLoad: boolean) {
  const owner = useLearningOwner()
  return useLiveQuery(async () => {
    if (!isStartLoad) return null
    const events = await db.learningEvents.where('eventType').equals('chapter_completed').toArray()
    const chapters = new Set<number>()
    for (const event of events) {
      if (!eventVisibleToOwner(event, owner) || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) continue
      const payload = event.payload as Partial<ChapterCompletedPayload>
      if (
        payload.dict !== dictID ||
        payload.reviewMode !== false ||
        typeof payload.chapter !== 'number' ||
        !Number.isInteger(payload.chapter) ||
        payload.chapter < 0
      ) continue
      chapters.add(payload.chapter)
    }
    return { exercisedChapterCount: chapters.size }
  }, [dictID, isStartLoad, owner])
}
