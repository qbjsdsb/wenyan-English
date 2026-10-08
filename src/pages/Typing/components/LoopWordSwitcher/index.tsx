import { loopWordConfigAtom } from '@/store'
import type { LoopWordTimesOption } from '@/typings'
import { Popover, Transition } from '@headlessui/react'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { useAtom } from 'jotai'
import { Fragment, useCallback } from 'react'
import IconRepeat from '~icons/tabler/repeat'
import IconRepeatOff from '~icons/tabler/repeat-off'

const loopOptions: LoopWordTimesOption[] = [1, 3, 5, 8, Number.MAX_SAFE_INTEGER]

export default function LoopWordSwitcher() {
  const [{ times: loopTimes }, setLoopWordConfig] = useAtom(loopWordConfigAtom)

  const onChangeLoopTimes = useCallback(
    (value: number) => {
      setLoopWordConfig((old) => ({ ...old, times: value }))
    },
    [setLoopWordConfig],
  )

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${open || loopTimes !== 1 ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink-muted)]'} grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
            type="button"
            aria-label="选择单词循环次数"
          >
            <div className="relative">
              {loopTimes === 1 ? (
                <IconRepeatOff className="icon" />
              ) : (
                <>
                  <IconRepeat className="icon" />
                  {loopTimes !== Number.MAX_SAFE_INTEGER && (
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.65] font-mono text-[9px] font-semibold">
                      {loopTimes}
                    </span>
                  )}
                </>
              )}
            </div>
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="wenyan-surface absolute left-1/2 z-50 mt-2 w-52 -translate-x-1/2 p-4">
              <div className="mb-3 text-[12px] font-semibold text-[var(--wenyan-ink)]">单词循环</div>
              <RadioGroup.Root
                className="flex flex-col gap-1"
                value={loopTimes.toString()}
                onValueChange={(value) => onChangeLoopTimes(Number(value))}
                aria-label="选择单词的循环次数"
              >
                {loopOptions.map((value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center justify-between rounded-[var(--wenyan-radius-sm)] px-2 py-2 text-xs text-[var(--wenyan-ink-secondary)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
                  >
                    <span>{value === Number.MAX_SAFE_INTEGER ? '无限循环' : `${value} 次`}</span>
                    <RadioGroup.Item
                      className="grid h-4 w-4 place-items-center rounded-full border border-[var(--wenyan-line)] bg-[var(--wenyan-paper-raised)] outline-none data-[state=checked]:border-[var(--wenyan-accent)]"
                      value={value.toString()}
                    >
                      <RadioGroup.Indicator className="h-2 w-2 rounded-full bg-[var(--wenyan-accent)]" />
                    </RadioGroup.Item>
                  </label>
                ))}
              </RadioGroup.Root>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
