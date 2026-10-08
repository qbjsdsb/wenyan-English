import { Dialog, Transition } from '@headlessui/react'
import classNames from 'classnames'
import type { ElementType, SVGProps } from 'react'
import type React from 'react'
import { Fragment } from 'react'

type InfoPanelProps = {
  openState: boolean
  onClose: () => void
  title: string
  icon: ElementType<SVGProps<SVGSVGElement>>
  iconClassName: string
  buttonClassName: string
  children: React.ReactNode
}

const InfoPanel: React.FC<InfoPanelProps> = ({ openState, title, onClose, icon: Icon, iconClassName, buttonClassName, children }) => {
  return (
    <Transition.Root show={openState} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => onClose()}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
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
              <Dialog.Panel className="wenyan-surface w-full max-w-lg overflow-hidden text-left">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={classNames(
                        iconClassName,
                        'grid h-9 w-9 shrink-0 place-items-center rounded-[var(--wenyan-radius-sm)] bg-[var(--wenyan-accent-soft)] text-[var(--wenyan-accent)]',
                      )}
                    >
                      <Icon className="h-4 w-4 stroke-current" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Dialog.Title as="h3" className="text-[15px] font-semibold leading-6 text-[var(--wenyan-ink)]">
                        {title}
                      </Dialog.Title>
                      <div className="wenyan-body mt-2 text-sm leading-6">{children}</div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end border-t border-[var(--wenyan-line-soft)] px-6 py-3">
                  <button type="button" className={classNames(buttonClassName, 'wenyan-button-secondary')} onClick={() => onClose()}>
                    关闭
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default InfoPanel
