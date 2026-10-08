import styles from './index.module.css'
import { defaultFontSizeConfig } from '@/constants'
import { fontSizeConfigAtom } from '@/store'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Slider from '@radix-ui/react-slider'
import { useAtom } from 'jotai'
import { useCallback } from 'react'

export default function ViewSetting() {
  const [fontSizeConfig, setFontsizeConfig] = useAtom(fontSizeConfigAtom)

  const onChangeForeignFontSize = useCallback(
    (value: [number]) => {
      setFontsizeConfig((prev) => ({ ...prev, foreignFont: value[0] }))
    },
    [setFontsizeConfig],
  )

  const onChangeTranslateFontSize = useCallback(
    (value: [number]) => {
      setFontsizeConfig((prev) => ({ ...prev, translateFont: value[0] }))
    },
    [setFontsizeConfig],
  )

  const onResetFontSize = useCallback(() => {
    setFontsizeConfig({ ...defaultFontSizeConfig })
  }, [setFontsizeConfig])

  return (
    <ScrollArea.Root className="flex-1 select-none overflow-y-auto">
      <ScrollArea.Viewport className="h-full w-full">
        <div className={styles.tabContent}>
          <div className={styles.section}>
            <div>
              <span className={styles.sectionLabel}>文字尺寸</span>
              <p className={`${styles.sectionDescription} mt-1`}>调整学习舞台里单词和释义的大小，改变会立即生效。</p>
            </div>

            <div className="wenyan-setting-preview w-full px-6 py-6 text-center">
              <div className="wenyan-mono font-semibold tracking-[-0.045em] text-[var(--wenyan-ink)]" style={{ fontSize: `${Math.min(fontSizeConfig.foreignFont, 56)}px`, lineHeight: 1.05 }}>venture</div>
              <div className="wenyan-muted mt-3" style={{ fontSize: `${Math.min(fontSizeConfig.translateFont, 24)}px`, lineHeight: 1.45 }}>n. 冒险；风险；企业</div>
            </div>

            <div className={styles.block}>
              <div className="flex w-full items-center justify-between">
                <span className={styles.blockLabel}>单词</span>
                <span className="wenyan-setting-state">{fontSizeConfig.foreignFont}px</span>
              </div>
              <Slider.Root value={[fontSizeConfig.foreignFont]} min={20} max={96} step={4} className="slider" onValueChange={onChangeForeignFontSize}>
                <Slider.Track><Slider.Range /></Slider.Track>
                <Slider.Thumb aria-label="单词字号" />
              </Slider.Root>
            </div>

            <div className={styles.block}>
              <div className="flex w-full items-center justify-between">
                <span className={styles.blockLabel}>释义</span>
                <span className="wenyan-setting-state">{fontSizeConfig.translateFont}px</span>
              </div>
              <Slider.Root value={[fontSizeConfig.translateFont]} max={60} min={14} step={4} className="slider" onValueChange={onChangeTranslateFontSize}>
                <Slider.Track><Slider.Range /></Slider.Track>
                <Slider.Thumb aria-label="释义字号" />
              </Slider.Root>
            </div>
          </div>

          <button className="wenyan-button-secondary" type="button" onClick={onResetFontSize} title="恢复默认字号">
            恢复默认
          </button>
        </div>
      </ScrollArea.Viewport>
    </ScrollArea.Root>
  )
}
