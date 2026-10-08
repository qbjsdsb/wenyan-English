import { RadioGroup } from '@headlessui/react'
import { useCallback } from 'react'

type Props = {
  tagList: string[]
  currentTag: string
  onChangeCurrentTag: (tag: string) => void
}

export default function DictTagSwitcher({ tagList, currentTag, onChangeCurrentTag }: Props) {
  const onChangeTag = useCallback(
    (tag: string) => {
      onChangeCurrentTag(tag)
    },
    [onChangeCurrentTag],
  )

  return (
    <RadioGroup value={currentTag} onChange={onChangeTag}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {tagList.map((option) => (
          <RadioGroup.Option key={option} value={option} className="cursor-pointer focus:outline-none">
            {({ checked }) => (
              <span
                className={`${checked ? 'font-medium text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-secondary)] hover:text-[var(--wenyan-ink)]'} relative inline-block pb-1 text-xs transition-colors`}
              >
                {option}
                {checked && <span className="absolute inset-x-1 -bottom-1 h-[1.5px] rounded-full bg-[var(--wenyan-accent)]" />}
              </span>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}
