import styles from './index.module.css'
import { keySoundResources } from '@/resources/soundResource'
import { hintSoundsConfigAtom, keySoundsConfigAtom, pronunciationConfigAtom } from '@/store'
import type { SoundResource } from '@/typings'
import { toFixedNumber } from '@/utils'
import { playKeySoundResource } from '@/utils/sounds/keySounds'
import { Listbox, Switch, Transition } from '@headlessui/react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Slider from '@radix-ui/react-slider'
import { useAtom } from 'jotai'
import { Fragment, useCallback } from 'react'
import IconCheck from '~icons/tabler/check'
import IconChevronDown from '~icons/tabler/chevron-down'
import IconEar from '~icons/tabler/ear'

function SettingSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <div className={styles.switchBlock}>
      <Switch checked={checked} onChange={onChange} className="switch-root" aria-label={label}>
        <span aria-hidden="true" className="switch-thumb" />
      </Switch>
      <span className="wenyan-setting-state">{checked ? '开启' : '关闭'}</span>
    </div>
  )
}

function SliderRow({
  label,
  value,
  display,
  min = 0,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string
  value: number
  display: string
  min?: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: [number]) => void
}) {
  return (
    <div className={styles.block}>
      <div className="flex w-full items-center justify-between">
        <span className={styles.blockLabel}>{label}</span>
        <span className="wenyan-setting-state">{display}</span>
      </div>
      <Slider.Root value={[value]} min={min} max={max} step={step} className="slider" onValueChange={onChange} disabled={disabled}>
        <Slider.Track><Slider.Range /></Slider.Track>
        <Slider.Thumb aria-label={label} />
      </Slider.Root>
    </div>
  )
}

