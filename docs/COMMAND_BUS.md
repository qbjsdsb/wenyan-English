# Wenyan Command Bus / Device Presence

更新：2026-10-07。

本层把 ChatGPT 的“控制网站”能力做成可审计的语义动作，而不是浏览器脚本、CSS selector 或任意 JavaScript。

## 核心边界

- ChatGPT OAuth 客户端只能通过窄 RPC 创建命令，不能直接改 `website_commands`。
- Wenyan 浏览器必须使用普通用户会话（JWT 没有 OAuth `client_id`）才能 claim / finish 命令。
- `completed` 只表示网页动作执行成功，不表示学习任务完成。
- 学习完成仍只来自真实 `chapter_completed` 等不可变 Learning Facts。
- 不提供任意 URL、任意 DOM 点击、任意 JavaScript、任意 SQL。

## 数据面

### `wenyan_devices`

每个浏览器配置保存一个随机 UUID。登录 Wenyan 后：

- 每约 30 秒更新一次 heartbeat；
- 保存当前 route、词书、章节、练习模式、`taskRun`；
- `last_seen_at` 两分钟以内才可被 ChatGPT 选为即时控制目标。

Realtime Presence 负责低延迟在线状态；数据库 heartbeat 是 MCP 可以可靠读取的持久快照。Presence 不作为唯一事实源。

### `website_commands`

第一批命令：

- `open_today`
- `open_dictionary`
- `open_chapter`
- `start_task`

状态：

`pending -> executing -> completed | failed`

未在 `expires_at` 前 claim 的 pending 命令，在读取时视为 `expired`。

`request_id` 在 `(user_id, client_id)` 内幂等；同一个 request ID 只能重试完全相同的意图。

## RPC

OAuth / ChatGPT：

- `get_active_devices()`
- `enqueue_website_command(...)`
- `get_action_status(command_id)`

Wenyan Web 普通登录会话：

- `upsert_wenyan_device(...)`
- `get_pending_website_commands(device_id)`
- `claim_website_command(command_id, device_id)`
- `finish_website_command(command_id, device_id, success, result, error_code)`

所有 public RPC 都是 `SECURITY INVOKER`。

数据库到 Realtime 的通知 trigger 使用 `wenyan_internal` 私有 schema 中的不可直接执行 `SECURITY DEFINER` trigger function；它只发送最小 command metadata。即使 Broadcast 失败，数据库里的 durable command 仍保留，浏览器 heartbeat / reconnect 会补取 pending commands。

## Realtime

私有 channel topic：

`wenyan:user:<auth.uid>:control`

根据 Supabase 2026 Realtime 规则，不修改 `realtime` schema 中的表、函数或 trigger，只在 `realtime.messages` 增加 RLS policies：

- 当前用户可以接收自己的 `broadcast` / `presence`；
- 只有普通 Wenyan Web 登录会话可以 track presence；
- ChatGPT 不通过 Realtime 直接写命令，命令必须先进入 durable RPC / table。

## 浏览器执行语义

### `open_today`

导航到 `/today`。

### `open_dictionary`

- 必须是仓库存在的英文词书；
- 清除 review mode；
- 切换词书；
- 章节归零；
- 打开 Today。

### `open_chapter`

- 验证英文词书；
- 验证 zero-based `chapterIndex` 在真实 `chapterCount` 内；
- 清除 review mode；
- 切词书 / 章节；
- 打开学习页。

只准备章节，不写 completion。

### `start_task`

1. 按 `planId` 重新读取 Cloud Plan v2；
2. 缓存到 Dexie；
3. 验证计划 active、任务真实存在且可执行；
4. 调用已有 `startStudyTask(planId, taskId)` 创建真实本地 `taskRun`；
5. 切到任务指定词书 / 章节并打开学习页；
6. command result 可返回 `taskRunId`，但仍不产生学习完成事实。

## MCP 语义

MCP 控制工具只返回“已排队”时，模型不得说“已经打开/已经开始”。

需要确认时必须调用 `get_action_status`：

- `pending`：等待在线网页 claim；
- `executing`：网页已 claim；
- `completed`：网页动作执行并回执；
- `failed`：网页执行失败；
- `expired`：未及时执行。

## 后续阶段

完成第一批真实端到端验收后再逐步增加：

- `set_practice_mode`
- `pause_session / resume_session / stop_session`
- 更细的设备命名与设备选择
- Smart Review / weak-word session executor
- 有上限的 `coach:auto_adjust`

不要在执行器尚未存在时先暴露 MCP tool。
