import type { Word } from '@/typings'

// Only bundled public dictionaries enter this cache; never user answers or credentials.
const CACHE_NAME = 'wenyan-public-dictionaries-v1'
const MAX_DICTIONARIES = 8
const sources = new Map<string, 'network' | 'cache'>()

export function validDictionary(value: unknown): value is Word[] {
  return Array.isArray(value) && value.length > 0 && value.every((word) => word && typeof word.name === 'string' && word.name.trim())
}

function canCache(url: string) {
  return typeof caches !== 'undefined' && url.startsWith(`${import.meta.env.BASE_URL}dicts/`) && !url.includes('..')
}

export function dictionarySource(url: string) { return sources.get(url) }
export function markDictionarySource(url: string, source: 'network' | 'cache') { sources.set(url, source) }

export async function readDictionaryCache(url: string): Promise<Word[] | undefined> {
  if (!canCache(url)) return
  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(url)
    if (!response) return
    const words: unknown = await response.json()
    if (validDictionary(words)) return words
    await cache.delete(url)
  } catch { /* Cache is optional. A broken cache must not block the network path. */ }
}

export async function writeDictionaryCache(url: string, words: Word[]) {
  if (!canCache(url)) return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(url, new Response(JSON.stringify(words), { headers: { 'content-type': 'application/json' } }))
    const keys = await cache.keys()
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DICTIONARIES))) await cache.delete(key)
  } catch { /* Quota or storage denial does not turn a successful download into failure. */ }
}
