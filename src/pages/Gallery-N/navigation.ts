import type { PracticeMode, PracticePool } from '@/semantic/practice'
import { practiceReturnPath, validPracticeChoices } from '@/semantic/practiceChoices'

/** Only the known practice destination may override the ordinary spelling return. */
export function galleryReturnPath(search: string) {
  const params = new URLSearchParams(search)
  if (params.get('from') !== 'practice') return '/'
  const choices = validPracticeChoices({
    mode: params.get('mode') as PracticeMode,
    pool: params.get('pool') as PracticePool,
    limit: params.get('limit') === '12' ? 12 : 6,
  })
  return practiceReturnPath(choices.mode, choices)
}
