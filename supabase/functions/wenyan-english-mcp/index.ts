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
      // Keep the public error bounded when PostgREST returns a non-JSON body.
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
      'device_read_not_granted',
      'command_read_not_granted',
      'command_control_not_granted',
      'no_active_device',
      'invalid_command',
      'invalid_command_args',
      'invalid_command_ttl',
      'intent_read_not_granted',
      'coach_auto_adjust_not_granted',
      'intent_not_found',
      'invalid_intent_scope',
      'invalid_expected_revision',
      'invalid_change_reason',
      'invalid_intent_expiry',
      'invalid_session_intent_expiry',
      'invalid_day_intent_expiry',
      'invalid_intent_constraints',
      'invalid_intent_constraint_key',
      'invalid_focus_dictionary',
      'invalid_intent_numeric_constraint',
      'invalid_review_preference',
      'invalid_intensity',
      'invalid_preferred_activities',
      'invalid_preferred_activity',
      'duplicate_preferred_activity',
      'invalid_intent_goals',
      'invalid_intent_goal_shape',
      'invalid_intent_rationale',
      'invalid_intent_rationale_key',
      'invalid_intent_summary',
      'invalid_intent_basis',
      'invalid_intent_confidence',
      'invalid_intent_evidence_ids',
      'invalid_intent_evidence_id',
      'invalid_intent_uncertainties',
      'invalid_intent_uncertainty',
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
    RPC_revision_conflict: 'The cloud state changed since it was last read. Re-read the current revision before retrying.',
    RPC_completed_task_is_immutable:
      'The requested revision would change a task that already has immutable completion evidence. Keep completed tasks unchanged.',
    RPC_plan_not_found: 'The requested Cloud Plan v2 plan is not visible to this Wenyan account.',
    RPC_plan_not_active: 'The requested plan is no longer active and cannot be revised or archived again.',
    RPC_request_id_conflict: 'That requestId was already used for a different mutation. Use a new stable requestId.',
    RPC_oauth_client_required: 'This operation requires an authenticated OAuth client session.',
    RPC_invalid_request_id: 'requestId must be 8–120 characters using letters, digits, dot, underscore, colon or hyphen.',
    RPC_invalid_title: 'The plan title is invalid.',
    RPC_invalid_timezone: 'The requested IANA timezone is invalid.',
    RPC_invalid_tasks: 'A plan must contain 1–60 tasks.',
    RPC_invalid_task_shape: 'One or more plan tasks failed Wenyan validation.',
    RPC_device_read_not_granted: 'This OAuth client cannot inspect Wenyan device state.',
    RPC_command_read_not_granted: 'This OAuth client cannot inspect Wenyan command state.',
    RPC_command_control_not_granted: 'This OAuth client has not been granted the required Wenyan control capability.',
    RPC_no_active_device: 'No recently active Wenyan web device is available. Open and sign in to Wenyan before sending a website command.',
    RPC_invalid_command: 'The requested Wenyan website command is not supported.',
    RPC_invalid_command_args: 'The Wenyan website command arguments are invalid.',
    RPC_invalid_command_ttl: 'The Wenyan website command lifetime is invalid.',
    RPC_intent_read_not_granted: 'This OAuth client cannot read Wenyan Learning Intent.',
    RPC_coach_auto_adjust_not_granted: 'This OAuth client has not been granted Wenyan coach:auto_adjust capability.',
    RPC_intent_not_found: 'The requested Learning Intent scope does not exist yet.',
    RPC_invalid_intent_scope: 'Learning Intent scope must be ongoing, day, or session.',
    RPC_invalid_expected_revision: 'The Learning Intent expectedRevision is invalid.',
    RPC_invalid_change_reason: 'The Learning Intent change reason is too long.',
    RPC_invalid_intent_expiry: 'Learning Intent expiry must be after its effective time.',
    RPC_invalid_session_intent_expiry: 'A session intent must expire within 12 hours.',
    RPC_invalid_day_intent_expiry: 'A day intent must expire within 48 hours.',
    RPC_invalid_intent_constraints: 'Learning Intent constraints are invalid.',
    RPC_invalid_intent_constraint_key: 'Learning Intent contains an unsupported constraint.',
    RPC_invalid_focus_dictionary: 'The focus dictionary constraint is invalid.',
    RPC_invalid_intent_numeric_constraint: 'A numeric Learning Intent constraint is outside its allowed range.',
    RPC_invalid_review_preference: 'reviewPreference must be balanced or review_first.',
    RPC_invalid_intensity: 'intensity must be gentle or normal.',
    RPC_invalid_preferred_activities: 'preferredActivities is invalid.',
    RPC_invalid_preferred_activity: 'preferredActivities contains an unsupported activity.',
    RPC_duplicate_preferred_activity: 'preferredActivities must not contain duplicates.',
    RPC_invalid_intent_goals: 'Learning Intent goals are invalid.',
    RPC_invalid_intent_goal_shape: 'One or more Learning Intent goals are invalid.',
    RPC_invalid_intent_rationale: 'Learning Intent rationale is invalid.',
    RPC_invalid_intent_rationale_key: 'Learning Intent rationale contains an unsupported field.',
    RPC_invalid_intent_summary: 'Learning Intent rationale summary is invalid.',
    RPC_invalid_intent_basis: 'Learning Intent rationale basis is invalid.',
    RPC_invalid_intent_confidence: 'Learning Intent confidence must be low, medium, or high.',
    RPC_invalid_intent_evidence_ids: 'Learning Intent evidenceIds is invalid.',
    RPC_invalid_intent_evidence_id: 'Learning Intent contains an invalid evidence UUID.',
    RPC_invalid_intent_uncertainties: 'Learning Intent uncertainties is invalid.',
    RPC_invalid_intent_uncertainty: 'A Learning Intent uncertainty is invalid.',
  }

  return {
    isError: true,
    content: [{ type: 'text' as const, text: explanations[message] ?? fallback }],
  }
}

const taskSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.literal('chapter'),
    title: z.string().trim().min(1).max(160),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    estimatedMinutes: z.number().int().min(1).max(240),
    reason: z.string().max(1000).default(''),
    config: z
      .object({
        dictId: z.string().trim().min(1).max(100),
        chapterIndex: z.number().int().min(0),
      })
      .strict(),
  })
  .strict()

const requestIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/)
const optionalDeviceIdSchema = z.string().uuid().optional()
const intentScopeSchema = z.enum(['ongoing', 'day', 'session'])
const activitySchema = z.enum([
  'vocabulary',
  'reading',
  'dictation',
  'cloze',
  'translation',
  'writing',
  'grammar',
  'long_sentence',
  'new_question_type',
])
const preferredActivitiesSchema = z
  .array(activitySchema)
  .max(9)
  .refine((items) => new Set(items).size === items.length, 'preferredActivities must not contain duplicates')
const intentConstraintsSchema = z
  .object({
    focusDictionary: z.string().trim().min(1).max(100).optional(),
    targetMinutes: z.number().int().min(0).max(240).optional(),
    hardStopMinutes: z.number().int().min(0).max(240).optional(),
    newWordCeiling: z.number().int().min(0).max(50).optional(),
    reviewPreference: z.enum(['balanced', 'review_first']).optional(),
    intensity: z.enum(['gentle', 'normal']).optional(),
    preferredActivities: preferredActivitiesSchema.optional(),
  })
  .strict()
const intentGoalSchema = z
  .object({
    kind: z.enum(['exam_preparation', 'reading_transfer', 'question_practice']),
    description: z.string().trim().min(1).max(500),
    horizon: z.enum(['week', 'phase']),
  })
  .strict()
const intentRationaleSchema = z
  .object({
    summary: z.string().max(1000).optional(),
    basis: z.enum(['user_statement', 'observed_evidence', 'inference', 'default']).optional(),
    evidenceIds: z.array(z.string().uuid()).max(50).optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    uncertainties: z.array(z.string().max(500)).max(20).optional(),
  })
  .strict()
const isoTimestampSchema = z.string().datetime({ offset: true })

async function enqueueCommand(
  token: string,
  requestId: string,
  type: 'open_today' | 'open_dictionary' | 'open_chapter' | 'start_task',
  args: Record<string, unknown>,
  deviceId?: string
) {
  return callRpc(
    'enqueue_website_command',
    {
      p_request_id: requestId,
      p_command_type: type,
      p_args: args,
      p_target_device_id: deviceId ?? null,
      p_ttl_seconds: 300,
    },
    token
  )
}

function queuedCommandResult(command: unknown) {
  return toolResult({
    command,
    interpretation:
      'The command is durable and queued for one Wenyan web device. Queued is not the same as executed. Use get_action_status to confirm completed or failed after the browser reports the result.',
    invariant: 'Website command completion never counts as learning completion and never creates a learning fact.',
  })
}

