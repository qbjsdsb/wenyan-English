import type { ActivityKind, SessionConstraints } from './types'
import { idDictionaryMap } from '@/resources/dictionary'
import { supabase } from '@/supabase/client'

export type LearningIntentScope = 'ongoing' | 'day' | 'session'

interface LearningIntentRow {
  scope: LearningIntentScope
  revision: number
  constraints: SessionConstraints
}

export interface ResolvedSmartSessionIntent {
  constraints: SessionConstraints
  source: 'cloud' | 'local-defaults'
  scopes: { scope: LearningIntentScope; revision: number }[]
  warnings: string[]
}

const SCOPE_ORDER: LearningIntentScope[] = ['ongoing', 'day', 'session']
const EXECUTABLE_ACTIVITIES: ActivityKind[] = ['vocabulary']

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function boundedInteger(value: unknown, max: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined
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
  return {
    scope: row.scope as LearningIntentScope,
    revision: row.revision,
    constraints: parseConstraints(row.constraints, warnings),
  }
}

export function mergeActiveLearningIntents(value: unknown, fallbackDictionary: string): ResolvedSmartSessionIntent {
  const warnings: string[] = []
  const parsed = (Array.isArray(value) ? value : [])
    .map((item) => parseIntent(item, warnings))
    .filter((item): item is LearningIntentRow => Boolean(item))
    .sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope))

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
    source: parsed.length > 0 ? 'cloud' : 'local-defaults',
    scopes: SCOPE_ORDER.flatMap((scope) => {
      const intent = byScope.get(scope)
      return intent ? [{ scope, revision: intent.revision }] : []
    }),
    warnings: Array.from(new Set(warnings)),
  }
}

export async function resolveSmartSessionLearningIntent(fallbackDictionary: string): Promise<ResolvedSmartSessionIntent> {
  const local = mergeActiveLearningIntents([], fallbackDictionary)
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) return local

    const { data, error } = await supabase.rpc('get_learning_intents')
    if (error) {
      return { ...local, warnings: ['cloud_intent_unavailable'] }
    }
    return mergeActiveLearningIntents(data, fallbackDictionary)
  } catch {
    return { ...local, warnings: ['cloud_intent_unavailable'] }
  }
}
