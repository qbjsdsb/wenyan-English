# 当前状态 / 续接入口

更新：2026-10-07，Smart Session 首次可执行接线批次。以实际 main / 开放 PR 为准。

## 已核实主线

当前正式 main 已合并 PR #16，head 为 `3d3049d`（Define adaptive Smart Session learning brain）。此前 PR #10–15 已完成：
- Qwerty 输入核心、Dexie 记录、immutable learningEvents、本地优先上传/恢复与账号隔离。
- Facts v2 保留 raw dictation 条件和经校验的 taskRun/plan/task 关联；还没有正式 session/pause/可靠 active timing。
- 英语 MCP、OAuth、只读学习证据工具、个人 Cloud Plan 写入。
- Cloud Plan v2 revision/幂等/完成证据规则；Today 缓存并执行真实 chapter 任务。
- Command Bus、device heartbeat/private realtime、open_today/open_dictionary/open_chapter/start_task 和执行回执。
- GitHub Pages 由 main 正式部署。
- Smart Session v1 / AI Coach contract / deterministic planner core 已进入 main；16 组 deterministic scenario 已进入 CI。

旧文档中“仅只读、计划只在本机、Smart Session 尚在设计”等阶段描述已经过时，必须以当前 main 与开放 PR 为准。

## 当前开放 PR #17：Smart Session → Today 首次执行闭环

分支：`feature/smart-session-today`。

本批已经实现：
- `src/smart-session/runtime.ts`：轻量、本地、可恢复的 Smart Session execution context。它只是未来执行状态，不是 learning fact；默认 6 小时空闲后重开 session。
- `src/smart-session/adapter.ts`：从真实 `word_attempted` events + 当前英语词书生成 owner-safe planner snapshot。当前只使用 Learning Events，不把 legacy wordRecords 与 events 重复计数。
- 当前历史 coverage 明确标记 partial/unknown；缺失记录不解释为“不会”或“已掌握”。
- `durationMs` 没有被当成 recall latency 或真实学习时长；词级 block 先用显式 15 秒 planning heuristic。
- 同一词的 spelling evidence 可跨词书合并；候选执行仍绑定当前 focus dictionary 的真实词条。
- runtime 的 `attemptedKeys/newItemsIntroduced` 只从 immutable word_attempted facts 回填；ReviewRecord 完成只推进 block 状态，不会把“选中过”伪造成“尝试过”。
- Smart vocabulary block 复用已有 Qwerty `ReviewRecord` / review mode，不新造打字引擎。部分词 block 不携带 chapter taskRun，因此不能把章节 Cloud Plan 任务误记为完成。
- 未完成的 ReviewRecord 会在 Today 恢复；不会滚成“欠任务”。
- `/today` 已挂载 `SmartSessionDock`：默认无需选择时长，直接“开始学习”；自然休息点可继续，未来 targetMinutes 仍由现有 planner contract 支持。

## 当前明确边界

- PR #17 目前只执行 vocabulary block；reading candidate contract 已在 core，但阅读推荐器、题库、答题事实和阅读执行器尚未接入。
- Cloud learningIntent / AI Coach 写约束尚未落库；当前 Today 使用本地默认 constraints + 当前词书。
- Smart Session runtime 使用 localStorage 做可恢复执行上下文，不是权威事实；真实学习证据仍来自 learningEvents。
- block active time 当前仍是 planning estimate；Facts v3 前不能把它描述为真实学习时长。
- review mode 完成会继续走现有 review/chapter 记录语义，但不会关联 chapter taskRun。后续 Facts v3 应增加正式 smart block/session event，而不是长期依赖旧 `chapter_completed` 命名。
- 当前不新增 Supabase migration，不改 MCP，不碰 Command Bus。

## 验证

- PR #16 的 GitHub CI 已完整通过：lint、TypeScript、Smart Session deterministic scenarios、build、Chromium E2E。
- PR #17 必须以最新 head 的 GitHub CI 为合并门槛；未完成前不要宣称可发布。

## 下一步

1. 先把 PR #17 跑到 lint / typecheck / Smart Session scenarios / build / Chromium E2E 全绿；修完再合 main。
2. 为 Smart Session 加一条浏览器级回归：空历史时 Today 可生成真实 vocab review block，且 URL/ReviewRecord 不带 chapter taskRun；未完成返回 Today 可恢复。
3. 把 Smart Session CTA 从临时 fixed dock 收进 Today 主视觉，逐步替代“安排今天一章”的旧主路径，但保留手动词书/章节入口。
4. 加 cloud `learningIntent` 存储与 MCP `get_coaching_context / revise_learning_intent / preview_smart_session`，继续保持 future intent 与 past truth 分离。
5. 接一篇来源和答案可信的考研阅读，先跑通：词汇 evidence → 推荐 → 真实作答 fact → AI interpretation → 下一次 planner 候选。
6. Facts v3 再补正式 session/block/pause/skip/first-key-latency 等证据；不要在当前数据上伪造这些指标。

不要重做 OAuth、Command Bus 或 Qwerty；不要把拼写表现叫语义掌握、把键间耗时叫回忆延迟。未同步数据仍然未知。
