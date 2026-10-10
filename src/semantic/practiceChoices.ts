import type { PracticeMode, PracticePool } from './practice'

export interface PracticeChoices {
  mode: PracticeMode
  pool: PracticePool
  limit: 6 | 12
}
const defaults: PracticeChoices = { mode: 'recall', pool: 'chapter', limit: 6 }
const key = (owner?: string) => `wenyanPracticeChoices:${owner ?? 'local'}`
export function validPracticeChoices(value: Partial<PracticeChoices> | null | undefined): PracticeChoices {
  return {
    mode: ['spelling', 'recall', 'discrimination'].includes(value?.mode ?? '') ? value!.mode! : defaults.mode,
    pool: ['chapter', 'learned', 'errors', 'uncertain'].includes(value?.pool ?? '') ? value!.pool! : defaults.pool,
    limit: value?.limit === 12 ? 12 : 6,
  }
}
export function readPracticeChoices(owner?: string): PracticeChoices {
  try {
    return validPracticeChoices(JSON.parse(localStorage.getItem(key(owner)) ?? 'null'))
  } catch {
    return defaults
  }
}
export function savePracticeChoices(choices: PracticeChoices, owner?: string) {
  try {
    const serialized = JSON.stringify(choices)
    localStorage.setItem(key(owner), serialized)
    return localStorage.getItem(key(owner)) === serialized
  } catch {
    // Preference persistence failure must never block learning; callers that need
    // durable restore semantics can inspect the boolean result and surface it.
    return false
  }
}
export function practiceReturnPath(mode: PracticeMode, choices?: Partial<PracticeChoices>) {
  const value = validPracticeChoices({ ...choices, mode })
  return `/practice?mode=${value.mode}&pool=${value.pool}&limit=${value.limit}`
}
