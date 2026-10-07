# Wenyan Intelligence Foundation

> 2026-10-08 续接：当前实现状态见 [STATUS](STATUS.md)；AI 策略、证据摘要、阶段确认及阅读候选边界以 [AI_COACHING_LOOP_V1](AI_COACHING_LOOP_V1.md) 为准。本文的旧阶段状态不代表当前部署。

更新：2026-10-07。

本文件是 Wenyan English 接入 ChatGPT Plugin / MCP 的实施边界。目标不是在网页里塞聊天框，而是建立可长期演进的学习闭环：

> Wenyan 记录真实学习事实 → Supabase 保存长期历史 → ChatGPT 通过受控 MCP 工具读取和分析 → 生成或调整学习计划 → Wenyan 展示并启动任务 → 真实学习结果继续回流。

## 1. 单一职责

### Wenyan Web

负责真实学习行为与执行体验：打字、默写、听写、复习、任务启动、完成证据、本地优先与断网可用。

### Supabase

负责账号、长期学习事实、跨设备恢复、RLS、分析 RPC、云端计划和审计。Supabase 是长期学习记忆，不是 AI 本身。

### ChatGPT Plugin / MCP

负责按需读取、解释、比较、规划和有限的计划写入。MCP 永远不获得任意 SQL，不直接修改历史学习事实，不替用户伪造“已完成”。

## 2. 当前已确认基线

- Qwerty 学习引擎继续保留，不重写。
- `learning_events` 是 Wenyan English 当前不可变学习事实表。
- 网站对学习事实保持 local-first：本地先写，再上传；网络失败不阻塞学习。
- P1 已支持账号隔离、显式认领、指数退避，以及云端 `learning_events` 下拉恢复。
- `get_learning_overview` 与 `get_weak_words` 已是 `SECURITY INVOKER`、RLS 约束的只读 RPC。
- 旧 Supabase 项目里另有一套较早的 `wenyan-mcp` / `wenyan_private` 实现；它不能继续作为 Wenyan English 的隐形源码。英语插件以后以本仓库 `supabase/functions/wenyan-english-mcp` 为源码真相。

## 3. 第一阶段：只读 English Plugin

第一阶段只允许 ChatGPT 读取解释，不允许写计划。

当前首批工具：

- `get_learning_overview(days)`：近期学习频率、事件量、单词练习量、首次无错拼写率、键间耗时。
- `get_weak_words(days, limit)`：按重复错误证据返回需要关注的拼写词。

所有工具必须返回数据边界和解释口径：

- 未同步设备上的学习未知；不能把缺失数据当作零学习。
- 首次无错率描述当前记录到的拼写表现，不等于词义掌握或考试正确率。
- 当前 `durationMs` 来自 Qwerty 键间计时，不包含首键前回忆时间，不能称作反应速度。
- “弱词”是观察到的复习优先证据，不是“不会这个词”的定论。

### 下一批只读工具

按以下顺序补：

1. `get_word_history(word, limit)`：一个词的历次学习事实与证据 ID。
2. `get_recent_sessions(days, limit)`：连续学习 session、模式、时长、完成/中断。
3. `get_review_pressure(days)`：应复习量、积压和未来几天压力。
4. `get_plan_status()`：当前计划、未来任务和真实执行进度。
5. `get_learning_profile()`：考试目标、考试日期、可用时间、学习偏好等用户显式设置。

不要增加 `get_all_my_data` 之类一次性倾倒全部历史的工具。ChatGPT 应先读概要，再按问题钻取详细证据。

## 4. 学习事实 v2

当前 v1 只有 `word_attempted` 和 `chapter_completed`，不足以支持高质量个性化分析。v2 应增量加入，而不是破坏旧事件。

公共字段目标：

- `id`
- `schemaVersion`
- `subject`
- `activityType`
- `occurredAt`
- `deviceId`
- `sessionId`
- `planId` / `taskId`（可空）
- `source` / `sourceVersion`

