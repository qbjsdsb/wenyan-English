import React from 'react'

const InfoBox: React.FC<InfoBoxProps> = ({ info, description }) => {
  return (
    <div className="flex min-w-[72px] flex-col items-center justify-center">
      <span className="text-[15px] font-semibold tabular-nums tracking-[-0.015em] text-[var(--wenyan-ink-secondary)]">
        {info}
      </span>
      <span className="wenyan-muted mt-1 text-[10px] tracking-[0.02em]">{description}</span>
    </div>
  )
}

export default React.memo(InfoBox)

export type InfoBoxProps = {
  info: string
  description: string
}
