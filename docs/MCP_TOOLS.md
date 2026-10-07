# MCP tool contract

更新：2026-10-07。

Wenyan English 使用独立远程 MCP：`supabase/functions/wenyan-english-mcp/` 是英语插件的源码真相。Supabase 中更早的 `wenyan-mcp / wenyan_private` 属于旧 Wenyan 路线，不作为英语插件生产实现复用。

## 认证与边界

- Transport：MCP Streamable HTTP。
- Authentication：Supabase OAuth 2.1 + DCR。
- Access token 由 Edge Function 使用 Supabase JWKS、issuer、标准 `aud=authenticated`、session/client claims 校验。
- Edge Function `verify_jwt=false` 是因为函数自己执行 OAuth resource-server 校验，不代表匿名开放。
- 后端只使用 publishable key + 当前 OAuth Bearer token；绝不读取 `service_role`。
- 数据层继续由 SECURITY INVOKER RPC + RLS + OAuth client capability 约束。
- 真实 ChatGPT OAuth/DCR 接入已经完成；个人 ChatGPT client 已显式授予计划读写及后续控制能力。
- 学习历史 `learning_events` 仍保持不可由 AI 修改或删除。

当前线上 MCP 版本：`0.4.1`。

## 只读工具

### `get_learning_overview`
读取 1–365 天内的已同步学习事实概览。拼写首次无错率不是语义掌握率；当前 duration 是键间时间聚合，不是首键回忆延迟；未同步设备数据视为未知。

### `get_weak_words`
读取可解释的近期易错词排序。排名代表“有复习证据”，不代表“这个词一定不会”。

### `get_word_history`
读取单个词的有界证据链，包括错误次数、键位错误、v2 条件以及经本地验证的 `taskRunId / planId / taskId`。

### `get_plan_status`
读取当前活动 Cloud Plan v2 或指定计划。计划行本身不能宣称完成；只有匹配不可变学习事实产生的 `completionEventId / completedAt` 才是完成证据。

## 当前写工具

### `create_study_plan`
创建新的 Cloud Plan v2 未来计划。

第一批执行器只开放 `chapter` 任务：
- `kind = chapter`
- `config.dictId`：Wenyan 英语词书 ID
- `config.chapterIndex`：从 0 开始的章节号
- `dueDate`：YYYY-MM-DD
- `estimatedMinutes`：1–240

要求稳定 `requestId`。相同 requestId 只用于对同一次不确定网络请求做重试；数据库 receipt 保证幂等。

### `revise_study_plan`
完整改写活动计划的未来章节任务列表。

必须先读 `get_plan_status`，并把最新 `revision` 作为 `expectedRevision`。数据库使用乐观锁拒绝过期修改。已有真实完成证据的任务必须保持 ID、位置及计划字段不变，不能通过改计划篡改历史。

### `archive_study_plan`
归档活动计划，不删除计划、revision、task 或学习事实。必须携带最新 `expectedRevision`。

## 写权限实现

写工具不是“OAuth token = 随便写表”。必须同时满足：

1. 当前 OAuth session 有真实 `client_id`；
2. `oauth_client_capabilities` 对当前 user/client 明确授予 `plans:write`；
3. 只能通过窄 RPC 调用；
4. RPC 在事务中设置临时 `wenyan.plan_write_rpc=1`；
5. RLS 同时检查 user ownership、capability 和 RPC marker；
6. RPC 全部为 `SECURITY INVOKER`；
7. `plan_mutation_receipts` 保存幂等结果；
8. revision snapshot 保存计划变更轨迹。

浏览器普通 Wenyan session 仍可按既有产品路径维护自己的本机/云端状态；OAuth client 不能靠直接 REST 表写入绕过 RPC。

## 网站闭环

Cloud Plan v2 是计划真相。Wenyan Today 登录后调用 `get_plan_status`，把当前可执行 `chapter` 任务同步成 Dexie 云端执行缓存。这样继续复用既有证据链：

`taskRun → cached plan/task → actual dict/chapter → word facts → chapter_completed`

只有词书、章节和 taskRun 全部匹配，实际完成全章后才附加 `planId / taskId / taskRunId`。云端 `completionEventId` 也会缓存回 Today，支持跨设备显示真实完成状态。

云端不可用不会阻塞本地学习。

## 下一阶段

按这个顺序推进：

1. Command Bus + device Presence；
2. `navigation:control`（打开 Today/词书/章节）；
3. `session:control`（开始/暂停/继续/停止）；
4. Smart Review 执行器，然后再开放 `smart_review / weak_words / dictation / mixed_session` 任务类型；
5. 学习偏好与 `coach:auto_adjust`；
6. session facts / first-key latency 等 Facts v3。

不要添加 `run_sql(anything)`、`execute_js(anything)`、`control_wenyan(anything)` 这类万能工具。

See also: `docs/CLOUD_PLAN_V2.md` and `docs/INTELLIGENCE_FOUNDATION.md`.
