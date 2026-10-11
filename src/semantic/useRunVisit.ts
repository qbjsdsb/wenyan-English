import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
import { useEffect, useRef, useState } from 'react'

/** Each observed account switch gets a new mounted runner, including A → B → A. */
export function useRunVisitKey(runId: string) {
  const [visit, setVisit] = useState(0)
  const owner = useRef(getLocalLearningOwnerId())
  useEffect(() => {
    const changed = () => {
      const next = getLocalLearningOwnerId()
      if (next === owner.current) return
      owner.current = next
      setVisit((value) => value + 1)
    }
    changed()
    window.addEventListener('wenyan-learning-owner-changed', changed)
    window.addEventListener('storage', changed)
    return () => {
      window.removeEventListener('wenyan-learning-owner-changed', changed)
      window.removeEventListener('storage', changed)
    }
  }, [])
  return JSON.stringify([runId, visit])
}

/** A saved fact may finish after departure; its callback must not navigate or update a later visit. */
export function useRunVisitGuard() {
  const owner = useRef(getLocalLearningOwnerId())
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    const changed = () => {
      if (owner.current !== getLocalLearningOwnerId()) active.current = false
    }
    window.addEventListener('wenyan-learning-owner-changed', changed)
    window.addEventListener('storage', changed)
    return () => {
      active.current = false
      window.removeEventListener('wenyan-learning-owner-changed', changed)
      window.removeEventListener('storage', changed)
    }
  }, [])
  // Ref identity is stable, so async handlers always consult the current visit status.
  return active
}