function createServer(token: string) {
  const server = new McpServer({ name: 'Wenyan English', version: '0.6.0' })

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
            local_only_v1_plans: 'not included',
          },
          interpretation:
            status == null
              ? 'No matching Cloud Plan v2 plan is visible to this authenticated user. This does not prove that no local-only plan exists.'
              : 'Use task completionEventId/completedAt as the completion evidence. Plan state itself cannot assert completion.',
        })
      } catch (error) {
        return toolError(error, 'Cloud Plan status is temporarily unavailable. Do not invent or assume plan progress.')
      }
    }
  )

  server.registerTool(
    'get_learning_intents',
    {
      description:
        'Read active Wenyan Learning Intent scopes. These are future-study preferences, not learning facts. Consumers should merge constraints as session > day > ongoing > local defaults; expired or archived intents are not returned.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async () => {
      try {
        const intents = await callRpc('get_learning_intents', {}, token)
        return toolResult({
          intents,
          precedence: ['session', 'day', 'ongoing', 'local_defaults'],
          invariant: 'Learning Intent can guide future study but never proves, edits, or deletes past learning truth.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan Learning Intent is temporarily unavailable. Do not invent active preferences.')
      }
    }
  )

  server.registerTool(
    'revise_learning_intent',
    {
      description:
        'Create or revise one bounded future-learning intent scope. Read get_learning_intents first. Use expectedRevision=0 only when the scope does not yet exist; otherwise pass its current revision. session intents require an expiry within 12 hours and day intents within 48 hours. This changes future intent only and never learning history.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          scope: intentScopeSchema,
          expectedRevision: z.number().int().min(0),
          timezone: z.string().trim().min(1).max(64).default('Asia/Shanghai'),
          effectiveFrom: isoTimestampSchema.optional(),
          expiresAt: isoTimestampSchema.optional(),
          constraints: intentConstraintsSchema.default({}),
          goals: z.array(intentGoalSchema).max(20).default([]),
          rationale: intentRationaleSchema.default({}),
          changeReason: z.string().max(1000).default(''),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, scope, expectedRevision, timezone, effectiveFrom, expiresAt, constraints, goals, rationale, changeReason }) => {
      try {
        const result = await callRpc(
          'revise_learning_intent',
          {
            p_request_id: requestId,
            p_scope: scope,
            p_expected_revision: expectedRevision,
            p_timezone: timezone,
            p_effective_from: effectiveFrom ?? null,
            p_expires_at: expiresAt ?? null,
            p_constraints: constraints,
            p_goals: goals,
            p_rationale: rationale,
            p_change_reason: changeReason,
          },
          token
        )
        return toolResult({
          result,
          invariant: 'Only future learning intent changed. No learning event, answer, completion fact, or historical evidence was rewritten.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan could not revise Learning Intent. Re-read the active intents before retrying.')
      }
    }
  )

  server.registerTool(
    'clear_learning_intent',
    {
      description:
        'Archive one active Learning Intent scope so it stops affecting future Smart Sessions. Read get_learning_intents first and pass the scope current revision. This does not delete revision history or any learning evidence.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          scope: intentScopeSchema,
          expectedRevision: z.number().int().min(1),
          changeReason: z.string().max(1000).default(''),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, scope, expectedRevision, changeReason }) => {
      try {
        const result = await callRpc(
          'clear_learning_intent',
          {
            p_request_id: requestId,
            p_scope: scope,
            p_expected_revision: expectedRevision,
            p_change_reason: changeReason,
          },
          token
        )
        return toolResult({
          result,
          invariant: 'The future intent scope was archived. Historical Learning Intent revisions and learning facts remain intact.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan could not clear Learning Intent. Do not assume the scope stopped applying.')
      }
    }
  )

  server.registerTool(
    'create_study_plan',
    {
      description:
        'Create a new executable Cloud Plan v2 chapter plan for this learner. Each task must point to a Wenyan English dictionary ID and zero-based chapterIndex. Use a stable unique requestId and reuse it only when retrying the exact same mutation. This creates future instructions only and never completion history.',
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
          { p_request_id: requestId, p_title: title, p_timezone: timezone, p_tasks: tasks, p_change_reason: changeReason },
          token
        )
        return toolResult({ result, invariant: 'Only future plan/task rows were created. No learning fact or completion event was written.' })
      } catch (error) {
        return toolError(error, 'Wenyan could not create the study plan. No successful plan creation should be assumed.')
      }
    }
  )

  server.registerTool(
    'revise_study_plan',
    {
      description:
        'Revise the complete executable chapter-task list of an active Cloud Plan v2 plan. Read get_plan_status first and pass its current revision as expectedRevision. Completed tasks must be copied back unchanged with the same IDs and positions; Wenyan rejects attempts to rewrite completion evidence.',
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
          { p_request_id: requestId, p_plan_id: planId, p_expected_revision: expectedRevision, p_change_reason: changeReason },
          token
        )
        return toolResult({ result, invariant: 'Archiving never deletes the plan, revisions, tasks or learning facts.' })
      } catch (error) {
        return toolError(error, 'Wenyan could not archive the study plan. Do not assume the plan changed state.')
      }
    }
  )

  server.registerTool(
    'get_active_devices',
    {
      description:
        'Read recent Wenyan web devices and their online flag/current page. Use this before website-control tools when device choice matters. A device is considered online only from its recent authenticated Wenyan heartbeat.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async () => {
      try {
        const devices = await callRpc('get_active_devices', {}, token)
        return toolResult({
          devices,
          interpretation:
            'Use only devices whose online field is true for immediate control. If none are online, ask the user to open and sign in to the Wenyan web app.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan device state is temporarily unavailable. Do not claim a device is online.')
      }
    }
  )

  server.registerTool(
    'open_today',
    {
      description:
        'Queue a command to open the Wenyan Today page on an active authenticated Wenyan web device. This does not change learning history. After queuing, use get_action_status before claiming it actually opened.',
      inputSchema: z.object({ requestId: requestIdSchema, deviceId: optionalDeviceIdSchema }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, deviceId }) => {
      try {
        return queuedCommandResult(await enqueueCommand(token, requestId, 'open_today', {}, deviceId))
      } catch (error) {
        return toolError(error, 'Wenyan could not queue the Today navigation command. Do not claim the page changed.')
      }
    }
  )

  server.registerTool(
    'open_dictionary',
    {
      description:
        'Select a known Wenyan English dictionary on an active device and open Today. This resets the local chapter selection to chapterIndex 0 but does not create learning completion. Confirm execution with get_action_status.',
      inputSchema: z
        .object({ requestId: requestIdSchema, dictId: z.string().trim().min(1).max(100), deviceId: optionalDeviceIdSchema })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, dictId, deviceId }) => {
      try {
        return queuedCommandResult(await enqueueCommand(token, requestId, 'open_dictionary', { dictId }, deviceId))
      } catch (error) {
        return toolError(error, 'Wenyan could not queue the dictionary navigation command. Do not claim the dictionary changed.')
      }
    }
  )

  server.registerTool(
    'open_chapter',
    {
      description:
        'Select a known Wenyan English dictionary and zero-based chapterIndex, then open that chapter on an active device. This only navigates/prepares study and never marks the chapter complete. Confirm execution with get_action_status.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          dictId: z.string().trim().min(1).max(100),
          chapterIndex: z.number().int().min(0),
          deviceId: optionalDeviceIdSchema,
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, dictId, chapterIndex, deviceId }) => {
      try {
        return queuedCommandResult(await enqueueCommand(token, requestId, 'open_chapter', { dictId, chapterIndex }, deviceId))
      } catch (error) {
        return toolError(error, 'Wenyan could not queue the chapter navigation command. Do not claim the chapter opened.')
      }
    }
  )

  server.registerTool(
    'start_task',
    {
      description:
        'Queue a command to start one specific executable Cloud Plan v2 chapter task on an active Wenyan device. The browser re-syncs the named plan, validates the real task, creates a local taskRun and opens the assigned dictionary/chapter. Starting is not completing; only later immutable learning facts can prove completion. Confirm execution with get_action_status.',
      inputSchema: z
        .object({
          requestId: requestIdSchema,
          planId: z.string().uuid(),
          taskId: z.string().uuid(),
          deviceId: optionalDeviceIdSchema,
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ requestId, planId, taskId, deviceId }) => {
      try {
        return queuedCommandResult(await enqueueCommand(token, requestId, 'start_task', { planId, taskId }, deviceId))
      } catch (error) {
        return toolError(error, 'Wenyan could not queue the plan task. Do not claim the study session started.')
      }
    }
  )

  server.registerTool(
    'get_action_status',
    {
      description:
        'Read the durable execution status of one Wenyan website command. Only effectiveStatus=completed means the browser reported that the website action executed. This still never means a learning task was completed.',
      inputSchema: z.object({ commandId: z.string().uuid() }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] },
    },
    async ({ commandId }) => {
      try {
        const status = await callRpc('get_action_status', { p_command_id: commandId }, token)
        return toolResult({
          status,
          interpretation:
            status == null
              ? 'No matching command is visible. Do not infer execution.'
              : 'Only effectiveStatus=completed proves the requested website action executed. Command completion is not learning completion.',
        })
      } catch (error) {
        return toolError(error, 'Wenyan command status is temporarily unavailable. Do not assume the action executed.')
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
