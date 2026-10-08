import { GalleryContext } from '.'
import type { LanguageCategoryType } from '@/typings'
import { RadioGroup } from '@headlessui/react'
import { useCallback, useContext } from 'react'

export type LanguageTabOption = {
  id: LanguageCategoryType
  name: string
}

const options: LanguageTabOption[] = [
  { id: 'en', name: '英语' },
  { id: 'ja', name: '日语' },
  { id: 'de', name: '德语' },
  { id: 'kk', name: '哈萨克语' },
  { id: 'id', name: '印尼语' },
  { id: 'code', name: 'Code' },
]

export function LanguageTabSwitcher() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state, setState } = useContext(GalleryContext)!

  const onChangeTab = useCallback(
    (tab: string) => {
      setState((draft) => {
        draft.currentLanguageTab = tab as LanguageCategoryType
      })
    },
    [setState],
  )

  return (
    <RadioGroup value={state.currentLanguageTab} onChange={onChangeTab}>
      <div className="flex items-center gap-5">
        {options.map((option) => (
          <RadioGroup.Option key={option.id} value={option.id} className="cursor-pointer focus:outline-none">
            {({ checked }) => (
              <div className={`relative pb-2 text-[13px] font-medium ${checked ? 'text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-secondary)] hover:text-[var(--wenyan-ink)]'}`}>
                {option.name}
                {checked && <span className="absolute inset-x-1 -bottom-[13px] h-[2px] rounded-full bg-[var(--wenyan-accent)]" />}
              </div>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}
