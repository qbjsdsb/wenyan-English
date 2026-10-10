import { useLearningOwner } from '@/hooks/useLearningOwner'
import { visibleSpellingAttemptsWithLegacy } from '@/learning/spellingEvidence'
import { db } from '@/utils/db'
import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import type { Activity } from 'react-activity-calendar'

interface IWordStats {
  isEmpty?: boolean
  attemptRecord: Activity[]
  wordRecord: Activity[]
  typingPaceRecord: [string, number][]
  accuracyRecord: [string, number][]
  wrongTimeRecord: { name: string; value: number }[]
  legacyAttempts: number
  recent7: {
    attempts: number
    distinctWords: number
    inputAccuracy?: number
  }
}

const emptyStats: IWordStats = {
  attemptRecord: [],
  wordRecord: [],
  typingPaceRecord: [],
  accuracyRecord: [],
  wrongTimeRecord: [],
  legacyAttempts: 0,
  recent7: { attempts: 0, distinctWords: 0 },
}

function getDatesBetween(start: number, end: number) {
  const dates: string[] = []
  let curr = dayjs(start).startOf('day')
  const last = dayjs(end).endOf('day')
  while (curr.diff(last) < 0) {
    dates.push(curr.format('YYYY-MM-DD'))
    curr = curr.add(1, 'day')
  }
  return dates
}

function getLevel(value: number) {
  if (value === 0) return 0
  if (value < 4) return 1
  if (value < 8) return 2
  if (value < 12) return 3
  return 4
}

function inputAccuracy(correctCharacters: number, wrongCount: number) {
  const denominator = correctCharacters + wrongCount
  return denominator > 0 ? Math.round((correctCharacters / denominator) * 100) : undefined
}

export function useWordStats(startTimeStamp: number, endTimeStamp: number) {
  const owner = useLearningOwner()
  const [reload, setReload] = useState(0)
  const retry = useCallback(() => setReload((value) => value + 1), [])
  const data = useLiveQuery(async () => {
    try {
      return { ...(await getSpellingStats(startTimeStamp, endTimeStamp, owner)), error: false }
    } catch {
      return { ...emptyStats, error: true }
    }
  }, [startTimeStamp, endTimeStamp, owner, reload])

  return data
    ? { ...data, retry }
    : { ...emptyStats, isEmpty: undefined, error: false, retry }
}

async function getSpellingStats(startTimeStamp: number, endTimeStamp: number, ownerUserId?: string): Promise<IWordStats> {
  const startMs = startTimeStamp * 1000
  const endMs = endTimeStamp * 1000
  const [events, wordRecords] = await Promise.all([
    db.learningEvents.where('occurredAt').between(startMs - 1000, endMs + 1000, true, true).toArray(),
    db.wordRecords.where('timeStamp').between(startTimeStamp - 1, endTimeStamp + 1, true, true).toArray(),
  ])
  const evidence = visibleSpellingAttemptsWithLegacy(events, wordRecords, ownerUserId)
  const records = evidence.records.filter((record) => record.occurredAt >= startMs && record.occurredAt <= endMs)
  const legacyAttempts = records.filter((record) => record.source === 'legacy').length
  if (records.length === 0) return { ...emptyStats, isEmpty: true }

  const data: Record<string, {
    attempts: number
    words: string[]
    activeTypingMs: number
    correctCharacters: number
    wrongCount: number
    wrongKeys: string[]
  }> = {}
  for (const date of getDatesBetween(startMs, endMs)) {
    data[date] = { attempts: 0, words: [], activeTypingMs: 0, correctCharacters: 0, wrongCount: 0, wrongKeys: [] }
  }

  for (const record of records) {
    const date = dayjs(record.occurredAt).format('YYYY-MM-DD')
    if (!data[date]) data[date] = { attempts: 0, words: [], activeTypingMs: 0, correctCharacters: 0, wrongCount: 0, wrongKeys: [] }
    const day = data[date]
    day.attempts += 1
    day.words.push(record.word)
    day.activeTypingMs += record.totalTime
    day.correctCharacters += Array.from(record.word).length
    day.wrongCount += record.wrongCount
    day.wrongKeys.push(...Object.values(record.mistakes).flat())
  }

  const recordArray = Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  const attemptRecord: IWordStats['attemptRecord'] = recordArray.map(([date, day]) => ({
    date,
    count: day.attempts,
    level: getLevel(day.attempts),
  }))
  const wordRecord: IWordStats['wordRecord'] = recordArray.map(([date, day]) => {
    const count = new Set(day.words.map((word) => word.normalize('NFKC').toLocaleLowerCase())).size
    return { date, count, level: getLevel(count) }
  })
  const typingPaceRecord: IWordStats['typingPaceRecord'] = recordArray
    .filter(([, day]) => day.activeTypingMs > 0)
    .map<[string, number]>(([date, day]) => [
      date,
      Math.round(day.attempts / (day.activeTypingMs / 60_000)),
    ])
  const accuracyRecord: IWordStats['accuracyRecord'] = recordArray
    .filter(([, day]) => day.correctCharacters + day.wrongCount > 0)
    .map<[string, number]>(([date, day]) => [date, inputAccuracy(day.correctCharacters, day.wrongCount) ?? 0])

  const wrongCounts = new Map<string, number>()
  for (const [, day] of recordArray) {
    for (const rawKey of day.wrongKeys) {
      const key = rawKey.toUpperCase()
      wrongCounts.set(key, (wrongCounts.get(key) ?? 0) + 1)
    }
  }
  const wrongTimeRecord = Array.from(wrongCounts, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))

  const recentCutoff = endMs - 7 * 86_400_000
  const recent = records.filter((record) => record.occurredAt >= recentCutoff && record.occurredAt <= endMs)
  const recentWords = new Set(recent.map((record) => `${record.dict}:${record.word.normalize('NFKC').toLocaleLowerCase()}`))
  const recentCharacters = recent.reduce((total, record) => total + Array.from(record.word).length, 0)
  const recentWrong = recent.reduce((total, record) => total + record.wrongCount, 0)

  return {
    isEmpty: false,
    attemptRecord,
    wordRecord,
    typingPaceRecord,
    accuracyRecord,
    wrongTimeRecord,
    legacyAttempts,
    recent7: {
      attempts: recent.length,
      distinctWords: recentWords.size,
      inputAccuracy: inputAccuracy(recentCharacters, recentWrong),
    },
  }
}
