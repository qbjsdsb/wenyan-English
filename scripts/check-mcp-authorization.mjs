import assert from 'node:assert/strict'
import { capabilitySnapshotFromRows, capabilityStatus, loadCapabilitySnapshot } from '../supabase/functions/wenyan-english-mcp/authorization.ts'

const none = capabilitySnapshotFromRows([])
assert.equal(none.status, 'available')
assert.equal(capabilityStatus(none, 'intent_read'), 'denied')
assert.equal(capabilityStatus(none, 'plans_write'), 'denied')

const readOnly = capabilitySnapshotFromRows([{ capability: 'plans:read' }])
assert.equal(capabilityStatus(readOnly, 'intent_read'), 'allowed')
assert.equal(capabilityStatus(readOnly, 'intent_write'), 'denied')
assert.equal(capabilityStatus(readOnly, 'plans_write'), 'denied')

const coach = capabilitySnapshotFromRows([{ capability: 'coach:auto_adjust' }])
assert.equal(capabilityStatus(coach, 'intent_read'), 'allowed')
assert.equal(capabilityStatus(coach, 'intent_write'), 'allowed')

const controls = capabilitySnapshotFromRows([
  { capability: 'navigation:control' },
  { capability: 'plans:write' },
  { capability: 'unknown:admin' },
  null,
])
assert.equal(capabilityStatus(controls, 'device_read'), 'allowed')
assert.equal(capabilityStatus(controls, 'navigation_control'), 'allowed')
assert.equal(capabilityStatus(controls, 'session_control'), 'denied')
assert.equal(capabilityStatus(controls, 'plans_write'), 'allowed')
assert.equal(controls.capabilities.size, 2)

const unavailable = capabilitySnapshotFromRows({ error: 'unavailable' })
for (const feature of ['intent_read', 'intent_write', 'plans_write', 'device_read', 'navigation_control', 'session_control']) {
  assert.equal(capabilityStatus(unavailable, feature), 'unavailable')
}

let requestedUrl = null
let requestedHeaders = null
const fetched = await loadCapabilitySnapshot({
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'publishable-key',
  token: 'signed-user-token',
  userId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  fetcher: async (input, init) => {
    requestedUrl = input instanceof URL ? input : new URL(input.toString())
    requestedHeaders = new Headers(init?.headers)
    return new Response(JSON.stringify([{ capability: 'plans:read' }]), { status: 200 })
  },
})
assert.ok(requestedUrl)
assert.equal(requestedUrl.pathname, '/rest/v1/oauth_client_capabilities')
assert.equal(requestedUrl.searchParams.get('select'), 'capability')
assert.equal(requestedUrl.searchParams.get('user_id'), 'eq.11111111-1111-4111-8111-111111111111')
assert.equal(requestedUrl.searchParams.get('client_id'), 'eq.22222222-2222-4222-8222-222222222222')
assert.equal(requestedHeaders?.get('apikey'), 'publishable-key')
assert.equal(requestedHeaders?.get('Authorization'), 'Bearer signed-user-token')
assert.equal(requestedHeaders?.get('Cache-Control'), 'no-store')
assert.equal(capabilityStatus(fetched, 'intent_read'), 'allowed')

const deniedLookup = await loadCapabilitySnapshot({
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'publishable-key',
  token: 'signed-user-token',
  userId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  fetcher: async () => new Response('forbidden', { status: 403 }),
})
assert.equal(deniedLookup.status, 'unavailable')
assert.equal(capabilityStatus(deniedLookup, 'intent_read'), 'unavailable')

const failedLookup = await loadCapabilitySnapshot({
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'publishable-key',
  token: 'signed-user-token',
  userId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  fetcher: async () => {
    throw new TypeError('network unavailable')
  },
})
assert.equal(failedLookup.status, 'unavailable')
assert.equal(capabilityStatus(failedLookup, 'plans_write'), 'unavailable')

console.log('9 Wenyan capability mapping and identity lookup scenarios passed')
