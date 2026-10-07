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

当前目标 MCP 版本：`0.5.0`。

## 学习与计划读取工具

### `get_learning_overview`
读取 1–365 天内的已同步学习事实概览。拼写首次无错率不是语义掌握率；当前 duration 是键间时间聚合，不是首键回忆延迟；未同步设备数据视为未知。

### `get_weak_words`
读取可解释的近期易错词排序。排名代表“有复习证据”，不代表“这个词一定不会”。

### `get_word_history`
读取单个词的有界证据链，包括错误次数、键位错误、v2 条件以及经本地验证的 `taskRunId / planId / taskId`。

### `get_plan_status`
读取当前活动 Cloud Plan v2 或指定计划。计划行本身不能宣称完成；只有匹配不可变学习事实产生的 `completionEventId / completedAt` 才是完成证据。

## 计划写工具

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

## 网站设备与控制工具

### `get_active_devices`
读取最近出现过的 Wenyan Web 设备及 `online`、当前页面、词书、章节、模式、taskRun 等状态。只有近期 authenticated heartbeat 才能使设备成为即时控制目标。

### `open_today`
在一个在线 Wenyan Web 设备排队打开 `/today`。工具成功只表示 durable command 已入队，不表示浏览器已经执行。

### `open_dictionary`
在在线设备选择一个真实 Wenyan 英语 `dictId`，清除 review mode、章节归零并打开 Today。网页执行器会再次验证词书，不信任模型输入。

### `open_chapter`
在在线设备选择真实英文词书与 zero-based `chapterIndex`，验证真实 `chapterCount` 后打开学习页。不产生 completion。

### `start_task`
启动指定 Cloud Plan v2 的 chapter task：浏览器先按 `planId` 重新同步云计划，再复用现有 `startStudyTask(planId, taskId)` 创建 taskRun，最后切换到真实词书/章节。启动永远不等于完成。

### `get_action_status`
读取 durable command 回执。只有 `effectiveStatus=completed` 才代表浏览器报告网页动作执行成功；这仍然不是学习完成证据。

控制工具都要求稳定 `requestId`，同一个 requestId 只能重试同一意图。没有在线设备时返回 `no_active_device`，模型不得伪称已执行。

## 写权限实现

计划写工具不是“OAuth token = 随便写表”。必须同时满足：

1. 当前 OAuth session 有真实 `client_id`；
2. `oauth_client_capabilities` 对当前 user/client 明确授予对应 capability；
3. 只能通过窄 RPC 调用；
4. RPC 在事务中设置临时 marker；
5. RLS 同时检查 user ownership、capability 和 RPC marker；
6. RPC 全部为 `SECURITY INVOKER`；
7. 计划 mutation receipt / revision snapshot 保存幂等与变更轨迹。

Command Bus 进一步分开两个身份：OAuth ChatGPT 只能 enqueue / read status；普通 Wenyan Web 登录会话才能 claim / finish。网页命令的 durable row、Realtime private notification、浏览器回执三层组合避免“发出了就当成功”。

## 网站闭环

Cloud Plan v2 是计划真相。Wenyan Today 登录后调用 `get_plan_status`，把可执行 `chapter` 任务同步成 Dexie 云端执行缓存。控制平面的 `start_task` 同样复用这条链：

`Cloud Plan → Dexie cache → taskRun → actual dict/chapter → word facts → chapter_completed`

只有词书、章节和 taskRun 全部匹配，实际完成全章后才附加 `planId / taskId / taskRunId`。Command `completed` 不能替代这条证据链。

云端/Reatime 暂时不可用不会篡改或补造本地学习事实；durable pending command 允许网页重连后补取。

## 下一阶段

按这个顺序推进：

1. 完成 Command Bus + private Realtime Presence 的真实浏览器/ChatGPT 端到端验收；
2. `set_practice_mode`；
3. `pause_session / resume_session / stop_session`；
4. Smart Review 执行器，然后再开放 `smart_review / weak_words / dictation / mixed_session` 任务类型；
5. 学习偏好与 `coach:auto_adjust`；
6. session facts / first-key latency 等 Facts v3。

不要添加 `run_sql(anything)`、`execute_js(anything)`、`control_wenyan(anything)` 这类万能工具。

See also: `docs/CLOUD_PLAN_V2.md`、`docs/COMMAND_BUS.md`、`docs/INTELLIGENCE_FOUNDATION.md`。
