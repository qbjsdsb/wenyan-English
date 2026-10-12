import { ignoresStudyKey } from '../../keyboard'
import { TypingContext, TypingStateActionType } from '../../store'
import HandPositionIllustration from '../HandPositionIllustration'
import LoopWordSwitcher from '../LoopWordSwitcher'
import PronunciationSwitcher from '../PronunciationSwitcher'
import Setting from '../Setting'
import SoundSwitcher from '../SoundSwitcher'
import WordDictationSwitcher from '../WordDictationSwitcher'
import Tooltip from '@/components/Tooltip'
import { CTRL } from '@/utils'
import { Popover, Transition } from '@headlessui/react'
import { SlidersHorizontal } from 'lucide-react'
import { Fragment, useContext } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IconLanguage from '~icons/tabler/language'
import IconLanguageOff from '~icons/tabler/language-off'

export default function Switcher() {
  const { state, dispatch } = useContext(TypingContext) ?? {}

  const changeTransVisibleState = () => {
    if (dispatch) dispatch({ type: TypingStateActionType.TOGGLE_TRANS_VISIBLE })
  }

  useHotkeys('ctrl+shift+v', () => changeTransVisibleState(), { ignoreEventWhen: ignoresStudyKey, preventDefault: true }, [])

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${
              open ? 'bg-[var(--wenyan-paper-muted)] text-[var(--wenyan-ink)]' : ''
            } wenyan-button-secondary inline-flex items-center gap-2 !px-3.5`}
          >
            <SlidersHorizontal aria-hidden="true" size={14} strokeWidth={1.75} />
            <span>学习设置</span>
          </Popover.Button>

          <Transition
            as={Fragment}
            unmount={false}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            {/* Keep portal dialogs alive when moving focus closes the surrounding popover. */}
            <Popover.Panel
              unmount={false}
              data-study-controls
              className="wenyan-surface absolute right-0 z-40 mt-2 w-[360px] max-w-[calc(100vw-48px)] p-4"
            >
              <div className="mb-3">
                <span className="text-sm font-semibold text-[var(--wenyan-ink)]">学习设置</span>
              </div>

              <div className="mb-3 flex items-center justify-between border-b border-[var(--wenyan-line-soft)] pb-3">
                <span className="wenyan-muted text-xs">发音与音标</span>
                <div className="wenyan-study-settings">
                  <PronunciationSwitcher />
                </div>
              </div>

              <div className="wenyan-study-settings wenyan-quick-settings">
                <div className="wenyan-quick-setting">
                  <span>按键与提示音</span>
                  <SoundSwitcher />
                </div>
                <div className="wenyan-quick-setting">
                  <span>单词循环</span>
                  <LoopWordSwitcher />
                </div>
                <div className="wenyan-quick-setting">
                  <span>默写模式</span>
                  <WordDictationSwitcher />
                </div>
                <div className="wenyan-quick-setting">
                  <span>显示释义</span>
                  <Tooltip content={`开关释义显示（${CTRL} + Shift + V）`}>
                    <button
                      className={`${
                        state?.isTransVisible ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink-muted)]'
                      } grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
                      type="button"
                      onClick={(e) => {
                        changeTransVisibleState()
                        e.currentTarget.blur()
                      }}
                      aria-label={`开关释义显示（${CTRL} + Shift + V）`}
                      aria-pressed={state?.isTransVisible ?? false}
                    >
                      {state?.isTransVisible ? <IconLanguage /> : <IconLanguageOff />}
                    </button>
                  </Tooltip>
                </div>
                <div className="wenyan-quick-setting">
                  <span>键盘指法</span>
                  <HandPositionIllustration />
                </div>
                <div className="wenyan-quick-setting">
                  <span>声音、显示与备份</span>
                  <Setting />
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
