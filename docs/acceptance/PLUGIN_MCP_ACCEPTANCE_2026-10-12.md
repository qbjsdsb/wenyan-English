# Wenyan MCP 插件实时验收报告 — 2026-10-12

## 1. 执行摘要

**结论：PASS WITH ISSUES**

本轮通过 Cloud Work 暴露的 Wenyan MCP 工具，对生产用户授权上下文发起了真实只读调用。Coaching Context、学习概览、弱词查询、词条历史、学习意图和设备状态查询均有响应；生产 Coaching Context 为 `coaching-context-v1.6`，拼写、词义回想、词义辨认、看义写词仍是彼此独立的证据通道。没有发现把这些通道合成为总掌握率的字段。

有两项实际限制：Coaching Context 的执行可用性连续返回 stale/unknown；`get_plan_status` 被当前 OAuth 会话拒绝，且错误码标为 `INVALID_ARGUMENT`。当前没有在线 Wenyan 网页设备，故导航命令无法做端到端执行验收。未写入学习事实、计划或学习意图，也未改动生产代码。

结论适用范围：MCP 查询工具的实时烟测。Cloud Work 中已直接调用自定义 Wenyan MCP 工具；本轮没有在 ChatGPT 消费端 UI 中另开会话测试，也没有操作生产网站 UI。

## 2. 测试环境

- 日期：2026-10-12（UTC）
- GitHub 仓库默认分支：`main`
- 测试开始时仓库提交记录中的最新 SHA：`460cee23c4b7a4bb4c7373538d96f90dc78c2112`
- 最近相关变更：PR #86 已合并；本轮从 GitHub 仓库读取 PR 元数据。
- Supabase Edge Function：`wenyan-english-mcp`，状态 `ACTIVE`，部署版本 `16`
- Edge Function 源文件注明固定读取 GitHub commit：`5d8ac1fe13a89e58fbdaa2f115a8087e1f2f496d`（PR #86 的实现）
- 实际返回的 Coaching Context：`coaching-context-v1.6`
- 工具环境：Cloud Work 中已连接的 Wenyan MCP 工具；只读请求返回 owner-scoped 数据。
- 浏览器/网站 UI：未用于本轮插件验收。MCP 设备查询显示没有在线设备。
- 真实学习数据：查询使用了已存在的 owner-scoped 生产数据；本报告不包含邮箱、词条、事实 ID、原始历史或个人统计数值。
- 数据写入：无。未新增或修改学习事实、计划、学习意图或网页任务。

## 3. 已测插件调用

| MCP 工具 / 路径 | 状态 | 实际结果 |
|---|---|---|
| `get_coaching_context` | PARTIAL | 实时返回 v1.6；证据通道分离。覆盖质量为 partial，并明确返回执行可用性 stale、覆盖 unknown 及多源快照等警告。 |
| `get_learning_overview` | PASS | 真实 owner-scoped 学习概览查询成功；报告不复制用户数据。 |
| `get_weak_words` | PASS | 弱词排名查询成功；仅作为复习线索，不代表“未知”或掌握判断。 |
| `get_word_history` | PASS | 使用弱词查询结果中的一项继续查询历史，返回词条证据结构；具体词和观察数据不公开。 |
| `get_learning_intents` | PASS | 查询成功；当前没有返回有效的 active intent。 |
| `get_active_devices` | PASS | 查询成功；没有在线设备。未在报告中记录设备 ID。 |
| `get_plan_status` | PARTIAL | 调用被当前 OAuth 会话拒绝，返回“当前 OAuth session 未授权此 Wenyan 操作”；结构化错误码却为 `INVALID_ARGUMENT`，无法读取计划状态。 |
| `open_today` + `get_action_status` | NOT TESTED | 没有在线网页设备，且本轮没有排队命令，无法验证命令抵达网页后的执行状态。 |
| `open_dictionary` / `open_chapter` | NOT TESTED | 需要在线设备；未触发可能改变本地学习位置的导航。 |
| `start_task` | NOT TESTED | 需要有效计划任务和在线设备；会创建网页 task run，本轮未执行。 |
| 创建/修订/归档计划；修订/清除 intent | NOT TESTED | 这些调用会改动未来学习安排。本轮没有针对这些持久化写入的单独授权，因此未做临时写入/清理测试。 |

### Coaching Context 字段核验

本轮再次直接检查了实时响应结构：

- `toolVersion = coaching-context-v1.6`
- `learningEvidence`：拼写证据
- `semanticEvidence`：词义回想证据
- `semanticDiscriminationEvidence`：词义辨认证据
- `semanticProductionEvidence`：看义写词证据
- 三个语义通道均以各自算法版本提供独立结构；production 通道有独立状态。
- 未发现 `mastery`、整体掌握分等总分字段。
- 响应警告：`execution_availability_stale`、`multi_source_snapshot_not_atomic`、`snapshot_descriptor_not_server_persisted`、`visible_history_is_not_all_learning`。
- 执行可用性子快照为 stale / not evaluated / coverage unknown；不能据此宣称当前可执行任务池已被可靠评估。

