import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'

const functionName = 'wenyan-english-mcp'
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!supabaseUrl || !publishableKey) throw new Error('Missing Supabase runtime configuration')

const resource = `${supabaseUrl}/functions/v1/${functionName}`
const issuer = `${supabaseUrl}/auth/v1`
const metadataUrl = `${resource}/.well-known/oauth-protected-resource`
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

const challengeHeaders = {
  'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
  'Cache-Control': 'no-store',
}

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

function normalizeSupabaseRequest(request: Request) {
  const incoming = new URL(request.url)
  const publicUrl = new URL(supabaseUrl)
  const internalPath = `/${functionName}`

  if (incoming.host !== publicUrl.host || !['http:', 'https:'].includes(incoming.protocol)) return request
  if (incoming.pathname !== internalPath && !incoming.pathname.startsWith(`${internalPath}/`)) return request

  const canonical = new URL(`/functions/v1${incoming.pathname}`, publicUrl)
  canonical.search = incoming.search
  return new Request(canonical, request)
}

async function verifyAccessToken(token: string) {
  const result = await jwtVerify(token, jwks, {
    issuer,
    audience: resource,
    algorithms: ['ES256', 'RS256'],
    requiredClaims: ['exp', 'sub', 'aud', 'iss', 'session_id', 'client_id'],
  })

  const claims = result.payload
  if (
    claims.iss !== issuer ||
    claims.exp == null ||
    claims.exp * 1000 <= Date.now() ||
    typeof claims.sub !== 'string' ||
    typeof claims.client_id !== 'string' ||
    claims.client_id.length === 0 ||
    typeof claims.session_id !== 'string' ||
    claims.session_id.length === 0 ||
    claims.is_anonymous === true ||
    claims.role !== 'authenticated'
  ) {
    throw new Error('INVALID_AUTH')
  }

  return claims
}

async function callRpc(name: string, args: Record<string, unknown>, token: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('NOT_AUTHORIZED')
    throw new Error('CLOUD_UNAVAILABLE')
  }

  return response.json()
}

function toolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  }
}

function readError(error: unknown, fallback: string) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text:
          error instanceof Error && error.message === 'NOT_AUTHORIZED'
            ? 'The current OAuth session is not authorized to read Wenyan English learning data.'
            : fallback,
      },
    ],
  }
}

function createServer(token: string) {
  const server = new McpServer({ name: 'Wenyan English', version: '0.2.0' })

  server.registerTool(
    'get_learning_overview',
    {
      description:
        'Read a bounded overview of the learner’s committed Wenyan English history. Use it to understand recent study frequency and spelling practice. Do not treat spelling accuracy or inter-key duration as vocabulary mastery or recall latency.',
      inputSchema: z
        .object({
          days: z.number().int().min(1).max(365).default(7),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ days }) => {
      try {
        const overview = await callRpc('get_learning_overview', { p_days: days }, token)
        return toolResult({
          overview,
          coverage: {
            source: 'synced Wenyan English learning_events only',
            offline_or_unsynced_devices: 'unknown',
          },
          interpretation: {
            firstTryAccuracy: 'First-try spelling performance in recorded word_attempted events; not semantic mastery.',
            avgDurationMs: 'Sum/average derived from Qwerty inter-key timing; not time-to-first-recall.',
          },
        })
      } catch (error) {
        return readError(error, 'Committed Wenyan English learning data is temporarily unavailable. Do not infer missing history.')
      }
    }
  )

  server.registerTool(
    'get_weak_words',
    {
      description:
        'Read an explainable ranking of repeatedly observed difficult spelling words from committed Wenyan English events. This is evidence for review prioritization, not proof that a word is unknown.',
      inputSchema: z
        .object({
          days: z.number().int().min(1).max(365).default(30),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ days, limit }) => {
      try {
        const words = await callRpc('get_weak_words', { p_days: days, p_limit: limit }, token)
        return toolResult({
          windowDays: days,
          words,
          coverage: {
            source: 'synced word_attempted events only',
            offline_or_unsynced_devices: 'unknown',
            minimum_attempts_per_word: 2,
          },
          interpretation:
            'Rank by observed mistakes and typing duration. A missing word is not evidence of mastery, and a ranked word may be a spelling issue rather than a semantic-memory issue.',
        })
      } catch (error) {
        return readError(error, 'Weak-word evidence is temporarily unavailable. Do not invent a weak-word list.')
      }
    }
  )

  server.registerTool(
    'get_word_history',
    {
      description:
        'Read a bounded evidence trail for one English word from committed Wenyan learning facts. Use this after an overview or weak-word result to explain what was actually observed. Missing observations are unknown, not evidence of mastery.',
      inputSchema: z
        .object({
          word: z.string().trim().min(1).max(100),
          limit: z.number().int().min(1).max(100).default(30),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ word, limit }) => {
      try {
        const history = await callRpc('get_word_history', { p_word: word, p_limit: limit }, token)
        const observations = Array.isArray(history) ? history : []
        return toolResult({
          word: word.trim(),
          observations,
          evidenceCount: observations.length,
          coverage: {
            source: 'synced Wenyan English word_attempted facts only',
            offline_or_unsynced_devices: 'unknown',
            newestFirst: true,
            limit,
          },
          interpretation: {
            wrongCount: 'Observed incorrect key attempts in this Qwerty word attempt.',
            durationMs: 'Recorded inter-key timing aggregate; not first-key recall latency.',
            dictationFields: 'Raw Qwerty UI conditions available only on v2 facts; they do not by themselves prove semantic recall or listening ability.',
            taskFields: 'Present only when Wenyan locally validated the active plan run against the actual dictionary and chapter.',
          },
          missing:
            observations.length === 0
              ? 'No committed observations were found for this word. Do not infer that the word is mastered or unstudied on unsynced devices.'
              : undefined,
        })
      } catch (error) {
        return readError(error, 'Word-history evidence is temporarily unavailable. Do not invent observations for this word.')
      }
    }
  )

  return server
}

Deno.serve(async (rawRequest: Request) => {
  const request = normalizeSupabaseRequest(rawRequest)
  const url = new URL(request.url)

  if (url.origin !== new URL(resource).origin) return json({ error: 'invalid_host' }, 403)

  if (url.pathname === new URL(metadataUrl).pathname && request.method === 'GET') {
    return json({
      resource,
      authorization_servers: [issuer],
      scopes_supported: ['openid'],
      bearer_methods_supported: ['header'],
      resource_name: 'Wenyan English read-only learning data',
    })
  }

  if (url.pathname !== new URL(resource).pathname || url.search) return json({ error: 'not_found' }, 404)

  const origin = request.headers.get('Origin')
  if (origin && !['https://chatgpt.com', 'https://chat.openai.com'].includes(origin)) {
    return json({ error: 'invalid_origin' }, 403)
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' })

  const authorization = request.headers.get('Authorization') ?? ''
  if (!/^Bearer [^ ]{1,8192}$/.test(authorization)) return json({ error: 'unauthorized' }, 401, challengeHeaders)

  const token = authorization.slice(7)
  try {
    await verifyAccessToken(token)
  } catch {
    return json({ error: 'unauthorized' }, 401, challengeHeaders)
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 16_384) return json({ error: 'request_too_large' }, 413)

  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > 16_384) return json({ error: 'request_too_large' }, 413)
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const server = createServer(token)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    const response = await transport.handleRequest(request, { parsedBody: body })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } finally {
    await server.close()
  }
})
