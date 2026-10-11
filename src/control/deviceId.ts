const DEVICE_ID_KEY = 'wenyanDeviceId'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let fallbackDeviceId: string | undefined

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
 * If persistent browser storage is unavailable, keep one UUID for this page
 * session so the control runtime degrades gracefully instead of crashing.
 */
export function getWenyanDeviceId() {
  if (typeof window === 'undefined') return undefined

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing && UUID_PATTERN.test(existing)) {
      fallbackDeviceId = existing
      return existing
    }
  } catch {
    // Continue with the in-memory session identity below.
  }

  const created = createDeviceId()
  if (!created) return undefined

  try {
    window.localStorage.setItem(DEVICE_ID_KEY, created)
  } catch {
    // Storage may be blocked; the in-memory UUID remains stable for this page session.
  }
  return created
}
