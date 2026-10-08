import Tooltip from '@/components/Tooltip'
import { currentChapterAtom, currentDictInfoAtom, isReviewModeAtom } from '@/store'
import range from '@/utils/range'
import { Listbox, Transition } from '@headlessui/react'
import { useAtom, useAtomValue } from 'jotai'
import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import IconCheck from '~icons/tabler/check'

const controlClass =
  'wenyan-button-secondary inline-flex items-center whitespace-nowrap !px-3.5 text-[13px] font-medium'

export const DictChapterButton = () => {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const chapterCount = currentDictInfo.chapterCount
  const isReviewMode = useAtomValue(isReviewModeAtom)

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    if (event.key === ' ') event.preventDefault()
  }

  return (
    <div className="flex items-center gap-2">
      <Tooltip content="切换词库">
        <NavLink className={controlClass} to="/gallery">
          {currentDictInfo.name}{isReviewMode ? ' · 错词复习' : ''}
        </NavLink>
      </Tooltip>
      {!isReviewMode && (
        <Tooltip content="切换章节">
          <Listbox value={currentChapter} onChange={setCurrentChapter}>
            <div className="relative">
              <Listbox.Button onKeyDown={handleKeyDown} className={controlClass}>
                第 {currentChapter + 1} 章
              </Listbox.Button>
              <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                <Listbox.Options className="listbox-options z-30 mt-2 w-32">
                  {range(0, chapterCount, 1).map((index) => (
                    <Listbox.Option key={index} value={index}>
                      {({ selected }) => (
                        <div className="group flex cursor-pointer items-center justify-between">
                          {selected ? (
                            <span className="listbox-options-icon">
                              <IconCheck className="focus:outline-none" />
                            </span>
                          ) : null}
                          <span>第 {index + 1} 章</span>
                        </div>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </Tooltip>
      )}
    </div>
  )
}
