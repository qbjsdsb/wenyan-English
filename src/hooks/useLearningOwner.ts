import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { useEffect, useState } from 'react'

export function useLearningOwner() {
  const [owner, setOwner] = useState(getLocalLearningOwnerId)
  useEffect(() => {
    const changed = () => setOwner(getLocalLearningOwnerId())
    window.addEventListener('wenyan-learning-owner-changed', changed)
    window.addEventListener('storage', changed)
    return () => { window.removeEventListener('wenyan-learning-owner-changed', changed); window.removeEventListener('storage', changed) }
  }, [])
  return owner
}
