/** English semantic self-report is distinct from spelling and objectively scored recognition. */
export type RecallRating = 'recalled' | 'partial' | 'not_recalled'
export interface SemanticPayload {
  domain: 'english'
  activity: 'semantic_recall'
  measurement: 'self_report_after_reveal'
  direction: 'en_to_meaning'
  contentId: string
  contentVersion: string
  dictionaryId: string
  word: string
  sessionId: string
  blockId: string
  cue: 'word_only'
  responseMode: 'mental_recall'
  answerRevealed: true
  /** Refresh after reveal cannot be presented as a fresh unassisted attempt. */
  resumedAfterReveal: boolean
  rating: RecallRating
}
export interface SemanticFact { id: string; occurredAt: number; payload: SemanticPayload }
export interface SemanticItem { contentId: string; contentVersion: string; word: string; meanings: string[]; key: string }
export interface SemanticRun {
  id: string
  ownerUserId?: string
  sessionId: string
  dictionaryId: string
  startedAt: number
  hardStopAt?: number
  items: SemanticItem[]
  index: number
  revealedIndex?: number
  completedAt?: number
}
export const semanticKey = (dictionaryId: string, word: string) => `semantic:${dictionaryId}:${word.normalize('NFKC').trim().toLowerCase()}`

export function parseSemanticPayload(value: unknown): SemanticPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_semantic_fact')
  const p = value as SemanticPayload
  if (p.domain !== 'english' || p.activity !== 'semantic_recall' || p.measurement !== 'self_report_after_reveal'
    || p.direction !== 'en_to_meaning' || p.cue !== 'word_only' || p.responseMode !== 'mental_recall'
    || p.answerRevealed !== true || typeof p.resumedAfterReveal !== 'boolean'
    || !['recalled', 'partial', 'not_recalled'].includes(p.rating)) throw new Error('invalid_semantic_measurement')
  for (const field of ['contentId', 'contentVersion', 'dictionaryId', 'word', 'sessionId', 'blockId'] as const) {
    if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > 300) throw new Error('invalid_semantic_identity')
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(p.contentVersion)) throw new Error('invalid_semantic_version')
  return { domain: p.domain, activity: p.activity, measurement: p.measurement, direction: p.direction,
    contentId: p.contentId, contentVersion: p.contentVersion, dictionaryId: p.dictionaryId, word: p.word,
    sessionId: p.sessionId, blockId: p.blockId, cue: p.cue, responseMode: p.responseMode,
    answerRevealed: true, resumedAfterReveal: p.resumedAfterReveal, rating: p.rating }
}

/** Bounded descriptive evidence. A self-rating is an observed report, not verified correctness. */
export function buildSemanticEvidence(facts: readonly SemanticFact[], now: number) {
  const unique = new Map<string, SemanticFact>()
  let excluded = 0
  for (const fact of facts) {
    try {
      const payload = parseSemanticPayload(fact.payload)
      if (!fact.id || !Number.isFinite(fact.occurredAt) || fact.occurredAt < 0 || fact.occurredAt > now) throw new Error('invalid_time')
      const previous = unique.get(fact.id)
      if (previous && JSON.stringify(previous) !== JSON.stringify({ ...fact, payload })) throw new Error('conflicting_fact')
      unique.set(fact.id, { ...fact, payload })
    } catch { excluded++ }
  }
  const recent = [...unique.values()].filter((f) => f.occurredAt >= now - 14 * 86400000)
    .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
  const latest = new Map<string, SemanticFact>()
  for (const f of recent) {
    const key = `${f.payload.contentId}@${f.payload.contentVersion}`
    if (!latest.has(key)) latest.set(key, f)
  }
  return {
    algorithmVersion: 'semantic-evidence-v1', window: { from: now - 14 * 86400000, through: now },
    measurement: 'self_report_after_reveal', attempts: recent.length, distinctVersionedItems: latest.size,
    selfReported: { recalled: recent.filter((f) => f.payload.rating === 'recalled').length,
      partial: recent.filter((f) => f.payload.rating === 'partial').length,
      notRecalled: recent.filter((f) => f.payload.rating === 'not_recalled').length },
    resumedAfterReveal: recent.filter((f) => f.payload.resumedAfterReveal).length,
    revisit: [...latest.values()].filter((f) => f.payload.rating !== 'recalled').slice(0, 6).map((f) => ({
      word: f.payload.word, dictionaryId: f.payload.dictionaryId, contentVersion: f.payload.contentVersion,
      selfReport: f.payload.rating, occurredAt: f.occurredAt, evidenceId: f.id,
    })),
    excluded, interpretation: 'Self-reported word-to-meaning recall after checking a dictionary reference. Not objectively scored, not contextual comprehension, not mastery. No observation means unknown.',
  }
}
