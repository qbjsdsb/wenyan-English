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
    audience: 'authenticated',
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

    let rpcMessage = ''
    try {
      const payload = await response.json()
      if (payload && typeof payload.message === 'string') rpcMessage = payload.message
    } catch {
      // Keep the public error bounded even when PostgREST returns a non-JSON body.
    }

    const known = [
      'plans_write_not_granted',
      'revision_conflict',
      'completed_task_is_immutable',
      'plan_not_found',
      'plan_not_active',
      'request_id_conflict',
      'oauth_client_required',
      'invalid_request_id',
      'invalid_title',
      'invalid_timezone',
      'invalid_tasks',
      'invalid_task_shape',
    ].find((code) => rpcMessage.includes(code))

    if (known) throw new Error(`RPC_${known}`)
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

function toolError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  const explanations: Record<string, string> = {
    NOT_AUTHORIZED: 'The current OAuth session is not authorized for this Wenyan operation.',
    RPC_plans_write_not_granted: 'This OAuth client has not been granted Wenyan plans:write capability.',
    RPC_revision_conflict: 'The plan changed since it was last read. Read get_plan_status again before revising it.',
    RPC_completed_task_is_immutable:
      'The requested revision would change a task that already has immutable completion evidence. Keep completed tasks unchanged.',
    RPC_plan_not_found: 'The requested Cloud Plan v2 plan is not visible to this Wenyan account.',
    RPC_plan_not_active: 'The requested plan is no longer active and cannot be revised or archived again.',
    RPC_request_id_conflict: 'That requestId was already used for a different plan mutation. Use a new stable requestId.',
    RPC_oauth_client_required: 'This operation requires an authenticated OAuth client session.',
    RPC_invalid_request_id: 'requestId must be 8–120 characters using letters, digits, dot, underscore, colon or hyphen.',
    RPC_invalid_title: 'The plan title is invalid.',
    RPC_invalid_timezone: 'The requested IANA timezone is invalid.',
    RPC_invalid_tasks: 'A plan must contain 1–60 tasks.',
    RPC_invalid_task_shape: 'One or more plan tasks failed Wenyan validation.',
  }

  return {
    isError: true,
    content: [{ type: 'text' as const, text: explanations[message] ?? fallback }],
  }
}

const taskSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(['chapter', 'smart_review', 'word_set', 'dictation', 'weak_words', 'mixed_session']),
    title: z.string().trim().min(1).max(160),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    estimatedMinutes: z.number().int().min(1).max(240),
    reason: z.string().max(1000).default(''),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

const requestIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/)

