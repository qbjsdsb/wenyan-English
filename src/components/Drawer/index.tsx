import { Dialog, Transition } from '@headlessui/react'
import classNames from 'classnames'
import { Fragment } from 'react'

export type Placement = 'left' | 'top' | 'right' | 'bottom'

interface DrawerProps {
  open?: boolean
  placement?: Placement
  onClose?: () => void
  children?: React.ReactNode
  classNames?: string
}

const transitionDirectionMap = {
  left: '-translate-x-3',
  right: 'translate-x-3',
  top: '-translate-y-3',
  bottom: 'translate-y-3',
}

export default function Drawer(props: DrawerProps) {
  const { open = false, placement = 'left', onClose, children } = props
  const transitionDirection = transitionDirectionMap[placement]

  return (
    <Transition show={open} appear as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => onClose?.()}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-180"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-120"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-[color-mix(in_srgb,var(--wenyan-canvas)_42%,transparent)] backdrop-blur-[2px]" />
        </Transition.Child>

        <div className="fixed inset-0 h-full w-full overflow-hidden">
          <Transition.Child
            as={Fragment}
            enter="transition ease-out duration-180 transform"
            enterFrom={`opacity-0 ${transitionDirection}`}
            enterTo="opacity-100 translate-x-0 translate-y-0"
            leave="transition ease-in duration-120 transform"
            leaveFrom="opacity-100 translate-x-0 translate-y-0"
            leaveTo={`opacity-0 ${transitionDirection}`}
          >
            <Dialog.Panel
              className={classNames(
                `${placement}-0`,
                props.classNames || '',
                'absolute flex h-full w-[31rem] max-w-[48vw] flex-col border-r border-[var(--wenyan-line-soft)] shadow-[0_24px_72px_color-mix(in_srgb,var(--wenyan-canvas)_34%,transparent)]',
              )}
            >
              {children}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
