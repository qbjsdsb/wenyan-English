# MCP tool contract

更新：2026-10-07。

Wenyan English 的 ChatGPT 集成采用独立的远程 MCP。第一阶段严格只读：ChatGPT 获得明确的学习查询工具，而不是任意 SQL、数据库管理权限或原始历史修改能力。

英语插件源码以本仓库 `supabase/functions/wenyan-english-mcp/` 为唯一源码真相。Supabase 项目中更早存在的 `wenyan-mcp` / `wenyan_private` 实现属于此前 Wenyan 路线，不再作为英语插件的隐形生产源码。

## 当前已部署的只读端点

Supabase Edge Function：`wenyan-english-mcp`。

- 使用 MCP Streamable HTTP。
- 使用 Supabase OAuth access token，由函数内通过 Supabase JWKS、issuer、resource audience、session/client claims 校验。
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

## Next read tools

Implement in this order:

1. `get_word_history`
   - one stable word ID
   - bounded event history
   - evidence IDs and missing-field notes
2. `get_recent_sessions`
   - requires session facts v2
   - start/finish/interruption/mode/task association
3. `get_review_pressure`
   - deterministic due / backlog summary
   - no invented causal explanation
4. `get_plan_status`
   - cloud plan + task + real completion evidence
5. `get_learning_profile`
   - explicit exam target, exam date, available time and preferences

Do not add a generic `get_all_my_data`. ChatGPT should query summary first and drill into evidence only when useful.

## Write boundary

No write tool is exposed until all of the following are true:

- cross-device learning fact restore is stable;
- the English read-only MCP has completed a real ChatGPT OAuth/plugin acceptance test;
- learning facts v2 can link real sessions to plan/task IDs;
- cloud plan schema has revision/idempotency rules;
- existing older `SECURITY DEFINER` Wenyan RPCs have been audited before reuse;
- an explicit ChatGPT OAuth client policy exists.

The eventual write surface is narrow:

- `create_study_plan`
- `revise_study_plan`
- `archive_study_plan`

These tools may create or change future instructions. They must never insert, edit or delete historical learning facts and must never claim a task is completed without a real Wenyan completion event.

See `docs/INTELLIGENCE_FOUNDATION.md` for the complete closed-loop design.
