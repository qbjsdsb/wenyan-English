import SharePicDialog from './SharePicDialog'
import { recordShareAction } from '@/utils'
import { useCallback, useMemo, useState } from 'react'
import IconShare2 from '~icons/tabler/share-2'

export default function ShareButton() {
  const [isShowSharePanel, setIsShowSharePanel] = useState(false)

  const randomChoose = useMemo(
    () => ({ picRandom: Math.random(), promoteRandom: Math.random() }),
    [],
  )

  const onClickShare = useCallback(() => {
    recordShareAction('open')
    setIsShowSharePanel(true)
  }, [])

  return (
    <>
      {isShowSharePanel && <SharePicDialog showState={isShowSharePanel} setShowState={setIsShowSharePanel} randomChoose={randomChoose} />}
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-[var(--wenyan-radius-sm)] text-[var(--wenyan-ink-muted)] transition-colors hover:bg-[var(--wenyan-paper-muted)] hover:text-[var(--wenyan-ink)]"
        onClick={onClickShare}
        title="分享学习结果"
        aria-label="分享学习结果"
      >
        <IconShare2 className="h-4 w-4" />
      </button>
    </>
  )
}
