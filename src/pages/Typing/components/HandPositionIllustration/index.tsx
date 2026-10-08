import standTypingHandPosition from '@/assets/standard_typing_hand_position.png'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import IconKeyboard from '~icons/ic/round-keyboard'
import IconX from '~icons/tabler/x'

export default function HandPositionIllustration() {
  const [isOpen, setIsOpen] = useState(false)

  function closeModal() {
    setIsOpen(false)
  }

  function openModal() {
    setIsOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="指法图示"
        className={`${isOpen ? 'bg-[var(--wenyan-paper-raised)] text-[var(--wenyan-ink)]' : 'text-[var(--wenyan-ink-muted)]'} grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] transition-colors hover:bg-[var(--wenyan-paper-raised)] hover:text-[var(--wenyan-ink)]`}
      >
        <IconKeyboard className="icon" />
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
                <Dialog.Panel className="wenyan-surface relative w-[50rem] max-w-[90vw] overflow-hidden p-6 text-left">
                  <button
                    type="button"
                    onClick={closeModal}
                    title="关闭对话框"
                    aria-label="关闭对话框"
                    className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                  <Dialog.Title as="h3" className="text-[15px] font-semibold leading-6 text-[var(--wenyan-ink)]">
                    推荐打字指法
                  </Dialog.Title>
                  <div className="mt-5 overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-muted)] p-4">
                    <img className="block w-full" src={standTypingHandPosition} alt="标准打字指法示意图" />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
