const LOCAL_LEARNING_OWNER_KEY = 'wenyanLearningOwnerId'

export function getLocalLearningOwnerId(): string | undefined {
  if (typeof window === 'undefined') return undefined

  try {
    return window.localStorage.getItem(LOCAL_LEARNING_OWNER_KEY) || undefined
  } catch {
    return undefined
  }
}

export function setLocalLearningOwnerId(userId?: string | null) {
  if (typeof window === 'undefined') return

  try {
    if (userId) {
      window.localStorage.setItem(LOCAL_LEARNING_OWNER_KEY, userId)
    } else {
      window.localStorage.removeItem(LOCAL_LEARNING_OWNER_KEY)
    }
  } catch {
    // Local ownership is a routing safeguard only. Storage failure must not block study.
  }
}
