import InfoPanel from '@/components/InfoPanel'
import { trackPromotionEvent } from '@/utils/trackEvent'
import { useCallback, useState } from 'react'
import IconBook2 from '~icons/tabler/book-2'

export default function DictRequest() {
  const [showPanel, setShowPanel] = useState(false)

  const onOpenPanel = useCallback(() => {
    setShowPanel(true)
    trackPromotionEvent('promotion_event', {
      from: 'dict_request_button',
      action: 'open',
      action_detail: 'dict_request_button_open',
    })
  }, [])

  const onClosePanel = useCallback(() => {
    setShowPanel(false)
    trackPromotionEvent('promotion_event', {
      from: 'dict_request_panel',
      action: 'close',
      action_detail: 'dict_request_panel_close',
    })
  }, [])

  return (
    <>
      {showPanel && (
        <InfoPanel
          openState={showPanel}
          title="想要添加更多词典？"
          icon={IconBook2}
          buttonClassName=""
          iconClassName=""
          onClose={onClosePanel}
        >
          <p>
            如果你具备一定的编程经验，可以参考
            <a
              href="https://github.com/RealKai42/qwerty-learner/blob/master/docs/toBuildDict.md"
              className="wenyan-link-accent mx-1 font-medium"
              target="_blank"
              rel="noreferrer"
            >
              词典贡献指南
            </a>
            ，为开源词库补充新的内容。
          </p>
        </InfoPanel>
      )}
      <button
        type="button"
        onClick={onOpenPanel}
        className="wenyan-link inline-flex items-center gap-1.5 text-xs"
      >
        <IconBook2 className="h-3.5 w-3.5" />
        <span>更多词典</span>
      </button>
    </>
  )
}
