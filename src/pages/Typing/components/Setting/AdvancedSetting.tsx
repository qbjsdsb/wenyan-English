import styles from './index.module.css'
import { isIgnoreCaseAtom, isShowAnswerOnHoverAtom, isShowPrevAndNextWordAtom, isTextSelectableAtom, randomConfigAtom } from '@/store'
import { Switch } from '@headlessui/react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtom } from 'jotai'
import { useCallback } from 'react'

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

export default function AdvancedSetting() {
  const [randomConfig, setRandomConfig] = useAtom(randomConfigAtom)
  const [isShowPrevAndNextWord, setIsShowPrevAndNextWord] = useAtom(isShowPrevAndNextWordAtom)
  const [isIgnoreCase, setIsIgnoreCase] = useAtom(isIgnoreCaseAtom)
  const [isTextSelectable, setIsTextSelectable] = useAtom(isTextSelectableAtom)
  const [isShowAnswerOnHover, setIsShowAnswerOnHover] = useAtom(isShowAnswerOnHoverAtom)

  const onToggleRandom = useCallback((checked: boolean) => setRandomConfig((prev) => ({ ...prev, isOpen: checked })), [setRandomConfig])
  const onToggleLastAndNextWord = useCallback((checked: boolean) => setIsShowPrevAndNextWord(checked), [setIsShowPrevAndNextWord])
  const onToggleIgnoreCase = useCallback((checked: boolean) => setIsIgnoreCase(checked), [setIsIgnoreCase])
  const onToggleTextSelectable = useCallback((checked: boolean) => setIsTextSelectable(checked), [setIsTextSelectable])
  const onToggleShowAnswerOnHover = useCallback((checked: boolean) => setIsShowAnswerOnHover(checked), [setIsShowAnswerOnHover])

  const rows = [
    {
      title: '章节乱序',
      description: '下一次进入章节时随机单词顺序，适合减少位置记忆。',
      checked: randomConfig.isOpen,
      onChange: onToggleRandom,
    },
    {
      title: '上下文单词',
      description: '练习时显示上一个和下一个单词；默认会保持很低的视觉权重。',
      checked: isShowPrevAndNextWord,
      onChange: onToggleLastAndNextWord,
    },
    {
      title: '忽略大小写',
      description: '开启后，hello 与 Hello 会被视为同一个正确答案。',
      checked: isIgnoreCase,
      onChange: onToggleIgnoreCase,
    },
    {
      title: '允许选择文本',
      description: '允许鼠标选中页面文字，方便复制或查阅。',
      checked: isTextSelectable,
      onChange: onToggleTextSelectable,
    },
    {
      title: '默写时悬停提示',
      description: '在默写模式下，鼠标悬停单词区域时可查看正确答案。',
      checked: isShowAnswerOnHover,
      onChange: onToggleShowAnswerOnHover,
    },
  ]

  return (
    <ScrollArea.Root className="flex-1 select-none overflow-y-auto">
      <ScrollArea.Viewport className="h-full w-full">
        <div className={styles.tabContent}>
          {rows.map((row) => (
            <section key={row.title} className={styles.section}>
              <div className="w-full">
                <span className={styles.sectionLabel}>{row.title}</span>
                <p className={`${styles.sectionDescription} mt-1`}>{row.description}</p>
              </div>
              <SettingSwitch checked={row.checked} onChange={row.onChange} label={row.title} />
            </section>
          ))}
        </div>
      </ScrollArea.Viewport>
    </ScrollArea.Root>
  )
}
