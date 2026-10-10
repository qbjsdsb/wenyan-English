import type { Dictionary, Word } from '@/typings'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useMemo } from 'react'
import useSWR from 'swr'

export default function useGetWord(name: string, dict?: Dictionary) {
  const { data: wordList, error, isLoading } = useSWR(dict?.url ?? null, wordListFetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  })

  const word: Word | undefined = useMemo(() => {
    if (!wordList) return undefined
    return wordList.find((item) => item.name === name)
  }, [wordList, name])

  const hasError = Boolean(error || !dict || (wordList && !word))
  return { word, isLoading: Boolean(dict && isLoading), hasError }
}