英语事实优先补：

- `practiceMode`: follow / recall / listen / review
- `firstCorrect`
- `hintUsed`
- `firstKeyLatencyMs`
- `activeDurationMs`
- `wrongCount`
- `mistakes`
- `outcome`: completed / skipped
- `interruptions`

事件至少覆盖：

- `session_started`
- `session_paused`
- `session_finished`
- `word_attempted`
- `word_skipped`
- `chapter_completed`

旧 v1 事实永久保留。分析工具必须知道字段缺失属于“历史没有采集”，不能补造。

## 5. 算法与 ChatGPT 的职责边界

确定性算法负责可计算的复习状态，例如到期词、FSRS 卡片状态、任务真实完成状态。

ChatGPT 负责更高层规划：

- 每日/每周学习量；
- 新学与复习比例；
- 哪类能力优先；
- 是否因积压、执行率或考试节点调整强度；
- 解释为什么这样安排。

不要让模型凭语言直觉决定单个词下一次复习的精确时间，也不要把一个拼写统计直接转换成“掌握度”。

## 6. 云端 Plan v2

只读 Plugin 稳定后再开放写计划。计划与任务必须独立于不可变学习事实。

建议表：

- `study_plans`
- `plan_tasks`
- `plan_revisions`
- 可重算的 `task_progress`
- `integration_audit`

写工具最终只开放：

- `create_study_plan`
- `revise_study_plan`
- `archive_study_plan`

要求：

- 乐观锁 `revision`；
- 幂等请求键；
- 保存 `origin=chatgpt`、理由和证据窗口；
- 只修改未来安排；已完成历史不覆盖；
- AI 不能写学习完成事件；完成只能由 Wenyan 真实练习产生。

## 7. 可执行任务类型

Plan v2 不应只支持整章：

- `chapter`：指定词书/章节；
- `smart_review`：指定时间预算，开始时动态选择 due + 易错词；
- `word_set`：指定词集；
- `recall`：释义回忆；
- `dictation`：听写；
- 后续 `reading` / `past_paper`。

长期计划只写稳定目标，不把未来具体复习词表提前写死。例如“周五 20 分钟智能复习”比“周五复习固定 47 个词”更合理；点击开始时再依据最新事实生成具体队列。

## 8. 安全门槛

开放任何写工具前必须满足：

1. 只读 English MCP 完成真实 ChatGPT OAuth 握手验证。
2. MCP 源码完全在本仓库可审计、可恢复。
3. 所有数据 RPC 都有明确 RLS/授权边界；不开放任意 SQL。
4. 现有旧 `wenyan_private` 的 `SECURITY DEFINER` RPC 逐个完成用途审计；不要因为“旧功能能跑”就直接复用给英语写插件。
5. ChatGPT OAuth client ID 确定后增加明确的客户端允许策略；在此之前保持工具只读。
6. Supabase Advisor 在每次 DDL / 权限改动后复查。

## 9. 验收场景

只读阶段完成时必须能够在 ChatGPT 中自然完成：

> “看看我最近一周英语学得怎么样。”

ChatGPT 应自动读取同步数据，说明覆盖范围，并能继续追问具体弱词或历史，而不是要求用户复制统计截图。

写计划阶段完成时应能够：

> 用户：看看最近情况，给我安排未来一周。
> ChatGPT：读取真实历史 → 解释问题 → 给出计划。
> 用户：可以，就按这个来。
> ChatGPT：调用 `create_study_plan`。
> Wenyan Today：自动出现任务。
> 用户点击：直接进入对应模式。
> 完成后：真实事件关联 plan/task 回流。
> 第二天 ChatGPT：能直接判断昨天计划的实际执行情况并调整未来任务。

达到这个闭环后，文学、阅读、真题模块都复用同一个 `subject + fact + plan + evidence` 体系，不另造 AI 架构。
