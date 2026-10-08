import { LANG_PRON_MAP } from '@/resources/soundResource'
import { currentDictInfoAtom, phoneticConfigAtom, pronunciationConfigAtom } from '@/store'
import type { PronunciationType } from '@/typings'
import { PRONUNCIATION_PHONETIC_MAP } from '@/typings'
import { CTRL } from '@/utils'
import { Listbox, Popover, Switch, Transition } from '@headlessui/react'
import { useAtom, useAtomValue } from 'jotai'
import { Fragment, useCallback, useEffect, useMemo } from 'react'
import IconCheck from '~icons/tabler/check'
import IconChevronDown from '~icons/tabler/chevron-down'

const rowClass = 'flex items-center justify-between gap-4 py-2'

const PronunciationSwitcher = () => {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const [pronunciationConfig, setPronunciationConfig] = useAtom(pronunciationConfigAtom)
  const [phoneticConfig, setPhoneticConfig] = useAtom(phoneticConfigAtom)
  const pronunciationList = useMemo(() => LANG_PRON_MAP[currentDictInfo.language].pronunciation, [currentDictInfo.language])

  useEffect(() => {
    const defaultPronIndex = currentDictInfo.defaultPronIndex || LANG_PRON_MAP[currentDictInfo.language].defaultPronIndex
    const defaultPron = pronunciationList[defaultPronIndex]
    const index = pronunciationList.findIndex((item) => item.pron === pronunciationConfig.type)
    if (index === -1) {
      setPronunciationConfig((old) => ({ ...old, type: defaultPron.pron, name: defaultPron.name }))
    }
  }, [currentDictInfo.defaultPronIndex, currentDictInfo.language, setPronunciationConfig, pronunciationList, pronunciationConfig.type])

  useEffect(() => {
    const phoneticType = PRONUNCIATION_PHONETIC_MAP[pronunciationConfig.type]
    if (phoneticType) setPhoneticConfig((old) => ({ ...old, type: phoneticType }))
  }, [pronunciationConfig.type, setPhoneticConfig])

  const onChangePronunciationIsOpen = useCallback(
    (value: boolean) => setPronunciationConfig((old) => ({ ...old, isOpen: value })),
    [setPronunciationConfig],
  )
  const onChangePronunciationIsTransRead = useCallback(
    (value: boolean) => setPronunciationConfig((old) => ({ ...old, isTransRead: value })),
    [setPronunciationConfig],
  )
  const onChangePronunciationIsLoop = useCallback(
    (value: boolean) => setPronunciationConfig((old) => ({ ...old, isLoop: value })),
    [setPronunciationConfig],
  )
  const onChangePhoneticIsOpen = useCallback(
    (value: boolean) => setPhoneticConfig((old) => ({ ...old, isOpen: value })),
    [setPhoneticConfig],
  )
  const onChangePronunciationType = useCallback(
    (value: PronunciationType) => {
      const item = pronunciationList.find((item) => item.pron === value)
      if (item) setPronunciationConfig((old) => ({ ...old, type: item.pron, name: item.name }))
    },
    [setPronunciationConfig, pronunciationList],
  )

  const currentLabel = pronunciationConfig.isOpen ? pronunciationConfig.name : '关闭'

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${open ? 'bg-[var(--wenyan-paper-muted)] text-[var(--wenyan-ink)]' : ''} wenyan-button-secondary min-h-8 !px-2.5 text-xs`}
          >
            {currentLabel}
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
            <Popover.Panel className="wenyan-surface absolute right-0 z-50 mt-2 w-64 p-4">
              <div className="mb-2 text-[12px] font-semibold text-[var(--wenyan-ink)]">发音与音标</div>
              <div className="divide-y divide-[var(--wenyan-line-soft)]">
                <div className={rowClass}>
                  <span className="wenyan-body text-xs">显示音标</span>
                  <Switch checked={phoneticConfig.isOpen} onChange={onChangePhoneticIsOpen} className="switch-root">
                    <span aria-hidden="true" className="switch-thumb" />
                  </Switch>
                </div>
                <div className={rowClass}>
                  <span className="wenyan-body text-xs">单词发音</span>
                  <Switch checked={pronunciationConfig.isOpen} onChange={onChangePronunciationIsOpen} className="switch-root">
                    <span aria-hidden="true" className="switch-thumb" />
                  </Switch>
                </div>
                {window.speechSynthesis && (
                  <div className={rowClass}>
                    <span className="wenyan-body text-xs">释义发音</span>
                    <Switch checked={pronunciationConfig.isTransRead} onChange={onChangePronunciationIsTransRead} className="switch-root">
                      <span aria-hidden="true" className="switch-thumb" />
                    </Switch>
                  </div>
                )}
                {pronunciationConfig.isOpen && (
                  <>
                    <div className={rowClass}>
                      <span className="wenyan-body text-xs">循环发音</span>
                      <Switch checked={pronunciationConfig.isLoop} onChange={onChangePronunciationIsLoop} className="switch-root">
                        <span aria-hidden="true" className="switch-thumb" />
                      </Switch>
                    </div>
                    <div className="py-2">
                      <span className="wenyan-body mb-2 block text-xs">发音口音</span>
                      <Listbox value={pronunciationConfig.type} onChange={onChangePronunciationType}>
                        <div className="relative">
                          <Listbox.Button className="listbox-button w-full">
                            <span>{pronunciationConfig.name}</span>
                            <span><IconChevronDown className="focus:outline-none" /></span>
                          </Listbox.Button>
                          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                            <Listbox.Options className="listbox-options w-full">
                              {pronunciationList.map((item) => (
                                <Listbox.Option key={item.pron} value={item.pron}>
                                  {({ selected }) => (
                                    <>
                                      <span>{item.name}</span>
                                      {selected && (
                                        <span className="listbox-options-icon"><IconCheck className="focus:outline-none" /></span>
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
                  </>
                )}
              </div>
              <p className="wenyan-muted mt-3 text-[10px]">朗读快捷键：{CTRL} + J</p>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}

export default PronunciationSwitcher
