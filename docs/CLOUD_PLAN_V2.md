# Cloud Plan v2

更新：2026-10-07。

Cloud Plan v2 是 Wenyan English 从“本机可导入计划”走向“ChatGPT 可分析、可安排、网站可执行”的云端计划协议。它不替代学习事实；计划只描述未来安排，完成状态永远由真实学习事件推导。

## 目标

- 跨设备保存计划与任务。
- ChatGPT 可以读取计划状态，并在明确授权后创建/修订未来计划。
- 网站可以把计划任务解析成真实学习入口。
- 所有变更可追溯、可做 revision，并支持幂等写入。
- AI 永远不能伪造 `completed`、学习时长或历史事实。

## 当前已落地

数据库：

- `public.study_plans`
- `public.plan_tasks`
- `public.study_plan_revisions`
- `public.oauth_client_capabilities`
- `public.get_plan_status(uuid)`（SECURITY INVOKER）

RLS：

- 所有表按 `auth.uid()` 隔离。
- 普通 Wenyan 浏览器会话可以直接维护自己的未来计划/任务。
- OAuth client 当前只能读取；计划表的直接写策略明确拒绝带 `client_id` 的 OAuth session。
- `oauth_client_capabilities` 只能由普通 Wenyan 会话授予/撤销，不允许 OAuth client 给自己提权。

## Task kinds

第一批结构允许：

- `chapter`
- `smart_review`
- `word_set`
- `dictation`
- `weak_words`
- `mixed_session`

`config` 保存各任务类型自己的窄参数。不要把任意命令、SQL、URL 或脚本塞入 `config`。

## Completion 规则

`plan_tasks.state` 只表示计划层状态：

- `active`
- `cancelled`

它没有 `completed`。

`get_plan_status` 只会把与 plan/task 精确匹配的不可变 `learning_events` 作为完成证据。目前仅识别真实 `chapter_completed` 事件中的 `planId / taskId` 关联；后续 Smart Session 会扩展到更细的任务证据。

## OAuth capability 模型

预留能力：

- `plans:read`
- `plans:write`
- `navigation:control`
- `session:control`
- `preferences:write`
- `coach:auto_adjust`

当前不自动授予任何 capability。第一次真实 ChatGPT OAuth/DCR 完成并确认稳定 `client_id` 后，才允许用户在 Wenyan 设置页显式开启写能力。

## 下一批

1. MCP 增加只读 `get_plan_status`。
2. 网站增加 Cloud Plan v2 pull/merge，保留本地优先执行。
3. 增加 revision/idempotency 写 RPC；写 RPC 必须校验明确 capability 与 expected revision。
4. 第一批写工具：`create_study_plan`、`revise_study_plan`、`archive_study_plan`。
5. 再做 Command Bus / device presence，让 ChatGPT 能启动已授权的网站动作。

## 不做

- 不开放任意 SQL。
- 不开放任意 URL 导航或 JavaScript 执行。
- 不允许 OAuth client 自授权限。
- 不允许 AI 修改 `learning_events` 历史事实。
- 不把“打开页面”“开始任务”当作“任务完成”。
