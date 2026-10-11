# 当前状态 / 续接入口

更新：2026-10-11。

> 本页只记录已经核实的生产事实、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase migration；不要把旧聊天里的 SHA 当作实时状态。历史阶段以 Git history / 已关闭 PR 为准。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前生产功能基线：`cff7732dcd13ae04b91f966e207a8774085acf9a`，PR #83 `Centralize owner-bound review execution rules` 已 squash merge 到 `main`。
- #83 合并后 `main` 完整 CI run `38150728383`：**success**。
- #83 合并后 GitHub Pages run `38150728500`：**success**；build 与 deploy 均成功，部署源码为 `cff7732d…`。
- #83 合并前最终候选 CI run `38150383732`：**success**；lint、TypeScript、Review execution contract、Smart Session、semantic/AI/OAuth guardrails、build、完整 browser flows、production Pages artifact 与 Pages recovery 全部通过。
- Supabase 项目：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` v15 ACTIVE；#83 未修改 Supabase / MCP / Edge contract。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。
- 当前没有已知发布阻塞。

## #83 Review execution contract：已上线

目的：manual / Smart / correction spelling 原先在 Typing、DB、word-list loader 等位置各自判断，容易出现 owner / legacy / return-route 语义漂移。本轮只统一真实共享的执行契约，不做机械大重构。

已上线规则：

- `src/review/execution.ts` 是现代 spelling review 的共享执行契约；
- `manual / smart / correction` 是现代 review origin；`origin = undefined` 明确保留为升级前 legacy local review，绝不能重新解释成 `manual`；
- 现代 review 必须有持久化 ReviewRecord id；localStorage 中只有冻结词表、却没有 IndexedDB id 的半残状态 fail closed，不直接交给 Typing 执行；
- owner 使用精确相等：登录账号只接受同一 user id；未登录时 `undefined === undefined` 是合法的匿名本机 owner，继续支持免登录 / local-first 学习；
- `useWordList()` 对 manual / smart / correction 一律使用同一 owner 契约，不再只给 manual 做内层 owner 校验；
- `ManualReviewGate` 从 IndexedDB 恢复权威 record，校验 persisted id / exact origin / exact owner / unfinished 后才挂载输入引擎；
- manual review 失效后的返回路径固定为 `/practice?mode=spelling`，不会因为上次保存的 semantic practice 偏好被带到错误训练；
- Gallery 原有 continuation 仍只读取 origin-less legacy review，不改变旧数据语义；
- `scripts/check-review-execution.mjs` 已进入主 CI，覆盖 legacy、persisted id、匿名 owner、登录 owner、跨 owner 拒绝和三种返回路径。

Review / 验证中曾发现两个真实问题并已修复：

1. 第一版 helper 错把 `ownerUserId = undefined` 当成非法，会破坏匿名 manual / Smart / correction；已改为 exact-owner equality，并加入 deterministic regression。
2. owner helper 最初只返回 boolean，TypeScript 无法对 DB record 做静态窄化；已改为 type predicate，最终 TypeScript 与完整浏览器链通过。

#83 不迁移、不重写历史 ReviewRecord，不修改 Learning Fact schema，也没有制造任何用户学习历史。

## #82 Control runtime / Reading route-state：已上线

PR #82 已进入生产并保持在 #83 之后的基线上。

### Remote Control

- device ID：`localStorage → sessionStorage → document memory` 降级；
- auth 初始化有 generation guard；
- heartbeat / pending / claim / finish 使用 browser-only owner-bound RPC；
- claim 与 `start_task` 异步边界后继续检查 owner + generation，账号切换 fail closed；
- generic command-bus / MCP-OAuth RPC 保持不变；command completion 仍不等于 learning completion。

生产 migration `20261011_000028_control_runtime_owner_binding.sql` 已部署并完成 6 场景 rollback verification；migration 文件已在 `main`，**不要重复 rollout**。

### Reading 实验

Reading 仍是 **实验阶段**。现有修复只保证 route / passage / owner 切换时，旧 draft / timer / answers / in-flight submission 不污染新访问；快速 `A → B → A` 也不能让旧提交误删 replacement draft 或覆盖新页面状态。Reading 尚未升级成正式主学习闭环。

## 已上线核心能力

### Vocabulary / Practice

- 正常章节拼写；owner-aware Smart / manual / correction spelling；顺序冻结、cursor 权威、刷新恢复；
- 专项训练：拼写、英文 → 中文词义主动回想、选择词义；
- 词池：当前章节、已练过、拼写错词、词义模糊；未完成专项 run 可恢复；
- Today 快捷入口显式携带专项范围；短尾章 semantic discrimination 可使用同词书有界真实干扰项；
- dictionary registry 稳定 ID / duplicate fail-fast；正常章节只有一个权威内容源。

### Learning Facts / Evidence

- Learning Events local-first；明确 owner 的事实进入对应账号上传队列；
- `word_attempted` 只代表真实拼写事实；零错误不等于语义掌握；
- `semantic_recall_attempted` 与 `semantic_discrimination_attempted` 是独立证据；objective discrimination 不等于 free recall / contextual comprehension / mastery；
- Coaching Context v1.5 继续分开 spelling / recall self-report / objective discrimination；
- browser upload / pull 已在数据库 RPC 边界绑定 captured owner；in-flight sync 按 owner 隔离。

### Smart Session / AI Coach

- Smart Session：`elastic-v2`；
- Learning Intent precedence：`session > day > ongoing > local defaults`；
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与真实 executor availability；
- AI 只判断未来策略；deterministic planner / executor 负责可执行约束与真实完成判定。

### Cloud Plan / Workspace State

- Cloud Plan 当前真实可执行 task kind **只有 `chapter`**；completion 只能由 matching immutable learning fact 推导；
- Workspace State v1 只承担跨设备工作区连续性，不是 Learning Fact；
- Sync 页显式“保存本机位置 / 恢复云端位置”；browser-native RPC 在数据库边界绑定 owner。

## ErrorBook / Analysis 当前性能边界

2026-10-11 已只读复查，暂时**不做机械 owner-index 改写**：

- ErrorBook 当前读取全部 `word_attempted` facts + legacy WordRecords，是为了 `visibleSpellingAttemptsWithLegacy()` 能在**所有 owner** 中寻找 companion fact；若只查当前 owner，另一个账号已经产生的新事实可能被当前账号再次当成 legacy WordRecord 显示，形成跨账号活动侧漏；
- Analysis 已按 `occurredAt` 时间窗口走索引，再在窗口内做同一 legacy companion 去重；不是简单漏用了 owner index；
- Dexie v9 已有 `[ownerUserId+eventType]`、`[ownerUserId+occurredAt]`，但在没有新的“跨 owner companion identity”设计前，不能为了减少读取量破坏 legacy 去重语义；
- 后续只有在真实数据量证明这里成为瓶颈时，才考虑专门的 companion identity / compound index 或安全的两阶段查询。当前优先正确性与账号隔离。

## 不可破坏边界

主闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

必须继续保持：

- Historical learning truth immutable；
- Only the user confirms long-term strategic stage changes；
- AI controls future intent, never past truth；
- No evidence != mastery；Spelling != semantic mastery；
- Objective discrimination != free recall / contextual comprehension / mastery；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan works without AI；网络失败时尽量仍可本地学习；
- 未登录用户仍可使用本机学习能力；owner 隔离不能以破坏 anonymous local-first 为代价；
- 不增加万能 `run_sql / execute_js / control_wenyan`；
- 不伪造个人学习历史、完成记录、掌握率、联网状态或验证结果。

## 下一阶段高价值工作

1. 继续检查 `Typing/index.tsx`、ResultScreen 与 DB save layer 剩余的 review-origin 重复判断；只在确实属于执行安全规则时复用 #83 helper，不机械统一纯展示逻辑。
2. 用真实用户自然产生的 semantic recall / objective discrimination 完成 `local → sync → MCP v1.5 → coaching` 纵向验收；禁止 synthetic personal history。
3. 自然出现新的 chapter Cloud Plan 时，再做一次真实 owner / revision / fingerprint → 真练习 → sync → completion smoke。
4. 继续打磨更高质量语义测量：contextual meaning、熟词僻义、collocation / phrase、Chinese → English production；先研究证据语义与练习价值，再决定 UI。
5. Reading 正式主闭环与真实考研题库继续作为下一产品阶段；不要把实验入口包装成已完成能力。
6. 文学专业课继续冻结；当前先把英语体验做深、做稳、做成适合长期日用的桌面学习工具。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 先读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migrations 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`CLOUD_PLAN_V2.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排沿 `Learning Intent → Smart Session` 演进；Cloud Plan 只承载 explicit commitment；
5. 优先历史真实性、账号隔离、恢复一致性、长期可用性和真实纵向学习价值链，不继续堆零散功能；
6. 每个高价值阶段小批次 commit + push，GitHub 必须始终保留可续接状态。
