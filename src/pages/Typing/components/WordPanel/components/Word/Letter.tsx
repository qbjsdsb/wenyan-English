import { EXPLICIT_SPACE } from '@/constants'
import { fontSizeConfigAtom } from '@/store'
import { useAtomValue } from 'jotai'
import React from 'react'

export type LetterState = 'normal' | 'correct' | 'wrong'

const stateClassNameMap: Record<string, Record<LetterState, string>> = {
  true: {
    normal: 'text-[var(--wenyan-ink-muted)]',
    correct: 'text-[var(--wenyan-success)]',
    wrong: 'text-[var(--wenyan-danger)]',
  },
  false: {
    normal: 'text-[var(--wenyan-ink-secondary)]',
    correct: 'text-[var(--wenyan-success)]',
    wrong: 'text-[var(--wenyan-danger)]',
  },
}

export type LetterProps = {
  letter: string
  state?: LetterState
  visible?: boolean
}

const Letter: React.FC<LetterProps> = ({ letter, state = 'normal', visible = true }) => {
  const fontSizeConfig = useAtomValue(fontSizeConfigAtom)
  return (
    <span
      className={`m-0 p-0 font-mono font-medium ${
        stateClassNameMap[(letter === EXPLICIT_SPACE) as unknown as string][state]
      } pr-0.8 duration-0`}
      style={{ fontSize: fontSizeConfig.foreignFont.toString() + 'px' }}
    >
      {visible ? letter : '_'}
    </span>
  )
}

export default React.memo(Letter)
