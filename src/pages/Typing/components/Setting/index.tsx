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
  ['音效', IconEar],
  ['高级', IconAdjustmentsHorizontal],
  ['显示', IconEye],
  ['数据', IconDatabaseCog],
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
        title="打开设置"
        aria-label="打开设置"
      >
        <IconCog6Tooth className="icon" />
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-6 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 translate-y-1 scale-[0.99]"
                enterTo="opacity-100 translate-y-0 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0 scale-100"
                leaveTo="opacity-0 translate-y-1 scale-[0.99]"
              >
                <Dialog.Panel className="wenyan-surface flex h-[34rem] w-[50rem] max-w-[92vw] flex-col overflow-hidden p-0 text-left">
                  <div className="relative flex h-14 shrink-0 items-center border-b border-[var(--wenyan-line-soft)] px-5">
                    <Dialog.Title as="h3" className="text-[15px] font-semibold text-[var(--wenyan-ink)]">学习设置</Dialog.Title>
                    <button
                      type="button"
                      onClick={closeModal}
                      title="关闭对话框"
                      aria-label="关闭对话框"
                      className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>

                  <Tab.Group vertical>
                    <div className="flex min-h-0 flex-1">
                      <Tab.List className="flex w-40 shrink-0 flex-col gap-1 border-r border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-muted)] p-3">
                        {tabs.map(([label, Icon]) => (
                          <Tab
                            key={label}
                            className={({ selected }) =>
                              classNames(
                                'flex h-10 w-full cursor-pointer items-center gap-2 rounded-[var(--wenyan-radius-sm)] px-3 text-left text-[12px] outline-none transition-colors',
                                selected
                                  ? 'bg-[var(--wenyan-paper-raised)] font-medium text-[var(--wenyan-ink)]'
                                  : 'text-[var(--wenyan-ink-secondary)] hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]',
                              )
                            }
                          >
                            <Icon className="h-4 w-4 text-[var(--wenyan-ink-muted)]" />
                            <span>{label}</span>
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
