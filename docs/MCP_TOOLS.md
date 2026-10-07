# MCP tool contract

更新：2026-10-07。

Wenyan English 的 ChatGPT 集成采用独立的远程 MCP。第一阶段严格只读：ChatGPT 获得明确的学习查询工具，而不是任意 SQL、数据库管理权限或原始历史修改能力。

英语插件源码以本仓库 `supabase/functions/wenyan-english-mcp/` 为唯一源码真相。Supabase 项目中更早存在的 `wenyan-mcp` / `wenyan_private` 实现属于此前 Wenyan 路线，不再作为英语插件的隐形生产源码。

## 当前只读端点

Supabase Edge Function：`wenyan-english-mcp`。

- 使用 MCP Streamable HTTP。
- 使用 Supabase OAuth access token，由函数内通过 Supabase JWKS、issuer、标准 `authenticated` audience、session/client claims 校验。
- MCP URL 作为 OAuth protected resource 用于 discovery / challenge；Supabase 默认 OAuth access token 不会自动把 `aud` 改成 MCP URL。
- Edge Function 自身 `verify_jwt=false` 是因为这里执行的是资源服务器级自定义 OAuth 校验；函数不会绕过鉴权。
- 后端调用只使用浏览器安全的 Supabase key + 当前 OAuth Bearer token，不读取 `service_role`。
- 数据查询仍由 RPC + RLS 约束。
- 当前没有任何写工具。

尚未完成真实 ChatGPT Plugin 安装与 OAuth 握手，所以“端点已部署”不等于“ChatGPT 已连接”。

## 当前工具

### `get_learning_overview`

Backed by `public.get_learning_overview` (`SECURITY INVOKER`).

Inputs:
- `days` (1–365, default 7)

Returns:
- total committed learning events
- study days
- word attempts
- first-try spelling-correct count and percentage
- average duration derived from current Qwerty timing records
- explicit coverage / interpretation notes

Interpretation rules:

- `firstTryAccuracy` is observed first-try spelling performance, not vocabulary/semantic mastery.
- current `avgDurationMs` comes from Qwerty inter-key timing and does not include time before the first keypress; never call it recall latency.
- unsynced/offline device history is unknown rather than zero.

### `get_weak_words`

Backed by `public.get_weak_words` (`SECURITY INVOKER`).

Inputs:
- `days` (1–365, default 30)
- `limit` (1–200, default 50)

Returns an explainable ranking containing attempts, mistake attempts, average recorded typing duration and last seen time. The RPC currently requires at least two observations for a word to enter the candidate set.

Interpretation rules:

- ranking means “review evidence exists”, not “the learner does not know this word”.
- a missing word is not proof of mastery.
- current facts cannot yet separate all spelling, semantic-recall and listening causes.

### `get_word_history`

Backed by `public.get_word_history` (`SECURITY INVOKER`).

Inputs:
- `word` (1–100 chars)
- `limit` (1–100, default 30)

Returns newest-first committed observations for exactly one word. Each row is bounded to useful evidence instead of returning the whole raw payload:

- stable `evidence_id`
- occurred / received timestamps
- source version
- dict / chapter / review mode
- wrong count and inter-key duration aggregate
- recorded mistake positions/keys
- v2 raw dictation UI fields when available
- validated `taskRunId / planId / taskId` when the attempt came from a matching active plan task

Interpretation rules:

- `wrong_count` and `mistakes` are observed spelling/key evidence, not a semantic-memory diagnosis.
- `duration_ms` is still not first-key recall latency.
- v1 history legitimately lacks v2 dictation/task fields; missing fields are not backfilled by inference.
- zero returned rows means no committed evidence was found, not “mastered”.

The supporting expression index is scoped to this user+word history access path; the function still checks `auth.uid()` and table RLS as defense in depth.

### `get_plan_status`

Backed by `public.get_plan_status` (`SECURITY INVOKER`).

Inputs:
- optional `planId` UUID; omitted means newest active Cloud Plan v2 plan

Returns:
- plan metadata and current revision
- ordered task list
- task kind/config/state
- immutable completion evidence when a matching `chapter_completed` fact contains the same `planId / taskId`
- explicit note that local-only Plan v1 data is not yet included

Interpretation rules:

- plan/task rows cannot assert completion.
- `active` means scheduled, not completed.
- `cancelled` is a planning decision, not a learning fact.
- only `completionEventId / completedAt` derived from matching immutable learning events may be described as completed.

See `docs/CLOUD_PLAN_V2.md` for the cloud plan/control boundary.

## Next read tools

Implement in this order:

1. `get_recent_sessions`
   - requires session facts v2
   - start/finish/interruption/mode/task association
2. `get_review_pressure`
   - deterministic due / backlog summary
   - no invented causal explanation
3. `get_learning_profile`
   - explicit exam target, exam date, available time and preferences

Do not add a generic `get_all_my_data`. ChatGPT should query summary first and drill into evidence only when useful.

## Write boundary

No write tool is exposed until all of the following are true:

- cross-device learning fact restore is stable;
- the English read-only MCP has completed a real ChatGPT OAuth/plugin acceptance test;
- learning facts v2 can link real sessions to plan/task IDs;
- Cloud Plan v2 revision/idempotency write RPCs are complete;
- existing older `SECURITY DEFINER` Wenyan RPCs have been audited before reuse;
- a stable ChatGPT OAuth `client_id` has been observed and explicitly granted `plans:write`.

The eventual write surface is narrow:

- `create_study_plan`
- `revise_study_plan`
- `archive_study_plan`

These tools may create or change future instructions. They must never insert, edit or delete historical learning facts and must never claim a task is completed without a real Wenyan completion event.

See `docs/INTELLIGENCE_FOUNDATION.md` for the complete closed-loop design.
