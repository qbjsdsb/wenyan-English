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
      <div className="flex flex-wrap items-center gap-2">
        {tagList.map((option) => (
          <RadioGroup.Option
            key={option}
            value={option}
            className={({ checked }) =>
              `cursor-pointer whitespace-nowrap rounded-[var(--wenyan-radius-sm)] px-3 py-1.5 text-xs transition-colors ${
                checked
                  ? 'bg-[var(--wenyan-accent-soft)] font-medium text-[var(--wenyan-accent)]'
                  : 'text-[var(--wenyan-ink-secondary)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]'
              }`
            }
          >
            {option}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}
