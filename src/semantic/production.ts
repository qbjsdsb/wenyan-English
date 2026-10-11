import type { SemanticItem } from './core'
import type { Word } from '@/typings'

export interface SemanticProductionPayload {
  domain: 'english'
  activity: 'semantic_production'
  measurement: 'reference_headword_production'
  direction: 'meaning_to_en'
  contentId: string
  contentVersion: string
  dictionaryId: string
  word: string
  sessionId: string
  blockId: string
  cue: 'dictionary_meanings'
  responseMode: 'typed_headword'
  response: string
  normalizedResponse: string
  correctHeadword: string
  isCorrect: boolean
}

export interface SemanticProductionFact {
  id: string
  occurredAt: number
  payload: SemanticProductionPayload
}

function normalizeMeaning(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

/** Stable visible-reference signature; order and duplicate meaning lines do not create false uniqueness. */
export function semanticMeaningSignature(meanings: readonly string[]) {
  return Array.from(new Set(meanings.map(normalizeMeaning).filter(Boolean))).sort().join('\u241f')
}

export function normalizeProductionHeadword(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

/**
 * Objective headword production is only offered when this exact visible meaning set identifies one
 * normalized headword in the current dictionary. This does not claim that synonyms with different
 * dictionary entries would be invalid translations; the task is explicitly reference-headword recall.
 */
export function filterUnambiguousProductionWords(candidates: readonly Word[], dictionaryWords: readonly Word[]) {
  const signatureHeadwords = new Map<string, Set<string>>()
  for (const word of dictionaryWords) {
    if (typeof word.name !== 'string' || !word.name.trim() || !Array.isArray(word.trans)) continue
    const signature = semanticMeaningSignature(word.trans.filter((value): value is string => typeof value === 'string'))
    const headword = normalizeProductionHeadword(word.name)
    if (!signature || !headword) continue
    const set = signatureHeadwords.get(signature) ?? new Set<string>()
    set.add(headword)
    signatureHeadwords.set(signature, set)
  }

  return candidates.filter((word) => {
    if (typeof word.name !== 'string' || !Array.isArray(word.trans)) return false
    const signature = semanticMeaningSignature(word.trans.filter((value): value is string => typeof value === 'string'))
    const expected = normalizeProductionHeadword(word.name)
    const headwords = signatureHeadwords.get(signature)
    return Boolean(signature && expected && headwords?.size === 1 && headwords.has(expected))
  })
}

export function createSemanticProductionPayload(
  item: SemanticItem,
  dictionaryId: string,
  sessionId: string,
  blockId: string,
  response: string,
): SemanticProductionPayload {
  const normalizedResponse = normalizeProductionHeadword(response)
  const correctHeadword = item.word.normalize('NFKC').trim()
  if (!normalizedResponse || response.length > 300 || correctHeadword.length > 300) throw new Error('invalid_semantic_production_response')
  return {
    domain: 'english',
    activity: 'semantic_production',
    measurement: 'reference_headword_production',
    direction: 'meaning_to_en',
    contentId: item.contentId,
    contentVersion: item.contentVersion,
    dictionaryId,
    word: item.word,
    sessionId,
    blockId,
    cue: 'dictionary_meanings',
    responseMode: 'typed_headword',
    response,
    normalizedResponse,
    correctHeadword,
    isCorrect: normalizedResponse === normalizeProductionHeadword(correctHeadword),
  }
}

export function parseSemanticProductionPayload(value: unknown): SemanticProductionPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_semantic_production_fact')
  const payload = value as SemanticProductionPayload
  if (
    payload.domain !== 'english' ||
    payload.activity !== 'semantic_production' ||
    payload.measurement !== 'reference_headword_production' ||
    payload.direction !== 'meaning_to_en' ||
    payload.cue !== 'dictionary_meanings' ||
    payload.responseMode !== 'typed_headword' ||
    typeof payload.isCorrect !== 'boolean'
  ) throw new Error('invalid_semantic_production_measurement')

  for (const field of ['contentId', 'contentVersion', 'dictionaryId', 'word', 'sessionId', 'blockId', 'response', 'normalizedResponse', 'correctHeadword'] as const) {
    if (typeof payload[field] !== 'string' || !payload[field].trim() || payload[field].length > 300) {
      throw new Error('invalid_semantic_production_identity')
    }
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(payload.contentVersion)) throw new Error('invalid_semantic_production_version')
  const normalizedResponse = normalizeProductionHeadword(payload.response)
  if (payload.normalizedResponse !== normalizedResponse) throw new Error('semantic_production_normalization_mismatch')
  if (payload.correctHeadword.normalize('NFKC').trim() !== payload.word.normalize('NFKC').trim()) {
    throw new Error('semantic_production_reference_mismatch')
  }
  const expected = normalizeProductionHeadword(payload.correctHeadword)
  if (payload.isCorrect !== (normalizedResponse === expected)) throw new Error('semantic_production_score_mismatch')

  return {
    domain: 'english',
    activity: 'semantic_production',
    measurement: 'reference_headword_production',
    direction: 'meaning_to_en',
    contentId: payload.contentId,
    contentVersion: payload.contentVersion,
    dictionaryId: payload.dictionaryId,
    word: payload.word,
    sessionId: payload.sessionId,
    blockId: payload.blockId,
    cue: 'dictionary_meanings',
    responseMode: 'typed_headword',
    response: payload.response,
    normalizedResponse,
    correctHeadword: payload.correctHeadword,
    isCorrect: payload.isCorrect,
  }
}

/** Exact reference-headword production from a versioned meaning cue; not general translation or mastery. */
export function buildSemanticProductionEvidence(facts: readonly SemanticProductionFact[], now: number, windowMs = 14 * 86_400_000) {
  const unique = new Map<string, SemanticProductionFact>()
  let excluded = 0
  for (const fact of facts) {
    try {
      const payload = parseSemanticProductionPayload(fact.payload)
      if (!fact.id || !Number.isFinite(fact.occurredAt) || fact.occurredAt < 0 || fact.occurredAt > now) throw new Error('invalid_time')
      const canonical = { ...fact, payload }
      const previous = unique.get(fact.id)
      if (previous && JSON.stringify(previous) !== JSON.stringify(canonical)) throw new Error('conflicting_fact')
      unique.set(fact.id, canonical)
    } catch {
      excluded += 1
    }
  }

  const recent = Array.from(unique.values())
    .filter((fact) => fact.occurredAt >= now - windowMs)
    .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
  const latest = new Map<string, SemanticProductionFact>()
  for (const fact of recent) {
    const key = `${fact.payload.contentId}@${fact.payload.contentVersion}`
    if (!latest.has(key)) latest.set(key, fact)
  }
  const correct = recent.filter((fact) => fact.payload.isCorrect).length

  return {
    algorithmVersion: 'semantic-production-evidence-v1',
    window: { from: now - windowMs, through: now },
    measurement: 'reference_headword_production',
    attempts: recent.length,
    correct,
    incorrect: recent.length - correct,
    distinctVersionedItems: latest.size,
    revisit: Array.from(latest.values()).filter((fact) => !fact.payload.isCorrect).slice(0, 6).map((fact) => ({
      word: fact.payload.word,
      dictionaryId: fact.payload.dictionaryId,
      contentVersion: fact.payload.contentVersion,
      occurredAt: fact.occurredAt,
      evidenceId: fact.id,
    })),
    excluded,
    interpretation: 'Typed the exact current dictionary headword from its versioned dictionary-meaning cue. Not general translation, contextual production, synonym rejection evidence, or semantic mastery. No observation means unknown.',
  }
}
