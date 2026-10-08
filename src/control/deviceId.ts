const DEVICE_ID_KEY = 'wenyanDeviceId'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Stable browser installation identity shared with the command bus.
 * This is operational routing metadata, never learning evidence.
 */
export function getWenyanDeviceId() {
  if (typeof window === 'undefined') return undefined
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing && UUID_PATTERN.test(existing)) return existing
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return undefined
    const created = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_ID_KEY, created)
    return created
  } catch {
    return undefined
  }
}
