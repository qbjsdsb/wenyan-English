import type { ActivityKind, SessionConstraints } from './types'
import { idDictionaryMap } from '@/resources/dictionary'
import { supabase } from '@/supabase/client'

export type LearningIntentScope = 'ongoing' | 'day' | 'session'

interface LearningIntentRow {
  scope: LearningIntentScope
  revision: number
  effectiveFrom: number
  expiresAt: number | null
  constraints: SessionConstraints
}

interface CachedLearningIntents {
  schemaVersion: 1
  userId: string
  cachedAt: number
  intents: LearningIntentRow[]
}

export interface ResolvedSmartSessionIntent {
  constraints: SessionConstraints
  source: 'cloud' | 'cached-cloud' | 'local-defaults'
  scopes: { scope: LearningIntentScope; revision: number }[]
  warnings: string[]
  cachedAt?: number
}

const SCOPE_ORDER: LearningIntentScope[] = ['ongoing', 'day', 'session']
const EXECUTABLE_ACTIVITIES: ActivityKind[] = ['vocabulary']
const CACHE_PREFIX = 'wenyanLearningIntentCacheV1:'

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function boundedInteger(value: unknown, max: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined
}

function timestamp(value: unknown, fallback: number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseConstraints(value: unknown, warnings: string[]): SessionConstraints {
  const row = object(value)
  if (!row) return {}
  const result: SessionConstraints = {}

  if (typeof row.focusDictionary === 'string' && row.focusDictionary.trim()) {
    const id = row.focusDictionary.trim()
    const dictionary = idDictionaryMap[id]
    if (dictionary?.language === 'en') result.focusDictionary = id
    else warnings.push('ignored_invalid_focus_dictionary')
  }

  const targetMinutes = boundedInteger(row.targetMinutes, 240)
  if (targetMinutes !== undefined) result.targetMinutes = targetMinutes
  const hardStopMinutes = boundedInteger(row.hardStopMinutes, 240)
  if (hardStopMinutes !== undefined) result.hardStopMinutes = hardStopMinutes
  const newWordCeiling = boundedInteger(row.newWordCeiling, 50)
  if (newWordCeiling !== undefined) result.newWordCeiling = newWordCeiling

  if (row.reviewPreference === 'balanced' || row.reviewPreference === 'review_first') {
    result.reviewPreference = row.reviewPreference
  }
  if (row.intensity === 'gentle' || row.intensity === 'normal') result.intensity = row.intensity

  if (Array.isArray(row.preferredActivities)) {
    const executable = row.preferredActivities.filter(
      (item): item is ActivityKind => typeof item === 'string' && EXECUTABLE_ACTIVITIES.includes(item as ActivityKind),
    )
    if (executable.length > 0) result.preferredActivities = Array.from(new Set(executable))
    if (row.preferredActivities.some((item) => !EXECUTABLE_ACTIVITIES.includes(item as ActivityKind))) {
      warnings.push('deferred_unavailable_preferred_activity')
    }
  }

  return result
}

function parseIntent(value: unknown, warnings: string[]): LearningIntentRow | undefined {
  const row = object(value)
  if (!row || !SCOPE_ORDER.includes(row.scope as LearningIntentScope)) {
    warnings.push('ignored_invalid_intent_scope')
    return undefined
  }
  if (typeof row.revision !== 'number' || !Number.isInteger(row.revision) || row.revision < 1) {
    warnings.push('ignored_invalid_intent_revision')
    return undefined
  }

  const effectiveFrom = timestamp(row.effectiveFrom, 0)
  const expiresAt = row.expiresAt === null || row.expiresAt === undefined ? null : timestamp(row.expiresAt, Number.NaN)
  if (effectiveFrom === null || !Number.isFinite(effectiveFrom) || (expiresAt !== null && !Number.isFinite(expiresAt))) {
    warnings.push('ignored_invalid_intent_time')
    return undefined
  }

  return {
    scope: row.scope as LearningIntentScope,
    revision: row.revision,
    effectiveFrom,
    expiresAt,
    constraints: parseConstraints(row.constraints, warnings),
  }
}

function activeIntents(value: unknown, now: number, warnings: string[]) {
  return (Array.isArray(value) ? value : [])
    .map((item) => parseIntent(item, warnings))
    .filter((item): item is LearningIntentRow => Boolean(item))
    .filter((item) => item.effectiveFrom <= now && (item.expiresAt === null || now < item.expiresAt))
}

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`
}

function readCachedIntents(userId: string): CachedLearningIntents | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(userId)) ?? 'null') as CachedLearningIntents | null
    if (!parsed || parsed.schemaVersion !== 1 || parsed.userId !== userId || !Number.isFinite(parsed.cachedAt) || !Array.isArray(parsed.intents)) {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

function writeCachedIntents(userId: string, value: unknown, now = Date.now()) {
  if (typeof window === 'undefined') return
  const warnings: string[] = []
  const intents = (Array.isArray(value) ? value : [])
    .map((item) => parseIntent(item, warnings))
    .filter((item): item is LearningIntentRow => Boolean(item))

  try {
    const envelope: CachedLearningIntents = { schemaVersion: 1, userId, cachedAt: now, intents }
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(envelope))
  } catch {
    // The cache improves continuity, but storage failure must never block learning.
  }
}

export function mergeActiveLearningIntents(
  value: unknown,
  fallbackDictionary: string,
  now = Date.now(),
  source: 'cloud' | 'cached-cloud' = 'cloud',
): ResolvedSmartSessionIntent {
  const warnings: string[] = []
  const parsed = activeIntents(value, now, warnings).sort(
    (a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope),
  )

  const byScope = new Map<LearningIntentScope, LearningIntentRow>()
  for (const intent of parsed) byScope.set(intent.scope, intent)

  let constraints: SessionConstraints = { focusDictionary: fallbackDictionary }
  for (const scope of SCOPE_ORDER) {
    const intent = byScope.get(scope)
    if (intent) constraints = { ...constraints, ...intent.constraints }
  }

  // Smart Session v1 can execute vocabulary only. Never let a future activity
  // preference make today's existing executor unusable.
  constraints = { ...constraints, preferredActivities: ['vocabulary'] }

  return {
    constraints,
    source: parsed.length > 0 ? source : 'local-defaults',
    scopes: SCOPE_ORDER.flatMap((scope) => {
      const intent = byScope.get(scope)
      return intent ? [{ scope, revision: intent.revision }] : []
    }),
    warnings: Array.from(new Set(warnings)),
  }
}

function unavailableWithCache(userId: string, fallbackDictionary: string, now: number) {
  const cached = readCachedIntents(userId)
  if (cached) {
    const resolved = mergeActiveLearningIntents(cached.intents, fallbackDictionary, now, 'cached-cloud')
    if (resolved.source === 'cached-cloud') {
      return {
        ...resolved,
        cachedAt: cached.cachedAt,
        warnings: Array.from(new Set([...resolved.warnings, 'cloud_intent_unavailable', 'using_last_valid_cloud_intent'])),
      }
    }
  }

  const local = mergeActiveLearningIntents([], fallbackDictionary, now)
  return { ...local, warnings: ['cloud_intent_unavailable'] }
}

export async function resolveSmartSessionLearningIntent(fallbackDictionary: string): Promise<ResolvedSmartSessionIntent> {
  const now = Date.now()
  const local = mergeActiveLearningIntents([], fallbackDictionary, now)
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) return local

    const userId = sessionData.session.user.id
    const { data, error } = await supabase.rpc('get_learning_intents')
    if (error) return unavailableWithCache(userId, fallbackDictionary, now)

    writeCachedIntents(userId, data, now)
    return mergeActiveLearningIntents(data, fallbackDictionary, now, 'cloud')
  } catch {
    // Without an authenticated user id we deliberately refuse to reuse another
    // account's cached cloud intent.
    return { ...local, warnings: ['cloud_intent_unavailable'] }
  }
}