export default function SoundSetting() {
  const [pronunciationConfig, setPronunciationConfig] = useAtom(pronunciationConfigAtom)
  const [keySoundsConfig, setKeySoundsConfig] = useAtom(keySoundsConfigAtom)
  const [hintSoundsConfig, setHintSoundsConfig] = useAtom(hintSoundsConfigAtom)

  const onTogglePronunciation = useCallback((checked: boolean) => setPronunciationConfig((prev) => ({ ...prev, isOpen: checked })), [setPronunciationConfig])
  const onTogglePronunciationIsTransRead = useCallback((checked: boolean) => setPronunciationConfig((prev) => ({ ...prev, isTransRead: checked })), [setPronunciationConfig])
  const onChangePronunciationVolume = useCallback((value: [number]) => setPronunciationConfig((prev) => ({ ...prev, volume: value[0] / 100 })), [setPronunciationConfig])
  const onChangePronunciationIsTransVolume = useCallback((value: [number]) => setPronunciationConfig((prev) => ({ ...prev, transVolume: value[0] / 100 })), [setPronunciationConfig])
  const onChangePronunciationRate = useCallback((value: [number]) => setPronunciationConfig((prev) => ({ ...prev, rate: value[0] })), [setPronunciationConfig])
  const onToggleKeySounds = useCallback((checked: boolean) => setKeySoundsConfig((prev) => ({ ...prev, isOpen: checked })), [setKeySoundsConfig])
  const onChangeKeySoundsVolume = useCallback((value: [number]) => setKeySoundsConfig((prev) => ({ ...prev, volume: value[0] / 100 })), [setKeySoundsConfig])
  const onToggleHintSounds = useCallback((checked: boolean) => setHintSoundsConfig((prev) => ({ ...prev, isOpen: checked })), [setHintSoundsConfig])
  const onChangeHintSoundsVolume = useCallback((value: [number]) => setHintSoundsConfig((prev) => ({ ...prev, volume: value[0] / 100 })), [setHintSoundsConfig])

  const onChangeKeySoundsResource = useCallback(
    (key: string) => {
      const soundResource = keySoundResources.find((item: SoundResource) => item.key === key) as SoundResource
      if (soundResource) setKeySoundsConfig((prev) => ({ ...prev, resource: soundResource }))
    },
    [setKeySoundsConfig],
  )

  const onPlayKeySound = useCallback((soundResource: SoundResource) => playKeySoundResource(soundResource), [])

  return (
    <ScrollArea.Root className="flex-1 select-none overflow-y-auto">
      <ScrollArea.Viewport className="h-full w-full">
        <div className={styles.tabContent}>
          <section className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>单词发音</span>
              <p className={`${styles.sectionDescription} mt-1`}>进入新单词时自动播放发音。</p>
            </div>
            <SettingSwitch checked={pronunciationConfig.isOpen} onChange={onTogglePronunciation} label="单词发音" />
            <SliderRow label="音量" value={pronunciationConfig.volume * 100} display={`${Math.floor(pronunciationConfig.volume * 100)}%`} max={100} step={10} onChange={onChangePronunciationVolume} disabled={!pronunciationConfig.isOpen} />
            <SliderRow label="速度" value={pronunciationConfig.rate ?? 1} display={`${toFixedNumber(pronunciationConfig.rate, 2)}×`} min={0.5} max={4} step={0.1} onChange={onChangePronunciationRate} disabled={!pronunciationConfig.isOpen} />
          </section>

          {window.speechSynthesis && (
            <section className={styles.section}>
              <div>
                <span className={styles.sectionLabel}>释义发音</span>
                <p className={`${styles.sectionDescription} mt-1`}>使用系统语音朗读当前中文释义。</p>
              </div>
              <SettingSwitch checked={pronunciationConfig.isTransRead} onChange={onTogglePronunciationIsTransRead} label="释义发音" />
              <SliderRow label="音量" value={pronunciationConfig.transVolume * 100} display={`${Math.floor(pronunciationConfig.transVolume * 100)}%`} max={100} step={10} onChange={onChangePronunciationIsTransVolume} disabled={!pronunciationConfig.isTransRead} />
            </section>
          )}

          <section className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>按键音</span>
              <p className={`${styles.sectionDescription} mt-1`}>给输入一个很轻的触感反馈；关闭不会影响正确/错误视觉反馈。</p>
            </div>
            <SettingSwitch checked={keySoundsConfig.isOpen} onChange={onToggleKeySounds} label="按键音" />
            <SliderRow label="音量" value={keySoundsConfig.volume * 100} display={`${Math.floor(keySoundsConfig.volume * 100)}%`} min={1} max={100} step={10} onChange={onChangeKeySoundsVolume} disabled={!keySoundsConfig.isOpen} />
            <div className={styles.block}>
              <span className={styles.blockLabel}>声音</span>
              <Listbox value={keySoundsConfig.resource.key} onChange={onChangeKeySoundsResource} disabled={!keySoundsConfig.isOpen}>
                <div className="relative w-full max-w-[280px]">
                  <Listbox.Button className="listbox-button w-full">
                    <span className="truncate">{keySoundsConfig.resource.name}</span>
                    <IconChevronDown className="h-4 w-4" />
                  </Listbox.Button>
                  <Transition as={Fragment} enter="transition ease-out duration-120" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-90" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <Listbox.Options className="listbox-options z-10">
                      {keySoundResources.map((sound) => (
                        <Listbox.Option key={sound.key} value={sound.key}>
                          {({ selected }) => (
                            <div className="group flex cursor-pointer items-center justify-between gap-3">
                              <span className="truncate">{sound.name}</span>
                              <span className="flex items-center gap-2">
                                <button
                                  type="button"
                                  aria-label={`试听 ${sound.name}`}
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onPlayKeySound(sound)
                                  }}
                                  className="grid h-7 w-7 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] opacity-0 transition-opacity hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-accent)] group-hover:opacity-100 focus:opacity-100"
                                >
                                  <IconEar className="h-3.5 w-3.5" />
                                </button>
                                {selected && <IconCheck className="h-4 w-4 text-[var(--wenyan-accent)]" />}
                              </span>
                            </div>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>
          </section>

          <section className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>效果音</span>
              <p className={`${styles.sectionDescription} mt-1`}>用于完成、提示等少量状态反馈。</p>
            </div>
            <SettingSwitch checked={hintSoundsConfig.isOpen} onChange={onToggleHintSounds} label="效果音" />
            <SliderRow label="音量" value={hintSoundsConfig.volume * 100} display={`${Math.floor(hintSoundsConfig.volume * 100)}%`} min={1} max={100} step={10} onChange={onChangeHintSoundsVolume} disabled={!hintSoundsConfig.isOpen} />
          </section>
        </div>
      </ScrollArea.Viewport>
    </ScrollArea.Root>
  )
}