## 4. 问题与缺陷

### P2 — Coaching Context 的执行可用性处于 stale

- **页面 / 接口：** MCP `get_coaching_context`，`runtime.executionAvailability`
- **复现步骤：** 连续调用 `get_coaching_context` 两次并读取快照状态。
- **预期：** 可用性状态应为当前、可解释的评估结果；无法计算时应保留清楚的未知状态，并避免让调用方误以为当前候选池已评估。
- **实际：** 两次调用均成功返回上下文，但状态为 stale，子快照为 not evaluated，coverage 为 unknown；响应同时给出四项覆盖/一致性警告。
- **是否稳定复现：** 是，本轮两次调用一致。
- **是否已修：** 否。本轮只验收，没有改代码或部署。
- **影响：** 查询仍可用于了解已同步证据，但不宜把当前可执行候选池或 Smart Session 可用性当成实时可靠结论。

### P2 — 计划状态读取被拒绝，错误分类不匹配

- **页面 / 接口：** MCP `get_plan_status`
- **复现步骤：** 无参数调用 `get_plan_status` 两次。
- **预期：** 有权读取时返回当前计划状态；无权时应返回明确的授权/能力错误类别。
- **实际：** 两次均返回 OAuth session 未授权此操作；结构化错误码为 `INVALID_ARGUMENT`。
- **是否稳定复现：** 是，本轮两次调用一致。
- **是否已修：** 否。没有调整 OAuth capability 或插件服务端。
- **影响：** 调用方难以区分参数错误和权限不足；当前不能通过该插件确认计划状态。
- **归因边界：** 服务端提示的是当前 OAuth session 未授权；本轮不能据此断言是 MCP 实现逻辑错误还是授权配置缺失。

## 5. UX 与可操作性发现

- Coaching Context 返回数据丰富，但 stale、partial、unknown 和非原子快照警告意味着代理必须先判断覆盖状态，再提出下一步建议；当前工具不能安全地简化成“系统已算好今日计划”。
- `get_plan_status` 的自然语言权限错误与 `INVALID_ARGUMENT` 结构化码不一致，会误导调用方把授权问题当作参数问题。
- 网页控制工具采取排队后再查 action status 的模式；这是合理的执行验证边界，但当前没有在线设备，实际用户链路未完成验收。
- 本轮没有网页 UI 画面，因此不对插件工具以外的页面文案、键盘/焦点、弹窗或移动端布局作结论。

## 6. 数据与证据完整性

- 所有实际执行的学习数据查询均为只读；未创建 Learning Fact，也未改写历史。
- 查询响应说明 Coaching Context 来源为 owner-scoped 同步学习事件及可用的偏好/意图数据；本轮没有向公共报告复制个人词条、事实 ID 或学习数值。
- 拼写、semantic recall、semantic discrimination、semantic production 仍是独立证据通道。
- 未发现总 mastery score 字段。
- 未将计划、网页命令或 workspace 状态宣称为学习完成。
- 本轮没有产生新的自然 `semantic_production_attempted` 事实；未执行 local → Supabase → MCP 的新事件纵向验证，也没有伪造数据。
- 本轮未触发云同步写入，因此不对同步去重、owner 隔离写入路径或重复 event 风险作新结论。

## 7. 剩余风险与限制

- Coaching Context 目前明确暴露 stale execution availability 和多源快照覆盖缺口；下游代理需要尊重这些不确定性。
- 当前 OAuth 会话不能读取计划状态；若需要计划验收，需要用户在授权流程中开放该只读 capability 后复测。
- 网页设备均离线，导航/命令确认工具不能端到端验收。
- 计划、学习意图等写入工具未测试；它们会影响未来学习安排，不应通过真实账户的临时改写来冒充无副作用测试。
- 本轮没有直接 ChatGPT consumer UI smoke；结论只覆盖 Cloud Work 中真实调用的 MCP 工具。

## 8. 建议的下一步

1. 检查 Coaching Context execution availability 的刷新/快照持久化链路，直到状态不再 stale，或保证调用方能明确退化为只读历史证据。
2. 修正 `get_plan_status` 的 OAuth capability 授权路径和错误码映射，再用真实账户复测。
3. 在 Wenyan 页面保持一个设备在线后，执行 `open_today` 并读取 `get_action_status`，验证仅导航命令的排队、执行与确认。
4. 若要验收计划/intent 写入能力，先授权在真实账户创建并清理一条临时、短时效 future intent/plan；写入测试仍不得修改历史事实。
