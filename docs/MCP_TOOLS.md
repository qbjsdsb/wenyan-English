# MCP tool contract

更新：2026-10-07。

Wenyan English 使用独立远程 MCP：`supabase/functions/wenyan-english-mcp/` 是英语插件的源码真相。Supabase 中更早的 `wenyan-mcp / wenyan_private` 属于旧 Wenyan 路线，不作为英语插件生产实现复用。

## 认证与边界

- Transport：MCP Streamable HTTP。
- Authentication：Supabase OAuth 2.1 + DCR。
- Access token 由 Edge Function 使用 Supabase JWKS、issuer、`aud=authenticated`、session/client claims 校验。
- Edge Function `verify_jwt=false` 是因为函数自己执行 OAuth resource-server 校验，不代表匿名开放。
- 后端只使用 publishable key + 当前 OAuth Bearer token；绝不读取 `service_role`。
- 数据层继续由 SECURITY INVOKER RPC + RLS + OAuth client capability 约束。
- 学习历史 `learning_events` 不可由 AI 修改或删除。
- Learning Intent 是 future intent，不是 past truth。

当前目标 MCP 版本：`0.6.0`。

## 学习证据读取

### `get_learning_overview`
读取 1–365 天内的已同步学习事实概览。拼写首次无错率不是语义掌握率；当前 duration 是键间时间聚合，不是首键回忆延迟；未同步设备数据视为未知。

### `get_weak_words`
读取可解释的近期易错词排序。排名代表“有复习证据”，不代表“这个词一定不会”。

### `get_word_history`
读取单词的有界真实证据链。缺失记录不等于已掌握，也不等于完全未学。

## Learning Intent / AI Coach

### `get_learning_intents`
读取当前有效的 `ongoing / day / session` future-learning intent。只返回 active、已生效、未过期的 scope。

Smart Session 合并顺序：

`session > day > ongoing > local defaults`

### `revise_learning_intent`
创建或修改一个 scope。必须先读当前 intent：

- 不存在的 scope 使用 `expectedRevision=0`；
- 已存在 scope 必须传当前 revision；
- 每次意图修改使用新的稳定 `requestId`，只有网络重试才复用完全相同的 requestId/payload；
- `session` 必须在 effective time 后 12 小时内过期；
- `day` 必须在 effective time 后 48 小时内过期；
- `ongoing` 可以没有 expiry。

v1 constraints：

- `focusDictionary`
- `targetMinutes`
- `hardStopMinutes`
- `newWordCeiling`
- `reviewPreference = balanced | review_first`
- `intensity = gentle | normal`
- `preferredActivities`

Rationale 中的 summary/basis/confidence/uncertainties 是解释信息，不是 immutable learning fact。

### `clear_learning_intent`
归档指定 scope，使其停止影响未来 Smart Session。需要最新 revision。不会删除 intent revision history，更不会删除学习事实。

核心 invariant：

> AI may control future learning intent, but must never rewrite past learning truth.

## Cloud Plan v2

### `get_plan_status`
读取当前活动计划或指定计划。只有匹配 immutable learning event 的 `completionEventId / completedAt` 才是完成证据。

### `create_study_plan`
创建新的未来 chapter 计划。第一批执行器只开放真实 `dictId + zero-based chapterIndex`。

### `revise_study_plan`
完整修改活动计划未来任务。必须使用最新 `expectedRevision`；已有 completion evidence 的任务必须原样保留。

### `archive_study_plan`
归档计划，不删除 plan、revision、task 或 learning facts。

## 网站设备与语义控制

### `get_active_devices`
读取近期 Wenyan Web 设备及 online/current page/dictionary/chapter/mode/taskRun。

### `open_today`
排队打开 Today。

### `open_dictionary`
选择真实英文词书并打开 Today。

### `open_chapter`
选择真实英文词书与 zero-based 章节并进入学习页。

### `start_task`
启动指定 Cloud Plan chapter task。启动不是完成。

### `get_action_status`
读取 durable command 回执。只有 `effectiveStatus=completed` 才表示浏览器报告网页动作已执行；仍然不是学习完成。

控制工具都要求稳定 `requestId`。没有在线设备时不得伪称已执行。

## 权限模型

Learning Intent OAuth 写入要求：

1. 当前真实 OAuth `client_id`；
2. 当前 user/client 显式拥有 `coach:auto_adjust`；
3. 只能通过 `revise_learning_intent / clear_learning_intent` 窄 RPC；
4. SECURITY INVOKER；
5. RLS ownership + RPC transaction marker；
6. optimistic revision + mutation receipt + revision snapshot。

Cloud Plan 和 Command Bus 继续使用各自 capability。ChatGPT 不能 claim/finish 浏览器命令，普通 Wenyan Web 会话不能冒充 OAuth Coach。

## 下一阶段

1. 真实 OAuth session 验收 Learning Intent：read → create → idempotent retry → revise → invalid reject → clear；
2. Smart Session 消费云端 intent，按 `session > day > ongoing > local defaults` 合并；
3. cloud intent 获取失败时回退本地默认值，不能阻止学习；
4. 把 Smart Session 变成 Today 主入口；
5. 再接阅读/真题 recommendation 与答题 evidence；
6. Facts v3 / item-level scheduler 后置。

不要添加 `run_sql(anything)`、`execute_js(anything)`、`control_wenyan(anything)` 这类万能工具。

See also: `docs/LEARNING_INTENT_V1.md`、`docs/SMART_SESSION_V1.md`、`docs/AI_COACH_CONTRACT.md`、`docs/CLOUD_PLAN_V2.md`、`docs/COMMAND_BUS.md`。
