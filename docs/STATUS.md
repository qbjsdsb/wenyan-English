# 当前状态 / 续接入口

更新：2026-10-07，Smart Session 已正式进入 main，Learning Intent v1 正在收口。以实际 main / 开放 PR 为准。

## 已核实主线

当前正式 `main` head 为 `3572871386a2d4cdd24f12a52990e88147598d66`（Wire Smart Session into Today）。当前主线已完成：

- Qwerty 输入核心、Dexie 记录、immutable learningEvents、本地优先上传/恢复与账号隔离。
- Facts v2 保留 raw dictation 条件和经校验的 taskRun/plan/task 关联；还没有正式 session/pause/可靠 active timing。
- 英语 MCP、OAuth、学习证据读取、个人 Cloud Plan 写入。
- Cloud Plan v2 revision/幂等/完成证据规则；Today 可缓存并执行真实 chapter 任务。
- Command Bus、device heartbeat/private realtime、open_today/open_dictionary/open_chapter/start_task 和执行回执。
- GitHub Pages 由 main 正式部署。
- Smart Session v1 / AI Coach contract / deterministic planner core 已进入 main；16 组 deterministic scenario 已进入 CI。
- Smart Session 已首次接入 Today：真实 learningEvents → owner-safe adapter → planner → recoverable vocabulary block → Qwerty ReviewRecord 执行。
- Smart vocabulary block 不携带 chapter taskRun，因此不会把部分词汇练习误记成整章完成。
- `attemptedKeys/newItemsIntroduced` 只从真实 `word_attempted` facts 回填；跳过词不会被伪装成尝试过。

旧文档中“仅只读、计划只在本机、Smart Session 尚在设计”等阶段描述已经过时，必须以当前 main 与开放 PR 为准。

## 当前工作：Learning Intent v1

分支：`feature/learning-intent-v1`

目标：把用户或 ChatGPT 对“接下来怎么学”的偏好变成可版本化、可过期、可回滚的未来约束，供 Smart Session 消费；它不是学习事实。

已在分支并已应用到生产 Supabase：

- `learning_intents`
- `learning_intent_revisions`
- `learning_intent_mutation_receipts`
- `get_learning_intents()`
- `revise_learning_intent(...)`
- `clear_learning_intent(...)`
- `ongoing / day / session` 三层 scope
- explicit RLS + Data API grants
- OAuth `coach:auto_adjust` capability gating
- optimistic revision locking
- idempotency receipt
- 同一 user/scope advisory transaction lock
- 严格 JSON whitelist / shape validation
- PL/pgSQL `FOUND` 状态修复：write marker 在 row lookup 之前设置，避免后续 `PERFORM` 覆盖查询结果
- `(intent_id, user_id)` covering index，消除该新外键的 Advisor 提示

当前生产库没有 Learning Intent 数据行；本轮没有向用户真实账户写测试 intent。

## 当前明确边界

- 正式 MCP 仍是 0.5.x，尚未暴露 Learning Intent 工具。
- Smart Session 还没有读取云端 `ongoing/day/session` constraints；当前继续使用本地默认 constraints + 当前词书。
- 当前只执行 vocabulary block；reading candidate contract 已在 core，但阅读推荐器、题库、答题事实和阅读执行器尚未接入。
- Smart Session runtime 使用 localStorage 做可恢复执行上下文，不是权威事实；真实学习证据仍来自 learningEvents。
- `durationMs` 仍是 Qwerty 键间耗时相关量，不是 recall latency。
- 拼写 evidence 不是 semantic mastery。
- 由于当前执行环境不能安全伪装真实 OAuth JWT，Learning Intent 的完整 OAuth mutation smoke test 还需要通过真实 OAuth/MCP 会话完成；已完成 schema、权限、函数安全属性与生产 migration 静态核验。

## 验证

- main 的 lint / TypeScript / Smart Session deterministic scenarios / build / Chromium E2E 全绿。
- main GitHub Pages 部署成功。
- Learning Intent 生产 migration 已应用到 `learning_intent_found_state_fix` 与 `learning_intent_fk_index`。
- Learning Intent public tables 均启用 RLS，RPC 使用 SECURITY INVOKER；anon 无对应访问/写权限。
- 新 Learning Intent 没有引入 Supabase Security Advisor WARN；现有 WARN 仍是旧 Wenyan 项目的 SECURITY DEFINER RPC 与 leaked-password protection。

## 下一步

1. 收口并合并 `feature/learning-intent-v1`。
2. MCP 升级：增加 `get_learning_intents`、`revise_learning_intent`、`clear_learning_intent`，沿用 `coach:auto_adjust`，不引入泛化 AI 写权限。
3. Smart Session 每次生成 block 前读取 active intent，并按 `session > day > ongoing > local defaults` 合并为 `SessionConstraints`。
4. 云端 intent 不可用时必须回退本地默认值，不能阻塞学习。
5. Intent 闭环跑通后再重做 Today 主视觉：主路径变成“开始今天的学习”，Cloud Plan/手动章节降为次级入口。
6. 接第一篇可信考研阅读，跑通：词汇 evidence → 阅读推荐 → 真实作答 fact → AI interpretation → 下一次 planner 候选。
7. Facts v3 再补正式 session/block/pause/skip/first-key-latency 等证据，不在当前数据上伪造这些指标。

核心 invariant：

> AI may control future learning intent, but must never rewrite past learning truth.

不要重做 OAuth、Command Bus 或 Qwerty；不要把拼写表现叫语义掌握、把键间耗时叫回忆延迟。未同步数据仍然未知。
