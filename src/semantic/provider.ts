import type { SemanticItem } from './core'
import { semanticKey } from './core'
import type { Word } from '@/typings'

/** Version the exact reference used, not the mutable dictionary's ordinal. No content is uploaded. */
export async function semanticItem(dictionaryId: string, word: Word): Promise<SemanticItem | undefined> {
  if (!word.name?.trim() || !Array.isArray(word.trans)) return undefined
  const meanings = word.trans.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
  if (!meanings.length || meanings.length > 30 || meanings.some((x) => x.length > 2000)) return undefined
  const canonical = JSON.stringify({ word: word.name.normalize('NFKC').trim(), meanings })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('')
  const key = semanticKey(dictionaryId, word.name)
  if (key.length > 250 || word.name.length > 300) return undefined
  return { key, contentId: key, contentVersion: `sha256:${hash}`, word: word.name, meanings }
}
