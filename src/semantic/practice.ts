import { CHAPTER_LENGTH } from '@/constants'
import type { LearningEventRecord, WordAttemptedPayload } from '@/learning/types'
import { parseSemanticPayload, semanticKey } from './core'
import type { SemanticItem } from './core'
import { buildSemanticDiscriminationQuestions, parseSemanticDiscriminationPayload } from './discrimination'
import { filterUnambiguousProductionWords, parseSemanticProductionPayload } from './production'
import { semanticItem } from './provider'
import type { SemanticRun } from './run'
import { createSmartSessionId } from '@/smart-session/runtime'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import type { Word } from '@/typings'
import { db } from '@/utils/db'

export type PracticeMode = 'spelling' | 'recall' | 'discrimination' | 'production'
export type PracticePool = 'chapter' | 'learned' | 'errors' | 'uncertain'
const wordKey = (word: string) => word.normalize('NFKC').trim().toLowerCase()

/** Latest observations per measurement, never a blended mastery score. No evidence is not weakness. */
export function selectPracticeWords(words: readonly Word[], events: readonly LearningEventRecord[], dictionaryId: string,
  chapter: number, pool: PracticePool, mode: PracticeMode, now = Date.now()) {
  const spelling = new Map<string, { time: number; wrongCount: number }>()
  const recall = new Map<string, { time: number; uncertain: boolean; version: string }>()
  const recognition = new Map<string, { time: number; uncertain: boolean; version: string }>()
  const production = new Map<string, { time: number; uncertain: boolean; version: string }>()
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
      } else if (event.eventType === 'semantic_production_attempted') {
        const p = parseSemanticProductionPayload(event.payload)
        if (p.dictionaryId !== dictionaryId) continue
        const key = `${semanticKey(dictionaryId, p.word)}@${p.contentVersion}`
        if (!production.has(key)) production.set(key, { time: event.occurredAt, uncertain: !p.isCorrect, version: p.contentVersion })
      }
    } catch { /* Malformed/imported observations cannot manufacture a weak word. */ }
  }
  const unique = Array.from(new Map(words.map((word) => [wordKey(word.name), word])).values())
  const uncertainWords = new Set<string>()
  const lastSemantic = new Map<string, number>()
  for (const [key, value] of [...Array.from(recall), ...Array.from(recognition), ...Array.from(production)]) {
    const contentKey = key.slice(0, key.lastIndexOf('@'))
    if (value.uncertain && value.time >= now - 14 * 86400000) uncertainWords.add(contentKey)
  }
  const modeEvidence = mode === 'recall' ? recall : mode === 'discrimination' ? recognition : mode === 'production' ? production : undefined
  if (modeEvidence) {
    for (const [key, value] of Array.from(modeEvidence)) {
      const contentKey = key.slice(0, key.lastIndexOf('@'))
      lastSemantic.set(contentKey, Math.max(lastSemantic.get(contentKey) ?? 0, value.time))
    }
  }
  const rawCandidates = pool === 'chapter' ? words.slice(chapter * CHAPTER_LENGTH, (chapter + 1) * CHAPTER_LENGTH)
    : unique.filter((word) => {
      const attempt = spelling.get(wordKey(word.name))
      if (pool === 'learned') return Boolean(attempt)
      if (pool === 'errors') return Boolean(attempt && attempt.wrongCount > 0 && attempt.time >= now - 14 * 86400000)
      return uncertainWords.has(semanticKey(dictionaryId, word.name))
    })
  const candidates = mode === 'production' ? filterUnambiguousProductionWords(rawCandidates, words) : rawCandidates
  return { candidates: [...candidates].sort((a, b) => {
    // Least recently trained first. Selection is bounded later; repeated small bouts can cover the whole pool.
    const last = (word: Word) => mode === 'spelling' ? spelling.get(wordKey(word.name))?.time ?? 0
      : lastSemantic.get(semanticKey(dictionaryId, word.name)) ?? 0
    return last(a) - last(b) || wordKey(a.name).localeCompare(wordKey(b.name))
  }), recall, recognition, production }
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
      const production = uncertain.production.get(key)
      if (
        !(recall?.uncertain && recall.time >= cutoff) &&
        !(recognition?.uncertain && recognition.time >= cutoff) &&
        !(production?.uncertain && production.time >= cutoff)
      ) continue
    }
    items.push(item)
    if (items.length >= limit) break
  }
  return items
}

/** Keep cues in the requested pool; borrow only versioned references from the same wordbook.
 * Inspect at most 120 words, wrapping at a short final chapter; never hash a whole large dictionary.
 */
export async function preparePracticeReferences(items: SemanticItem[], words: readonly Word[], dictionaryId: string, chapter: number) {
  const references = new Map(items.map((item) => [item.contentId, item]))
  const start = chapter * CHAPTER_LENGTH
  for (let offset = 0; offset < Math.min(words.length, 120); offset += 1) {
    const word = words[(start + offset) % words.length]
    if (references.has(semanticKey(dictionaryId, word.name))) continue
    const item = await semanticItem(dictionaryId, word)
    if (item) references.set(item.contentId, item)
  }
  return Array.from(references.values())
}

export async function createManualSemanticRun(dictionaryId: string, mode: 'recall' | 'discrimination' | 'production', items: SemanticItem[],
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

export const semanticRunPath = (run: SemanticRun) => `/${
  run.mode === 'discrimination' ? 'semantic-check' : run.mode === 'production' ? 'semantic-production' : 'semantic'
}/${encodeURIComponent(run.id)}`
