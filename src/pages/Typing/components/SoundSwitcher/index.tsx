import { hintSoundsConfigAtom, keySoundsConfigAtom } from '@/store'
import { Popover, Switch, Transition } from '@headlessui/react'
import { useAtom } from 'jotai'
import { Fragment, useCallback } from 'react'
import IconSpeakerWave from '~icons/heroicons/speaker-wave-solid'

export default function SoundSwitcher() {
  const [keySoundsConfig, setKeySoundsConfig] = useAtom(keySoundsConfigAtom)
  const [hintSoundsConfig, setHintSoundsConfig] = useAtom(hintSoundsConfigAtom)

  const onChangeKeySound = useCallback(
    (checked: boolean) => setKeySoundsConfig((old) => ({ ...old, isOpen: checked })),
    [setKeySoundsConfig],
  )
  const onChangeHintSound = useCallback(
    (checked: boolean) => setHintSoundsConfig((old) => ({ ...old, isOpen: checked })),
    [setHintSoundsConfig],
  )

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${open ? 'bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-muted)]'} grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
            aria-label="音效设置"
            title="音效设置"
          >
            <IconSpeakerWave className="icon" />
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
            <Popover.Panel className="wenyan-surface absolute left-1/2 z-50 mt-2 w-56 -translate-x-1/2 p-4">
              <div className="mb-2 text-[12px] font-semibold text-[var(--wenyan-ink)]">音效</div>
              <div className="divide-y divide-[var(--wenyan-line-soft)]">
                <div className="flex items-center justify-between py-2">
                  <span className="wenyan-body text-xs">按键音</span>
                  <Switch checked={keySoundsConfig.isOpen} onChange={onChangeKeySound} className="switch-root">
                    <span aria-hidden="true" className="switch-thumb" />
                  </Switch>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="wenyan-body text-xs">提示音</span>
                  <Switch checked={hintSoundsConfig.isOpen} onChange={onChangeHintSound} className="switch-root">
                    <span aria-hidden="true" className="switch-thumb" />
                  </Switch>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
