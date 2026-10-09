import { TypingContext, TypingStateActionType } from '../../store'
import AnalysisButton from '../AnalysisButton'
import ErrorBookButton from '../ErrorBookButton'
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

  useHotkeys(
    'ctrl+shift+v',
    () => changeTransVisibleState(),
    { enableOnFormTags: true, preventDefault: true },
    [],
  )

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${open ? 'bg-[var(--wenyan-paper-muted)] text-[var(--wenyan-ink)]' : ''} wenyan-button-secondary inline-flex items-center gap-2 !px-3.5`}
          >
            <SlidersHorizontal aria-hidden="true" size={14} strokeWidth={1.75} />
            <span>学习设置</span>
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
            <Popover.Panel data-study-controls className="wenyan-surface absolute right-0 z-40 mt-2 w-[360px] p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[var(--wenyan-ink)]">学习设置</span>
                <span className="wenyan-muted text-[10px]">低频选项集中在这里</span>
              </div>

              <div className="mb-3 flex items-center justify-between border-b border-[var(--wenyan-line-soft)] pb-3">
                <span className="wenyan-muted text-xs">发音与音标</span>
                <div className="wenyan-study-settings"><PronunciationSwitcher /></div>
              </div>

              <div className="wenyan-study-settings grid grid-cols-4 gap-2 rounded-[var(--wenyan-radius-md)] bg-[var(--wenyan-paper-muted)] p-2">
                <Tooltip content="音效设置"><SoundSwitcher /></Tooltip>
                <Tooltip content="设置单个单词循环"><LoopWordSwitcher /></Tooltip>
                <Tooltip content={`开关默写模式（${CTRL} + V）`}><WordDictationSwitcher /></Tooltip>
                <Tooltip content={`开关释义显示（${CTRL} + Shift + V）`}>
                  <button
                    className={`${state?.isTransVisible ? 'text-[var(--wenyan-accent)]' : 'text-[var(--wenyan-ink-muted)]'} grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
                    type="button"
                    onClick={(e) => {
                      changeTransVisibleState()
                      e.currentTarget.blur()
                    }}
                    aria-label={`开关释义显示（${CTRL} + Shift + V）`}
                  >
                    {state?.isTransVisible ? <IconLanguage /> : <IconLanguageOff />}
                  </button>
                </Tooltip>
                <Tooltip content="错词本"><ErrorBookButton /></Tooltip>
                <Tooltip content="查看数据统计"><AnalysisButton /></Tooltip>
                <Tooltip content="指法图示"><HandPositionIllustration /></Tooltip>
                <Tooltip content="更多设置"><Setting /></Tooltip>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
