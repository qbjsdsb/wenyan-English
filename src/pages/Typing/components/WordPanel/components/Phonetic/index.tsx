import { isTextSelectableAtom, phoneticConfigAtom } from '@/store'
import type { Word, WordWithIndex } from '@/typings'
import { useAtomValue } from 'jotai'

export type PhoneticProps = {
  word: WordWithIndex | Word
}

function Phonetic({ word }: PhoneticProps) {
  const phoneticConfig = useAtomValue(phoneticConfigAtom)
  const isTextSelectable = useAtomValue(isTextSelectableAtom)

  return (
    <div
      className={`mt-1 space-x-5 text-center text-[13px] font-normal tracking-[0.01em] text-[var(--wenyan-ink-muted)] transition-colors duration-200 ${
        isTextSelectable && 'select-text'
      }`}
    >
      {phoneticConfig.type === 'us' && word.usphone && word.usphone.length > 1 && <span>{`AmE · /${word.usphone}/`}</span>}
      {phoneticConfig.type === 'uk' && word.ukphone && word.ukphone.length > 1 && <span>{`BrE · /${word.ukphone}/`}</span>}
    </div>
  )
}

export default Phonetic
