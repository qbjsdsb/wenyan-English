import { ignoresStudyKey } from '../../keyboard'
import { wordDictationConfigAtom } from '@/store'
import type { WordDictationType } from '@/typings'
import { Listbox, Popover, Switch, Transition } from '@headlessui/react'
import { useAtom } from 'jotai'
import { Fragment, useLayoutEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IconEyeSlash from '~icons/heroicons/eye-slash-solid'
import IconEye from '~icons/heroicons/eye-solid'
import IconCheck from '~icons/tabler/check'
import IconChevronDown from '~icons/tabler/chevron-down'

const wordDictationTypeList: { name: string; type: WordDictationType }[] = [
  { name: '全部隐藏', type: 'hideAll' },
  { name: '隐藏元音', type: 'hideVowel' },
  { name: '隐藏辅音', type: 'hideConsonant' },
  { name: '随机隐藏', type: 'randomHide' },
]

export default function WordDictationSwitcher() {
  const [wordDictationConfig, setWordDictationConfig] = useAtom(wordDictationConfigAtom)
  const [currentType, setCurrentType] = useState(wordDictationTypeList[0])

  const onToggleWordDictation = () => {
    setWordDictationConfig((old) => (!old.isOpen ? { ...old, isOpen: true, openBy: 'user' } : { ...old, isOpen: false }))
  }

  const onChangeWordDictationType = (value: WordDictationType) => {
    setWordDictationConfig((old) => ({ ...old, type: value }))
  }

  useLayoutEffect(() => {
    setCurrentType(wordDictationTypeList.find((item) => item.type === wordDictationConfig.type) || wordDictationTypeList[0])
  }, [wordDictationConfig.type])

  useHotkeys('ctrl+v', onToggleWordDictation, { ignoreEventWhen: ignoresStudyKey, preventDefault: true }, [])

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${
              open || wordDictationConfig.isOpen ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink-muted)]'
            } grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
            type="button"
            aria-label="开关默写模式"
          >
            {wordDictationConfig.isOpen ? <IconEye className="icon" /> : <IconEyeSlash className="icon" />}
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
              <div className="mb-2 text-[12px] font-semibold text-[var(--wenyan-ink)]">默写模式</div>
              <div className="flex items-center justify-between py-2">
                <span className="wenyan-body text-xs">启用默写</span>
                <Switch checked={wordDictationConfig.isOpen} onChange={onToggleWordDictation} className="switch-root">
                  <span aria-hidden="true" className="switch-thumb" />
                </Switch>
              </div>

              {wordDictationConfig.isOpen && (
                <div className="mt-2 border-t border-[var(--wenyan-line-soft)] pt-3">
                  <span className="wenyan-body mb-2 block text-xs">隐藏方式</span>
                  <Listbox value={currentType.type} onChange={onChangeWordDictationType}>
                    <div className="relative">
                      <Listbox.Button className="listbox-button w-full">
                        <span>{currentType.name}</span>
                        <span>
                          <IconChevronDown className="focus:outline-none" />
                        </span>
                      </Listbox.Button>
                      <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <Listbox.Options className="listbox-options w-full">
                          {wordDictationTypeList.map((item) => (
                            <Listbox.Option key={item.name} value={item.type}>
                              {({ selected }) => (
                                <>
                                  <span>{item.name}</span>
                                  {selected && (
                                    <span className="listbox-options-icon">
                                      <IconCheck className="focus:outline-none" />
                                    </span>
                                  )}
                                </>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </Transition>
                    </div>
                  </Listbox>
                </div>
              )}
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
