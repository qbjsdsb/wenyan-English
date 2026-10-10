import { useLearningOwner } from '@/hooks/useLearningOwner'
import { eventVisibleToOwner } from '@/learning/spellingEvidence'
import type { ChapterCompletedPayload } from '@/learning/types'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'

export function useDictStats(dictID: string, isStartLoad: boolean) {
  const owner = useLearningOwner()
  return useLiveQuery(async () => {
    if (!isStartLoad) return null

    const [events, legacyRecords] = await Promise.all([
      db.learningEvents.where('eventType').equals('chapter_completed').toArray(),
      db.chapterRecords.where('dict').equals(dictID).toArray(),
    ])

    const factChapters = new Set<number>()
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
      factChapters.add(payload.chapter)
    }

    // chapterRecords predate owner-scoped immutable learning facts. Keep them as a
    // display-only compatibility fallback so an upgrade never makes real local
    // progress appear to vanish. They are never promoted into learningEvents.
    const legacyChapters = new Set<number>()
    for (const record of legacyRecords) {
      if (typeof record.chapter !== 'number' || !Number.isInteger(record.chapter) || record.chapter < 0) continue
      legacyChapters.add(record.chapter)
    }

    const displayedChapters = new Set<number>(Array.from(factChapters))
    let legacyFallbackCount = 0
    legacyChapters.forEach((chapter) => {
      if (!factChapters.has(chapter)) legacyFallbackCount += 1
      displayedChapters.add(chapter)
    })

    return {
      exercisedChapterCount: displayedChapters.size,
      factChapterCount: factChapters.size,
      legacyFallbackCount,
    }
  }, [dictID, isStartLoad, owner])
}
