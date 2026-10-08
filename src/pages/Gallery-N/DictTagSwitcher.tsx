import { RadioGroup } from '@headlessui/react'
import { useCallback } from 'react'

type Props = {
  tagList: string[]
  currentTag: string
  onChangeCurrentTag: (tag: string) => void
  vertical?: boolean
}

export default function DictTagSwitcher({ tagList, currentTag, onChangeCurrentTag, vertical = false }: Props) {
  const onChangeTag = useCallback(
    (tag: string) => {
      onChangeCurrentTag(tag)
    },
    [onChangeCurrentTag],
  )

  return (
    <RadioGroup value={currentTag} onChange={onChangeTag}>
      <div className={vertical ? 'wenyan-library-tags' : 'flex flex-wrap items-center gap-x-5 gap-y-2'}>
        {tagList.map((option) => (
          <RadioGroup.Option key={option} value={option} className="cursor-pointer focus:outline-none">
            {({ checked }) => (
              vertical ? (
                <span
                  className={`${
                    checked
                      ? 'bg-[var(--wenyan-accent-soft)] font-medium text-[var(--wenyan-accent)]'
                      : 'text-[var(--wenyan-ink-secondary)] hover:bg-[color-mix(in_srgb,var(--wenyan-paper-raised)_52%,transparent)] hover:text-[var(--wenyan-ink)]'
                  } block rounded-[var(--wenyan-radius-sm)] px-3 py-2 text-[12px] transition-colors`}
                >
                  {option}
                </span>
              ) : (
                <span
                  className={`${checked ? 'font-medium text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-secondary)] hover:text-[var(--wenyan-ink)]'} relative inline-block pb-1 text-xs transition-colors`}
                >
                  {option}
                  {checked && <span className="absolute inset-x-1 -bottom-1 h-[1.5px] rounded-full bg-[var(--wenyan-accent)]" />}
                </span>
              )
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}
