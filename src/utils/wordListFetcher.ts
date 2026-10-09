import { markDictionarySource, readDictionaryCache, validDictionary, writeDictionaryCache } from './dictionaryCache'
import type { Word } from '@/typings'

export async function wordListFetcher(url: string): Promise<Word[]> {
  const resourceUrl = import.meta.env.BASE_URL + url.replace(/^\/+/, '')
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await readDictionaryCache(resourceUrl)
    if (cached) { markDictionarySource(resourceUrl, 'cache'); return cached }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(resourceUrl, { signal: controller.signal })
    if (!response.ok) throw new Error(`词库加载失败（HTTP ${response.status}），请重试。`)
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('词库地址返回了网页，请刷新后重试。')
    }
    let words: unknown
    try {
      words = await response.json()
    } catch {
      throw new Error('词库文件无法读取，请重试或更换词书。')
    }
    if (!validDictionary(words)) {
      throw new Error('词库内容无效或为空，请更换词书。')
    }
    markDictionarySource(resourceUrl, 'network')
    // Best effort; only after schema validation, and never on the typing keystroke path.
    await writeDictionaryCache(resourceUrl, words)
    return words
  } catch (cause) {
    const cached = await readDictionaryCache(resourceUrl)
    if (cached) { markDictionarySource(resourceUrl, 'cache'); return cached }
    if (controller.signal.aborted) throw new Error('词库加载超时，请检查网络后重试。')
    if (cause instanceof TypeError) throw new Error('暂时无法连接词库，请检查网络后重试。')
    throw cause
  } finally {
    clearTimeout(timeout)
  }
}