function createServer(token: string) {
  const server = new McpServer({ name: 'Wenyan English', version: '0.4.0' })

  server.registerTool(
    'get_learning_overview',
    {
      description:
        'Read a bounded overview of the learner’s committed Wenyan English history. Use it to understand recent study frequency and spelling practice. Do not treat spelling accuracy or inter-key duration as vocabulary mastery or recall latency.',
      inputSchema: z.object({ days: z.number().int().min(1).max(365).default(7) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ days }) => {
      try {
        const overview = await callRpc('get_learning_overview', { p_days: days }, token)
        return toolResult({
          overview,
          coverage: { source: 'synced Wenyan English learning_events only', offline_or_unsynced_devices: 'unknown' },
          interpretation: {
            firstTryAccuracy: 'First-try spelling performance in recorded word_attempted events; not semantic mastery.',
            avgDurationMs: 'Sum/average derived from Qwerty inter-key timing; not time-to-first-recall.',
          },
        })
      } catch (error) {
        return toolError(error, 'Committed Wenyan English learning data is temporarily unavailable. Do not infer missing history.')
      }
    }
  )

  server.registerTool(
    'get_weak_words',
    {
      description:
        'Read an explainable ranking of repeatedly observed difficult spelling words from committed Wenyan English events. This is evidence for review prioritization, not proof that a word is unknown.',
      inputSchema: z
        .object({ days: z.number().int().min(1).max(365).default(30), limit: z.number().int().min(1).max(200).default(50) })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
        return toolError(error, 'Weak-word evidence is temporarily unavailable. Do not invent a weak-word list.')
      }
    }
  )

  server.registerTool(
    'get_word_history',
    {
      description:
        'Read a bounded evidence trail for one English word from committed Wenyan learning facts. Use this after an overview or weak-word result to explain what was actually observed. Missing observations are unknown, not evidence of mastery.',
      inputSchema: z
        .object({ word: z.string().trim().min(1).max(100), limit: z.number().int().min(1).max(100).default(30) })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
        return toolError(error, 'Word-history evidence is temporarily unavailable. Do not invent observations for this word.')
      }
    }
  )

  server.registerTool(
    'get_plan_status',
    {
      description:
        'Read the learner’s current Cloud Plan v2 plan, or one specific plan by UUID. Task completion is derived only from matching immutable learning events; a planned, launched or cancelled task must never be described as completed without completion evidence.',
      inputSchema: z.object({ planId: z.string().uuid().optional() }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ planId }) => {
      try {
        const status = await callRpc('get_plan_status', { p_plan_id: planId ?? null }, token)
        return toolResult({
          status,
          coverage: {
            source: 'Cloud Plan v2 rows plus immutable matching Wenyan completion events',
            local_only_v1_plans: 'not included until Cloud Plan sync is implemented',
          },
          interpretation:
            status == null
              ? 'No matching Cloud Plan v2 plan is visible to this authenticated user. This does not prove that no local-only v1 plan exists.'
              : 'Use task completionEventId/completedAt as the completion evidence. Plan state itself cannot assert completion.',
        })
      } catch (error) {
        return toolError(error, 'Cloud Plan status is temporarily unavailable. Do not invent or assume plan progress.')
      }
    }
  )

  server.registerTool(
    'create_study_plan',
    {
      description:
        'Create a new Cloud Plan v2 future study plan for this learner. Use a stable unique requestId and reuse it only when retrying the exact same mutation. This tool creates future instructions only; it never creates completion history.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          title: z.string().trim().min(1).max(160),
          timezone: z.string().min(1).max(64).default('Asia/Shanghai'),
          changeReason: z.string().max(1000).default(''),
          tasks: z.array(taskSchema).min(1).max(60),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, title, timezone, changeReason, tasks }) => {
      try {
        const result = await callRpc(
          'create_study_plan',
          {
            p_request_id: requestId,
            p_title: title,
            p_timezone: timezone,
            p_tasks: tasks,
            p_change_reason: changeReason,
          },
          token
        )
        return toolResult({
          result,
          invariant: 'Only future plan/task rows were created. No learning fact or completion event was written.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan could not create the study plan. No successful plan creation should be assumed.')
      }
    }
  )

  server.registerTool(
    'revise_study_plan',
    {
      description:
        'Revise the complete future task list of an active Cloud Plan v2 plan. Read get_plan_status first and pass its current revision as expectedRevision. Completed tasks must be copied back unchanged with the same IDs and positions; Wenyan rejects attempts to rewrite completion evidence.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          planId: z.string().uuid(),
          expectedRevision: z.number().int().min(1),
          title: z.string().trim().min(1).max(160),
          timezone: z.string().min(1).max(64).default('Asia/Shanghai'),
          changeReason: z.string().max(1000).default(''),
          tasks: z.array(taskSchema).min(1).max(60),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, planId, expectedRevision, title, timezone, changeReason, tasks }) => {
      try {
        const result = await callRpc(
          'revise_study_plan',
          {
            p_request_id: requestId,
            p_plan_id: planId,
            p_expected_revision: expectedRevision,
            p_title: title,
            p_timezone: timezone,
            p_tasks: tasks,
            p_change_reason: changeReason,
          },
          token
        )
        return toolResult({
          result,
          invariant:
            'The new revision changed future instructions only. Any task with real completion evidence had to remain byte-for-byte equivalent in its planned fields.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan could not revise the study plan. Read the latest plan status before retrying.')
      }
    }
  )

  server.registerTool(
    'archive_study_plan',
    {
      description:
        'Archive an active Cloud Plan v2 plan without deleting it or its revision/evidence history. Read get_plan_status first and pass the current revision as expectedRevision.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          planId: z.string().uuid(),
          expectedRevision: z.number().int().min(1),
          changeReason: z.string().max(1000).default(''),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, planId, expectedRevision, changeReason }) => {
      try {
        const result = await callRpc(
          'archive_study_plan',
          {
            p_request_id: requestId,
            p_plan_id: planId,
            p_expected_revision: expectedRevision,
            p_change_reason: changeReason,
          },
          token
        )
        return toolResult({ result, invariant: 'Archiving never deletes the plan, revisions, tasks or learning facts.' })
      } catch (error) {
        return toolError(error, 'Wenyan could not archive the study plan. Do not assume the plan changed state.')
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
      resource_name: 'Wenyan English personal learning coach',
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
  if (Number.isFinite(contentLength) && contentLength > 32_768) return json({ error: 'request_too_large' }, 413)

  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > 32_768) return json({ error: 'request_too_large' }, 413)
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
