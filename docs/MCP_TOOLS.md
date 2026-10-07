# MCP tool contract

更新：2026-10-08。

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

当前 MCP server contract：`0.7.0`。Coaching Context adapter：`coaching-context-v1.1`。插件包：`0.5.1`。

## 首选高层入口：`get_coaching_context`

读取有界、owner-scoped 的 Coaching Context，用于“最近学得怎么样”“今天怎么学”“是否应该减新词”“是否值得考虑 mixed 阶段”等高层判断。

当前事实来源：

- 已同步 `learning_events` 中的 `word_attempted`；
- 有权限且可用时的 active Learning Intent；
- 默认长期 stage=`vocabulary`；
- 红宝书私人 provider 与 Reading 推荐 provider 当前仍 unavailable。

关键语义：

1. 单词事实是必需输入；Learning Intent 是可选增强。普通只读 OAuth 如果没有 Intent read capability，工具仍返回学习证据，并将 `adapter.intentReadStatus=not_authorized`、`learning_intent_unavailable` 写入 warning/uncertainty。此时 `currentIntent=[]` 只代表本快照看不到 intent，不能说“没有 intent”。
2. cloud 读取最多 5,000 条单词事实；截断、坏行、离线/未同步设备都必须显式降低 coverage，不能当作完整人生学习史。
3. 每次读取先冻结 `created_at <= receivedAtOrBefore` 的接收水位，避免分页过程中后来到达的事实移动页面边界。
4. `snapshot.id` 是该次返回描述的 SHA-256 内容指纹，不是持久化数据库对象。
5. `evidence.refs[*].replayable=false`；它们是聚合查询描述，不是以后能直接传回工具重放的证据句柄。`snapshotDescriptor.persistence=not_persisted`、`replaySupport=not_exposed` 必须被保留，不得包装成“已保存审计快照”。
6. word facts 与 Learning Intent 由不同请求读取，`multi_source_snapshot_not_atomic` 会显式标记；不得假装是单事务快照。
7. 输出预算 24 KiB；超限直接失败，不静默截去关键语义。

## 学习证据读取

### `get_learning_overview`
读取 1–365 天内的已同步学习事实概览。拼写首次无错率不是语义掌握率；当前 duration 是键间时间聚合，不是首键回忆延迟；未同步设备数据视为未知。

### `get_weak_words`
读取可解释的近期易错词排序。排名代表“有复习证据”，不代表“这个词一定不会”。

### `get_word_history`
读取单词的有界真实证据链。缺失记录不等于已掌握，也不等于完全未学。

## Learning Intent / AI Coach

### `get_learning_intents`
读取当前有效的 `ongoing / day / session` future-learning intent。只返回 active、已生效、未过期的 scope。该工具本身仍遵守 capability；Coaching Context 不会为了可读而扩大此权限。

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

Edge Function 在校验签名、issuer、audience、expiry、`sub`、`client_id`、`session_id` 与非匿名身份后，使用同一 Bearer token 按 `sub + client_id` 读取当前 OAuth client 的 capability。OAuth `openid` 仅认证身份；它不等同于 Wenyan capability。新 DCR client 默认无 grant，查询故障时受限工具失败关闭；Coaching Context 中的 Intent 会标成 unavailable，而明确无 grant 时标成 not_authorized。

MCP 工具执行前按现有数据库 capability 名称做预检查，RPC/RLS 仍是最终安全边界并会再次检查：

- `get_learning_intents`：`plans:read` 或 `coach:auto_adjust`；
- `revise_learning_intent / clear_learning_intent`：`coach:auto_adjust`；
- 创建/修改/归档计划：`plans:write`；
- 设备读取和命令状态：`navigation:control` 或 `session:control`；
- 打开 Today、词书或章节：`navigation:control`；启动计划任务：`session:control`。

学习事实读取继续使用当前用户的 RLS ownership 约束；本次没有新增全局读取 grant、历史事实写入权或自动 capability 授予。

Learning Intent OAuth 写入要求：

1. 当前真实 OAuth `client_id`；
2. 当前 user/client 显式拥有 `coach:auto_adjust`；
3. 只能通过 `revise_learning_intent / clear_learning_intent` 窄 RPC；
4. SECURITY INVOKER；
5. RLS ownership + RPC transaction marker；
6. optimistic revision + mutation receipt + revision snapshot。

Cloud Plan 和 Command Bus 继续使用各自 capability。ChatGPT 不能 claim/finish 浏览器命令，普通 Wenyan Web 会话不能冒充 OAuth Coach。`get_coaching_context` 的降级读取也不授予任何额外 capability。

## 当前未完成

- 长期学习 stage 的第一方确认、持久化与拒绝提醒 suppression 尚未上线；generic `revise_learning_intent` 继续禁止改 stage。
- Reading Runner 已存在，但 Reading provider / eligible candidate adapter / fresh runtime admission 尚未接入自动 Smart Session。
- snapshot descriptor 尚未作为服务端 manifest 持久化，也没有按 snapshot ID 的 replay tool；因此明确标记为不可回放。
- Intent owner-scoped last-valid cache、正式 sessionId binding、精确 hard-stop enforcement 仍待补。
- 红宝书 provider 尚未接入；`observedProgress` 必须保持 null，不能拿其他词书冒充。

## 后续顺序

1. 真实 OAuth 端到端验收 `get_coaching_context` 的普通只读和 coach-capability 两条路径。
2. 独立完成 stage preference / user-confirmation provenance / reminder suppression。
3. 补 intent cache、日界/session binding、hard-stop 执行。
4. 接私人 Reading provider + eligible candidates + fresh selection guard，再开放 mixed 自动执行。
5. 内容验收后才扩展真题/题型；FSRS 延后到有可靠 semantic/contextual evidence。

不要添加 `run_sql(anything)`、`execute_js(anything)`、`control_wenyan(anything)` 这类万能工具。

See also: `docs/AI_COACHING_LOOP_V1.md`、`docs/LEARNING_INTENT_V1.md`、`docs/SMART_SESSION_V1.md`、`docs/AI_COACH_CONTRACT.md`、`docs/CLOUD_PLAN_V2.md`、`docs/COMMAND_BUS.md`。
