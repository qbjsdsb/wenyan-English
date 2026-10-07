export const WENYAN_CAPABILITIES = [
  'plans:read',
  'plans:write',
  'navigation:control',
  'session:control',
  'preferences:write',
  'coach:auto_adjust',
] as const

export type WenyanCapability = (typeof WENYAN_CAPABILITIES)[number]
export type CapabilityFeature =
  | 'intent_read'
  | 'intent_write'
  | 'plans_write'
  | 'device_read'
  | 'navigation_control'
  | 'session_control'

export interface CapabilitySnapshot {
  status: 'available' | 'unavailable'
  capabilities: ReadonlySet<WenyanCapability>
}

export interface CapabilityLookupOptions {
  supabaseUrl: string
  publishableKey: string
  token: string
  userId: string
  clientId: string
  fetcher?: typeof fetch
}

const knownCapabilities = new Set<string>(WENYAN_CAPABILITIES)

const featureRequirements: Record<CapabilityFeature, readonly WenyanCapability[]> = {
  intent_read: ['plans:read', 'coach:auto_adjust'],
  intent_write: ['coach:auto_adjust'],
  plans_write: ['plans:write'],
  device_read: ['navigation:control', 'session:control'],
  navigation_control: ['navigation:control'],
  session_control: ['session:control'],
}

export function capabilitySnapshotFromRows(rows: unknown): CapabilitySnapshot {
  if (!Array.isArray(rows)) return { status: 'unavailable', capabilities: new Set<WenyanCapability>() }

  const capabilities = new Set<WenyanCapability>()
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue
    const capability = (row as { capability?: unknown }).capability
    if (typeof capability === 'string' && knownCapabilities.has(capability)) {
      capabilities.add(capability as WenyanCapability)
    }
  }

  return { status: 'available', capabilities }
}

export function capabilityStatus(snapshot: CapabilitySnapshot, feature: CapabilityFeature) {
  if (snapshot.status !== 'available') return 'unavailable'
  return featureRequirements[feature].some((capability) => snapshot.capabilities.has(capability)) ? 'allowed' : 'denied'
}

export async function loadCapabilitySnapshot(options: CapabilityLookupOptions): Promise<CapabilitySnapshot> {
  const url = new URL(`${options.supabaseUrl}/rest/v1/oauth_client_capabilities`)
  url.searchParams.set('select', 'capability')
  url.searchParams.set('user_id', `eq.${options.userId}`)
  url.searchParams.set('client_id', `eq.${options.clientId}`)

  try {
    const response = await (options.fetcher ?? fetch)(url, {
      headers: {
        apikey: options.publishableKey,
        Authorization: `Bearer ${options.token}`,
        'Cache-Control': 'no-store',
      },
    })
    if (!response.ok) return capabilitySnapshotFromRows(null)
    return capabilitySnapshotFromRows(await response.json())
  } catch {
    return capabilitySnapshotFromRows(null)
  }
}
