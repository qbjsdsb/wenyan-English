import { useLearningOwner } from '@/hooks/useLearningOwner'
import { eventVisibleToOwner } from '@/learning/spellingEvidence'
import type { ChapterCompletedPayload } from '@/learning/types'
import { db } from '@/utils/db'
import { useLiveQuery } from 'dexie-react-hooks'

function chapterPayload(value: unknown): Partial<ChapterCompletedPayload> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Partial<ChapterCompletedPayload>
}

export function useDictStats(dictID: string, isStartLoad: boolean) {
  const owner = useLearningOwner()
  return useLiveQuery(async () => {
    if (!isStartLoad) return null

    const [events, legacyRecords] = await Promise.all([
      db.learningEvents.where('eventType').equals('chapter_completed').toArray(),
      db.chapterRecords.where('dict').equals(dictID).toArray(),
    ])

    const factChapters = new Set<number>()
    const postFactChapterTimes = new Map<number, number[]>()
    for (const event of events) {
      const payload = chapterPayload(event.payload)
      if (
        !payload ||
        payload.dict !== dictID ||
        payload.reviewMode !== false ||
        typeof payload.chapter !== 'number' ||
        !Number.isInteger(payload.chapter) ||
        payload.chapter < 0
      ) continue

      // Every normal chapter completion written since immutable facts were introduced
      // has a companion ChapterRecord in the same transaction. Track those rows across
      // all owners so they are never mistaken for pre-fact legacy progress later.
      const seconds = Math.floor(event.occurredAt / 1000)
      const times = postFactChapterTimes.get(payload.chapter) ?? []
      times.push(seconds)
      postFactChapterTimes.set(payload.chapter, times)

      if (eventVisibleToOwner(event, owner)) factChapters.add(payload.chapter)
    }

    // chapterRecords existed before owner-scoped immutable learning facts. Only rows
    // without a companion chapter_completed fact are genuinely legacy. This keeps the
    // compatibility fallback useful without leaking another account's newer progress.
    const legacyChapters = new Set<number>()
    for (const record of legacyRecords) {
      if (typeof record.chapter !== 'number' || !Number.isInteger(record.chapter) || record.chapter < 0) continue
      const companionTimes = postFactChapterTimes.get(record.chapter) ?? []
      const hasCompanionFact = companionTimes.some((seconds) => Math.abs(seconds - record.timeStamp) <= 1)
      if (!hasCompanionFact) legacyChapters.add(record.chapter)
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
