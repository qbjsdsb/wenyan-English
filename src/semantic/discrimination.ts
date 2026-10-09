import type { SemanticItem } from './core'

export interface SemanticDiscriminationOption {
  contentId: string
  contentVersion: string
  meanings: string[]
}

export interface SemanticDiscriminationQuestion {
  contentId: string
  contentVersion: string
  word: string
  options: SemanticDiscriminationOption[]
  correctContentId: string
}

export interface SemanticDiscriminationPayload {
  domain: 'english'
  activity: 'semantic_discrimination'
  measurement: 'reference_meaning_discrimination'
  direction: 'en_to_meaning'
  contentId: string
  contentVersion: string
  dictionaryId: string
  word: string
  sessionId: string
  blockId: string
  cue: 'word_only'
  responseMode: 'single_choice'
  options: Array<{ contentId: string; contentVersion: string }>
  selectedContentId: string
  correctContentId: string
  isCorrect: boolean
}

export interface SemanticDiscriminationFact {
  id: string
  occurredAt: number
  payload: SemanticDiscriminationPayload
}

function meaningSignature(item: SemanticItem) {
  return item.meanings
    .map((value) => value.normalize('NFKC').trim().toLocaleLowerCase())
    .filter(Boolean)
    .join('\u241f')
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Build deterministic four-option questions from exact versioned dictionary references.
 * This measures reference discrimination only; it is not a free-recall or mastery score.
 */
export function buildSemanticDiscriminationQuestions(items: readonly SemanticItem[], limit = 6): SemanticDiscriminationQuestion[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error('invalid_semantic_discrimination_limit')

  const bySignature = new Map<string, SemanticItem>()
  for (const item of [...items].sort((a, b) => a.contentId.localeCompare(b.contentId))) {
    const signature = meaningSignature(item)
    if (!item.contentId || !/^sha256:[a-f0-9]{64}$/.test(item.contentVersion) || !item.word.trim() || !signature) continue
    if (!bySignature.has(signature)) bySignature.set(signature, item)
  }
  const pool = Array.from(bySignature.values())
  if (pool.length < 4) return []

  return pool.slice(0, limit).map((cue) => {
    const distractors = pool
      .filter((item) => item.contentId !== cue.contentId)
      .sort((a, b) => stableHash(`${cue.contentVersion}:${a.contentId}`) - stableHash(`${cue.contentVersion}:${b.contentId}`)
        || a.contentId.localeCompare(b.contentId))
      .slice(0, 3)
    if (distractors.length !== 3) throw new Error('insufficient_semantic_discrimination_options')
    const options = [cue, ...distractors]
      .sort((a, b) => stableHash(`option:${cue.contentId}:${a.contentId}`) - stableHash(`option:${cue.contentId}:${b.contentId}`)
        || a.contentId.localeCompare(b.contentId))
      .map((item) => ({ contentId: item.contentId, contentVersion: item.contentVersion, meanings: [...item.meanings] }))
    return {
      contentId: cue.contentId,
      contentVersion: cue.contentVersion,
      word: cue.word,
      options,
      correctContentId: cue.contentId,
    }
  })
}

export function parseSemanticDiscriminationPayload(value: unknown): SemanticDiscriminationPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_semantic_discrimination_fact')
  const payload = value as SemanticDiscriminationPayload
  if (payload.domain !== 'english' || payload.activity !== 'semantic_discrimination'
    || payload.measurement !== 'reference_meaning_discrimination' || payload.direction !== 'en_to_meaning'
    || payload.cue !== 'word_only' || payload.responseMode !== 'single_choice' || typeof payload.isCorrect !== 'boolean') {
    throw new Error('invalid_semantic_discrimination_measurement')
  }
  for (const field of ['contentId', 'contentVersion', 'dictionaryId', 'word', 'sessionId', 'blockId', 'selectedContentId', 'correctContentId'] as const) {
    if (typeof payload[field] !== 'string' || !payload[field].trim() || payload[field].length > 300) {
      throw new Error('invalid_semantic_discrimination_identity')
    }
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(payload.contentVersion)) throw new Error('invalid_semantic_discrimination_version')
  if (!Array.isArray(payload.options) || payload.options.length !== 4) throw new Error('invalid_semantic_discrimination_options')
  const seen = new Set<string>()
  const options = payload.options.map((option) => {
    if (!option || typeof option !== 'object' || typeof option.contentId !== 'string' || !option.contentId.trim()
      || typeof option.contentVersion !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(option.contentVersion)) {
      throw new Error('invalid_semantic_discrimination_option')
    }
    if (seen.has(option.contentId)) throw new Error('duplicate_semantic_discrimination_option')
    seen.add(option.contentId)
    return { contentId: option.contentId, contentVersion: option.contentVersion }
  })
  if (!seen.has(payload.correctContentId) || !seen.has(payload.selectedContentId)) throw new Error('semantic_discrimination_selection_outside_options')
  if (payload.correctContentId !== payload.contentId) throw new Error('semantic_discrimination_correct_reference_mismatch')
  if (payload.isCorrect !== (payload.selectedContentId === payload.correctContentId)) throw new Error('semantic_discrimination_score_mismatch')

  return {
    domain: 'english', activity: 'semantic_discrimination', measurement: 'reference_meaning_discrimination', direction: 'en_to_meaning',
    contentId: payload.contentId, contentVersion: payload.contentVersion, dictionaryId: payload.dictionaryId, word: payload.word,
    sessionId: payload.sessionId, blockId: payload.blockId, cue: 'word_only', responseMode: 'single_choice', options,
    selectedContentId: payload.selectedContentId, correctContentId: payload.correctContentId, isCorrect: payload.isCorrect,
  }
}

/** Objective scoring against the presented versioned references, not a semantic mastery estimate. */
export function buildSemanticDiscriminationEvidence(facts: readonly SemanticDiscriminationFact[], now: number) {
  const unique = new Map<string, SemanticDiscriminationFact>()
  let excluded = 0
  for (const fact of facts) {
    try {
      const payload = parseSemanticDiscriminationPayload(fact.payload)
      if (!fact.id || !Number.isFinite(fact.occurredAt) || fact.occurredAt < 0 || fact.occurredAt > now) throw new Error('invalid_time')
      const previous = unique.get(fact.id)
      if (previous && JSON.stringify(previous) !== JSON.stringify({ ...fact, payload })) throw new Error('conflicting_fact')
      unique.set(fact.id, { ...fact, payload })
    } catch { excluded += 1 }
  }
  const recent = Array.from(unique.values())
    .filter((fact) => fact.occurredAt >= now - 14 * 86_400_000)
    .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
  const latest = new Map<string, SemanticDiscriminationFact>()
  for (const fact of recent) {
    const key = `${fact.payload.contentId}@${fact.payload.contentVersion}`
    if (!latest.has(key)) latest.set(key, fact)
  }
  const correct = recent.filter((fact) => fact.payload.isCorrect).length
  return {
    algorithmVersion: 'semantic-discrimination-evidence-v1',
    window: { from: now - 14 * 86_400_000, through: now },
    measurement: 'reference_meaning_discrimination',
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
    interpretation: 'Objectively scored selection of the current dictionary reference among four presented references. Not free recall, not contextual comprehension, not production ability, and not semantic mastery. No observation means unknown.',
  }
}
