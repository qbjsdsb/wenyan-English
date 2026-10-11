# 当前状态 / 续接入口

更新：2026-10-11（#82 已完成；#83 review execution contract 正在收口）。

> 本页只记录已经核实的生产事实、当前候选工作的真实验证状态、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase migration；不要把旧聊天里的 SHA 当作实时状态。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前生产功能发布基线：`69dc02a35900450c5951c30323f97beb657ff227`，PR #82 已 squash merge 到 `main`；之后 `main` 只有 `05ca8beccb1a08fc34e55d93e65bab2405000761` 的 STATUS 文档收尾提交。
- #82 合并后 `main` 完整 CI run `38148496381`：**success**。
- #82 合并后 GitHub Pages run `38148496373`：**success**；build 与 deploy 均成功，部署源码为 `69dc02a359…`。
- #81 的设置、备份恢复、短尾章词义训练、SPA 词义状态隔离、词义查询与发音参数修复已经在 #82 之前进入主干并保持不变。
- Supabase 项目：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` v15 ACTIVE；本轮 Remote Control / Reading 收口没有修改 MCP tool contract。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。
- 被 #82 取代的旧 PR #76、#78、#79 已全部关闭，避免后续误合旧实现。
- 当前生产没有已知发布阻塞。

## 2026-10-11 进行中：PR #83 Review execution contract

PR #83：`Centralize owner-bound review execution rules`，分支 `fix/review-execution-contract`。

当前候选 head：`d92b6e136a6b8d04eeb02f58f0a1482ad567d8dd`。本节描述候选分支，不代表已经进入生产。

已经完成的候选改动：

- 新增 `src/review/execution.ts`，把现代 spelling review 的 origin 判定、owner 精确匹配、legacy 判定与退出路径收成单一契约；
- `origin = undefined` 明确保留为旧版 local review，不能被重新解释为 `manual`；
- `manual / smart / correction` 只有在存在持久化 ReviewRecord id 时才作为现代可执行 review；localStorage 中缺 id 的半残状态 fail closed，不直接把冻结词表交给 Typing；
- owner 使用**精确相等**：登录账号只接受同一 user id；未登录时 `undefined === undefined` 是合法的匿名本机 owner，继续支持免登录/离线学习；
- `useWordList()` 不再只给 `manual` 做 owner 校验，三种现代 review 都必须通过同一 owner 契约；
- `ManualReviewGate` 从 IndexedDB 恢复权威记录，校验 exact origin / owner / persisted id / unfinished 状态后才挂载输入引擎；
- manual review 失效后的返回路径统一为 `/practice?mode=spelling`，不会被上次保存的 semantic practice 模式带到错误训练；
- Gallery 原有 continuation 仍只读取 origin-less legacy review，不改变旧数据语义；
- `scripts/check-review-execution.mjs` 已加入现有 CI，锁住 legacy、persisted id、匿名 owner、登录 owner、跨账号拒绝与三种返回路径。

Review 已发现并修复一个重要 P1：第一版 helper 错把 `ownerUserId = undefined` 当成非法，实际上匿名用户原本就可以创建 manual / Smart / correction 本机 review。该问题已在 `d92b6e13…` 修正，并补进 deterministic contract check。

### 当前验证状态

- #83 最终 head 的完整 CI **尚未完成**；在最新 CI 结束前不得把本节改写为“已验证/已上线”。
- 上一生产基线 #82 的 CI / Pages 仍为 success，但不能替代 #83 候选验证。
- #83 不修改 Supabase schema、MCP/Edge Function、Learning Fact schema，也不迁移或重写历史 ReviewRecord。
- 当前无已知产品硬阻塞；剩余动作是等待最新 CI、处理仍有效的 review thread、合并后复验 main CI / Pages，再把本节改成生产事实。

## 2026-10-11 收口：#82 已完成

PR #82：`fix: close control runtime and reading route state` 已正式进入生产主干。

完整验证已经通过：

- lint、TypeScript；
- Smart Session / Execution Availability；
- Semantic guardrails；
- AI Coaching / Coach Decision / Cloud coaching adapter；
- OAuth capability；
- build；
- 完整 browser flows；
- production Pages artifact build；
- Pages vocabulary / failure recovery。

control runtime 与 Reading route-state 的 focused Playwright 回归均已纳入主 CI。Reading 回归真实覆盖提交期间快速 `owner A → B → A` 时，旧提交不能覆盖新访问状态或误删 replacement draft。

### Remote Control captured-owner closure

已经实现并验证：

- device ID 按 `localStorage → sessionStorage → document memory` 降级；localStorage 被阻止时，同一 tab reload 仍保持稳定 identity。
- auth 初始化复用 generation gate，晚到的 `getSession()` 不能覆盖更新后的 auth callback。
- heartbeat / pending / claim / finish 使用 owner-bound browser RPC，并携带 captured owner。
- command 在 claim 返回后以及 `start_task` 异步边界后重新检查 owner + generation；账号切换时 fail closed，不允许账号 A 的 command 修改账号 B 的页面状态。
- generic command-bus / MCP-OAuth RPC 保持不变，没有为浏览器便利破坏通用 contract。

### 生产 migration 000028：已部署并验收

`supabase/migrations/20261011_000028_control_runtime_owner_binding.sql` 已应用到生产，且 migration 源文件已经随 #82 进入 `main`；**不要重复 rollout**。

生产使用回滚式验证覆盖六个场景，全部 PASS：

1. matching owner 可以正常 claim / execute；
2. command 属于 A、当前账号切到 B 时拒绝；
3. OAuth-shaped client 不能调用 browser-only owner-bound control RPC；
4. 慢执行中的 command 不会被错误重新排队；
5. 过期 executing command 的有效状态保持 terminal / expired 一致；
6. 已过期 command 不能再被 finish 成成功。

migration 前后重新检查 Supabase security advisor，没有新增 finding。项目早期已有的 private-table policy、旧 `SECURITY DEFINER`、leaked-password protection 与 unused-index 提示仍是独立遗留问题；本轮没有为了“清零告警”盲改旧基础设施。

### Reading 实验 route-state 收口

Reading 仍是 **阅读实验**，不是已经完成的主学习闭环。本轮只修复已有实验的真实性与账号隔离：

- runner 捕获 owner；完成记录写回 captured owner，账号切换不会把旧 attempt 归给新账号。
- route / passage / owner generation 改变后，旧 in-flight submission 不能把新页面误切成“已完成”。
- 快速 `A → B → A` 回访时，旧提交不能误删 A 的新 draft，也不能覆盖用户刚恢复的答案。
- Reading 仍不计入“正式主阶段已完成”；后续主闭环需单独设计题源、证据、复习与计划执行。

首轮 Reading CI 失败已经定位为测试注入方式耦合 Dexie 内部 Table 实例，而不是产品提交逻辑失败；最终测试改为在同一个 `db.transaction` 边界暂停提交，不依赖 Dexie 内部表实例，随后 PR CI 与合并后 main CI 均完整通过。

## 已上线的核心能力

### Vocabulary / Practice

- 正常章节拼写；owner-bound Smart / manual / correction spelling；顺序冻结、cursor 权威、刷新恢复。
- 专项训练：拼写、英文 → 中文词义主动回想、选择词义。
- 词池：当前章节、已练过、拼写错词、词义模糊；未完成专项 run 可恢复。
- Today 快捷入口显式携带并显示专项范围；词义训练短尾章不会因为固定数量假设而无题可做。
- 词书 registry 已完成稳定 ID / duplicate fail-fast 收口；正常章节只有一个权威内容源。

### Learning Facts / Evidence

- Learning Events local-first；只有明确 owner 的事实进入对应账号上传队列。
- `word_attempted` 只代表拼写事实；零错误不等于语义掌握。
- `semantic_recall_attempted` 与 `semantic_discrimination_attempted` 是独立证据；objective discrimination 不等于 free recall / contextual comprehension / mastery。
- Coaching Context v1.5 必须继续分开 spelling、recall self-report、objective discrimination，不能制造一个没有证据支持的“总掌握率”。
- browser upload / pull 已在数据库 RPC 边界绑定 captured owner；in-flight sync 按 owner 隔离。

### Smart Session / AI Coach

- Smart Session：`elastic-v2`。
- Learning Intent precedence：`session > day > ongoing > local defaults`。
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与真实 executor availability。
- AI 只负责未来策略判断；deterministic planner / executor 负责可执行约束和真实完成判定。

### Cloud Plan / Workspace State

- Cloud Plan 当前真实可执行 task kind **只有 `chapter`**；Plan completion 只能由 matching immutable learning fact 推导。
- Workspace State v1 已上线，仅承担跨设备的非证据工作区连续性；不是 Learning Fact。
- Sync 页支持明确“保存本机位置 / 恢复云端位置”；browser-native RPC 在数据库边界绑定 owner。

## 不可破坏边界

主闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

必须继续保持：

- Historical learning truth immutable。
- Only the user confirms long-term strategic stage changes。
- AI controls future intent, never past truth。
- No evidence != mastery；Spelling != semantic mastery。
- Objective discrimination != free recall / contextual comprehension / mastery。
- Command completion != learning completion。
- Workspace State != Learning Fact。
- Wenyan works without AI；网络失败时尽量仍可本地学习。
- 未登录用户仍可以使用本机学习能力；owner 隔离不能以破坏匿名 local-first 为代价。
- 不增加万能 `run_sql / execute_js / control_wenyan` 一类工具。
- 不伪造个人学习历史、完成记录、掌握率、联网状态或验证结果。

## 下一阶段高价值工作

1. 完成 #83：等待最终 CI / review，合并后复验 main / Pages，并把 review execution contract 从候选状态更新为生产事实。
2. 在 #83 稳定后，再判断是否值得让 `Typing/index.tsx`、结果页和 DB save layer 的展示/保护性重复判断直接复用 helper；只统一真实共享语义，不机械重构。
3. Analysis / ErrorBook 在保持跨账号隔离的前提下，更安全地利用 owner-aware index；legacy companion 去重必须继续跨 owner 检查，不能为了性能重新制造跨账号泄漏。
4. 用真实用户自然产生的 semantic recall / objective discrimination 完成 `local → sync → MCP v1.5 → coaching` 纵向验收；禁止 synthetic personal history。
5. 自然出现新的 chapter Cloud Plan 时，再做一次真实 owner / revision / fingerprint → 真练习 → sync → completion smoke。
6. 更高质量语义测量（contextual meaning、熟词僻义、collocation / phrase、Chinese→English production）与 Reading 主闭环继续作为后续产品阶段，不与本轮基础稳定性收口混做。
7. 文学专业课继续冻结；当前先把英语体验做深、做稳、做成适合长期日用的桌面学习工具。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 先读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migrations 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`CLOUD_PLAN_V2.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排沿 `Learning Intent → Smart Session` 演进；Cloud Plan 只承载 explicit commitment；
5. 优先历史真实性、账号隔离、恢复一致性、长期可用性和真实纵向学习价值链，不继续堆零散功能；
6. 每个高价值阶段小批次 commit + push，GitHub 必须始终保留可续接状态。
