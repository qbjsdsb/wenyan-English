const DEVICE_ID_KEY = 'wenyanDeviceId'
const SESSION_DEVICE_ID_KEY = 'wenyanDeviceIdSession'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let fallbackDeviceId: string | undefined

function validStoredDeviceId(value: string | null) {
  return value && UUID_PATTERN.test(value) ? value : undefined
}

function createDeviceId() {
  if (fallbackDeviceId) return fallbackDeviceId
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return undefined
  fallbackDeviceId = crypto.randomUUID()
  return fallbackDeviceId
}

/**
 * Stable browser installation identity shared with the command bus.
 * This is operational routing metadata, never learning evidence.
 *
 * Prefer localStorage for installation stability. If it is unavailable, use
 * sessionStorage so a reload in the same tab keeps pending-command routing.
 * Only fall back to module memory when both browser stores are unavailable.
 */
export function getWenyanDeviceId() {
  if (typeof window === 'undefined') return undefined

  try {
    const existing = validStoredDeviceId(window.localStorage.getItem(DEVICE_ID_KEY))
    if (existing) {
      fallbackDeviceId = existing
      return existing
    }
  } catch {
    // Fall through to sessionStorage.
  }

  try {
    const existing = validStoredDeviceId(window.sessionStorage.getItem(SESSION_DEVICE_ID_KEY))
    if (existing) {
      fallbackDeviceId = existing
      return existing
    }
  } catch {
    // Fall through to an in-memory identity.
  }

  const created = createDeviceId()
  if (!created) return undefined

  try {
    window.localStorage.setItem(DEVICE_ID_KEY, created)
    return created
  } catch {
    // Persist at tab/session scope when installation storage is blocked.
  }

  try {
    window.sessionStorage.setItem(SESSION_DEVICE_ID_KEY, created)
  } catch {
    // Module memory remains the last-resort identity for this document only.
  }
  return created
}
