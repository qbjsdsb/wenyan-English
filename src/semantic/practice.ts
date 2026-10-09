import { CHAPTER_LENGTH } from '@/constants'
import type { LearningEventRecord, WordAttemptedPayload } from '@/learning/types'
import { parseSemanticPayload, semanticKey } from './core'
import type { SemanticItem } from './core'
import { buildSemanticDiscriminationQuestions, parseSemanticDiscriminationPayload } from './discrimination'
import { semanticItem } from './provider'
import type { SemanticRun } from './run'
import { createSmartSessionId } from '@/smart-session/runtime'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import type { Word } from '@/typings'
import { db } from '@/utils/db'

export type PracticeMode = 'spelling' | 'recall' | 'discrimination'
export type PracticePool = 'chapter' | 'learned' | 'errors' | 'uncertain'
const wordKey = (word: string) => word.normalize('NFKC').trim().toLowerCase()

/** Latest observations per measurement, never a blended mastery score. No evidence is not weakness. */
export function selectPracticeWords(words: readonly Word[], events: readonly LearningEventRecord[], dictionaryId: string,
  chapter: number, pool: PracticePool, mode: PracticeMode, now = Date.now()) {
  const spelling = new Map<string, { time: number; wrongCount: number }>()
  const recall = new Map<string, { time: number; uncertain: boolean; version: string }>()
  const recognition = new Map<string, { time: number; uncertain: boolean; version: string }>()
  const recent = [...events].filter((event) => event.occurredAt <= now).sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
  for (const event of recent) {
    try {
      if (event.eventType === 'word_attempted') {
        const p = event.payload as WordAttemptedPayload
        if (p.dict !== dictionaryId || typeof p.word !== 'string' || !Number.isInteger(p.wrongCount) || p.wrongCount < 0) continue
        const key = wordKey(p.word)
        if (!spelling.has(key)) spelling.set(key, { time: event.occurredAt, wrongCount: p.wrongCount })
      } else if (event.eventType === 'semantic_recall_attempted') {
        const p = parseSemanticPayload(event.payload)
        if (p.dictionaryId !== dictionaryId) continue
        const key = `${semanticKey(dictionaryId, p.word)}@${p.contentVersion}`
        if (!recall.has(key)) recall.set(key, { time: event.occurredAt, uncertain: p.rating !== 'recalled', version: p.contentVersion })
      } else if (event.eventType === 'semantic_discrimination_attempted') {
        const p = parseSemanticDiscriminationPayload(event.payload)
        if (p.dictionaryId !== dictionaryId) continue
        const key = `${semanticKey(dictionaryId, p.word)}@${p.contentVersion}`
        if (!recognition.has(key)) recognition.set(key, { time: event.occurredAt, uncertain: !p.isCorrect, version: p.contentVersion })
      }
    } catch { /* Malformed/imported observations cannot manufacture a weak word. */ }
  }
  const unique = Array.from(new Map(words.map((word) => [wordKey(word.name), word])).values())
  const uncertainWords = new Set<string>()
  const lastSemantic = new Map<string, number>()
  for (const [key, value] of [...Array.from(recall), ...Array.from(recognition)]) {
    const contentKey = key.slice(0, key.lastIndexOf('@'))
    if (value.uncertain && value.time >= now - 14 * 86400000) uncertainWords.add(contentKey)
  }
  for (const [key, value] of Array.from(mode === 'recall' ? recall : recognition)) {
    const contentKey = key.slice(0, key.lastIndexOf('@'))
    lastSemantic.set(contentKey, Math.max(lastSemantic.get(contentKey) ?? 0, value.time))
  }
  const candidates = pool === 'chapter' ? words.slice(chapter * CHAPTER_LENGTH, (chapter + 1) * CHAPTER_LENGTH)
    : unique.filter((word) => {
      const attempt = spelling.get(wordKey(word.name))
      if (pool === 'learned') return Boolean(attempt)
      if (pool === 'errors') return Boolean(attempt && attempt.wrongCount > 0 && attempt.time >= now - 14 * 86400000)
      return uncertainWords.has(semanticKey(dictionaryId, word.name))
    })
  return { candidates: [...candidates].sort((a, b) => {
    // Least recently trained first. Selection is bounded later; repeated small bouts can cover the whole pool.
    const last = (word: Word) => mode === 'spelling' ? spelling.get(wordKey(word.name))?.time ?? 0
      : lastSemantic.get(semanticKey(dictionaryId, word.name)) ?? 0
    return last(a) - last(b) || wordKey(a.name).localeCompare(wordKey(b.name))
  }), recall, recognition }
}

/** Bounded direct run; uses exactly the same atomic facts/cursors as the Smart runner. */
export async function preparePracticeItems(words: readonly Word[], dictionaryId: string, limit: number,
  uncertain?: ReturnType<typeof selectPracticeWords>) {
  const items: SemanticItem[] = []
  for (const word of words) {
    const item = await semanticItem(dictionaryId, word)
    if (!item || items.some((other) => other.contentId === item.contentId)) continue
    if (uncertain) {
      const key = `${item.key}@${item.contentVersion}`
      const cutoff = Date.now() - 14 * 86400000
      const recall = uncertain.recall.get(key)
      const recognition = uncertain.recognition.get(key)
      if (!(recall?.uncertain && recall.time >= cutoff) && !(recognition?.uncertain && recognition.time >= cutoff)) continue
    }
    items.push(item)
    if (items.length >= limit) break
  }
  return items
}

export async function createManualSemanticRun(dictionaryId: string, mode: 'recall' | 'discrimination', items: SemanticItem[],
  referencePool: SemanticItem[], ownerUserId: string | undefined, practiceChoices?: SemanticRun['practiceChoices']) {
  if (getLocalLearningOwnerId() !== ownerUserId) throw new Error('账号已改变，请重新准备练习。')
  if (!items.length || items.length > 12) throw new Error('当前没有可练的词，请换一组。')
  const questions = mode === 'discrimination'
    ? buildSemanticDiscriminationQuestions(referencePool, items.length, items.map((item) => item.contentId)) : undefined
  if (questions && !questions.length) throw new Error('这组词不足以组成四个不同的参考选项。可以改用词义回想。')
  const id = createSmartSessionId()
  const run: SemanticRun = { id, mode, origin: 'manual', ownerUserId, sessionId: id, dictionaryId,
    startedAt: Date.now(), practiceChoices, items, discriminationQuestions: questions, index: 0 }
  await db.semanticRuns.add(run)
  return run
}

export const semanticRunPath = (run: SemanticRun) => `/${run.mode === 'discrimination' ? 'semantic-check' : 'semantic'}/${encodeURIComponent(run.id)}`
