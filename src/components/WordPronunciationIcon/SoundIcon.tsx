import { VolumeHighIcon, VolumeIcon, VolumeLowIcon, VolumeMediumIcon } from './VolumeIcon'
import type { MouseEventHandler } from 'react'
import { useEffect, useState } from 'react'

const volumeIcons = [VolumeIcon, VolumeLowIcon, VolumeMediumIcon, VolumeHighIcon]

export const SoundIcon = ({ duration = 500, animated = false, onClick, iconClassName, className, label = '播放发音' }: SoundIconProps) => {
  const [animationFrameIndex, setAnimationFrameIndex] = useState(0)

  useEffect(() => {
    if (!animated) {
      setAnimationFrameIndex(0)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimationFrameIndex(3)
      return
    }
    const timer = window.setTimeout(() => {
      const index = animated ? (animationFrameIndex < volumeIcons.length - 1 ? animationFrameIndex + 1 : 0) : 0

      setAnimationFrameIndex(index)
    }, duration)

    return () => {
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, animationFrameIndex])

  const Icon = volumeIcons[animationFrameIndex]

  return (
    <button
      type="button"
      aria-label={label}
      className={`wenyan-sound-button ${className}`}
      onClick={(event) => {
        onClick?.(event)
        if (event.detail > 0) event.currentTarget.blur()
      }}
    >
      <Icon className={iconClassName} />
    </button>
  )
}

export type SoundIconProps = {
  animated?: boolean
  duration?: number
  onClick?: MouseEventHandler<HTMLButtonElement>
  iconClassName?: string
  className?: string
  label?: string
}
