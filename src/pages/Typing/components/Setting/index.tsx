import { TypingContext, TypingStateActionType } from '../../store'
import AdvancedSetting from './AdvancedSetting'
import DataSetting from './DataSetting'
import SoundSetting from './SoundSetting'
import ViewSetting from '@/pages/Typing/components/Setting/ViewSetting'
import { Dialog, Tab, Transition } from '@headlessui/react'
import classNames from 'classnames'
import { Fragment, useContext, useState } from 'react'
import IconCog6Tooth from '~icons/heroicons/cog-6-tooth-solid'
import IconEye from '~icons/heroicons/eye-solid'
import IconAdjustmentsHorizontal from '~icons/tabler/adjustments-horizontal'
import IconDatabaseCog from '~icons/tabler/database-cog'
import IconEar from '~icons/tabler/ear'
import IconX from '~icons/tabler/x'

const tabs = [
  ['声音', '发音与按键反馈', IconEar],
  ['练习', '输入与章节行为', IconAdjustmentsHorizontal],
  ['显示', '文字与阅读尺寸', IconEye],
  ['本机数据', '导入与导出备份', IconDatabaseCog],
] as const

export default function Setting() {
  const [isOpen, setIsOpen] = useState(false)
  const { dispatch } = useContext(TypingContext) ?? {}

  function closeModal() {
    setIsOpen(false)
  }

  function openModal() {
    setIsOpen(true)
    if (dispatch) dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`${isOpen ? 'bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-muted)]'} grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
        title="学习设置"
        aria-label="打开学习设置"
      >
        <IconCog6Tooth className="h-4 w-4" />
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-180"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-120"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-[color-mix(in_srgb,var(--wenyan-canvas)_48%,transparent)] backdrop-blur-[3px]" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-6 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-180"
                enterFrom="opacity-0 translate-y-1 scale-[0.992]"
                enterTo="opacity-100 translate-y-0 scale-100"
                leave="ease-in duration-120"
                leaveFrom="opacity-100 translate-y-0 scale-100"
                leaveTo="opacity-0 translate-y-1 scale-[0.992]"
              >
                <Dialog.Panel className="wenyan-settings-dialog flex h-[36rem] w-[52rem] max-w-[92vw] flex-col overflow-hidden rounded-[var(--wenyan-radius-lg)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)] p-0 text-left">
                  <div className="relative flex h-[58px] shrink-0 items-center border-b border-[var(--wenyan-line-soft)] px-5">
                    <div>
                      <Dialog.Title as="h3" className="text-[15px] font-semibold text-[var(--wenyan-ink)]">学习设置</Dialog.Title>
                      <p className="wenyan-muted mt-0.5 text-[10px]">这些偏好只影响练习体验，不会改写学习记录。</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      title="关闭"
                      aria-label="关闭学习设置"
                      className="absolute right-3 top-[13px] grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] transition-colors hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>

                  <Tab.Group vertical>
                    <div className="flex min-h-0 flex-1">
                      <Tab.List className="wenyan-settings-tabs flex w-[184px] shrink-0 flex-col gap-1 border-r border-[var(--wenyan-line-soft)] bg-[color-mix(in_srgb,var(--wenyan-paper-muted)_58%,var(--wenyan-paper-raised))] p-3">
                        {tabs.map(([label, description, Icon]) => (
                          <Tab
                            key={label}
                            className={({ selected }) =>
                              classNames(
                                'flex min-h-[48px] w-full cursor-pointer items-center gap-2.5 rounded-[var(--wenyan-radius-sm)] px-3 text-left outline-none transition-colors',
                                selected
                                  ? 'bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)] shadow-[0_4px_14px_color-mix(in_srgb,var(--wenyan-canvas)_10%,transparent)]'
                                  : 'text-[var(--wenyan-ink-secondary)] hover:bg-[color-mix(in_srgb,var(--wenyan-paper-raised)_68%,transparent)] hover:text-[var(--wenyan-ink)]',
                              )
                            }
                          >
                            <Icon className="h-4 w-4 shrink-0 text-[var(--wenyan-ink-muted)]" />
                            <span className="min-w-0">
                              <span className="block text-[12px] font-medium">{label}</span>
                              <span className="wenyan-muted mt-0.5 block truncate text-[9px]">{description}</span>
                            </span>
                          </Tab>
                        ))}
                      </Tab.List>

                      <Tab.Panels className="min-w-0 flex-1 bg-[var(--wenyan-paper-raised)]">
                        <Tab.Panel className="flex h-full w-full focus:outline-none"><SoundSetting /></Tab.Panel>
                        <Tab.Panel className="flex h-full w-full focus:outline-none"><AdvancedSetting /></Tab.Panel>
                        <Tab.Panel className="flex h-full w-full focus:outline-none"><ViewSetting /></Tab.Panel>
                        <Tab.Panel className="flex h-full w-full focus:outline-none"><DataSetting /></Tab.Panel>
                      </Tab.Panels>
                    </div>
                  </Tab.Group>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
