# 当前状态 / 续接入口

更新：2026-10-10。

本页只保留 **当前已核实的生产事实、不可破坏边界、正在收口的变更和下一步缺口**。历史阶段与旧 PR 结论请看 Git history；不要把旧聊天记忆当作生产状态。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 当前 `main`：`ee07fef4573db316d433910fcc9141a39e70cb78`（PR #70）。
- main CI run `38057018674`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、浏览器流程、production Pages build 与 Pages recovery checks 全部通过。
- GitHub Pages run `38057018680`：**success**，部署源码同为 `ee07fef…`。
- Supabase：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**；本轮 #63–#70 未修改 MCP/Edge contract。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。

### 2026-10-10 Existing Experience Closure 已合并

- #63：Smart spelling owner-bound cursor / stable order / fail-closed；ErrorBook、Analysis、词库进度重新对齐 immutable facts 与 legacy compatibility。
- #64：Vite build fallback、Docker/Yarn 可复现构建、Wenyan backup 命名。
- #65：Dexie v9 owner-aware Learning Event 索引；Today/Practice/Smart Session 高频读取按 owner 收敛。
- #66：正常章节统一使用唯一词书内容源，删除 CET4 第一章硬编码双真相。
- #67：只有真实存在 executor 的学习阶段可确认；Reading / Exam 保持 roadmap，不假装上线。
- #68：Smart Session 样式不再依赖中文 aria 文案。
- #69：Realtime presence 首次连接发布最新设备状态，不发布订阅开始时的旧闭包状态。
- #70：Today 专项快捷入口显式携带并展示上次词池/数量；Today 当日事实使用 owner + time 索引；Reading 入口明确标为“阅读实验”。

## 正在收口：Workspace State v1（PR #71）

目的：学习事实已经能跨设备恢复，但“当前词书 / 章节 / 专项模式与范围”不属于 Learning Fact，也不属于长期 Learning Preference，需要独立的小型工作区状态。

当前设计：

- 每个用户最多一条 `wenyan_workspace_state`；
- 只包含 `dictId / chapterIndex / practiceMode / practicePool / practiceLimit`；
- Sync 页提供 **“保存本机位置” / “恢复云端位置”** 两个明确动作；
- v1 **不做自动 last-write-wins**，避免一台旧设备静默覆盖另一台；
- Workspace State **不是学习证据**，不会产生、修改或删除 Learning Facts；
- browser-native authenticated session 可读写自己的 row；OAuth client 明确拒绝；
- restore 前验证词书/章节，本地专项偏好写入失败则 fail closed；
- 账号切换使用 user + request generation guard，旧账号的晚到 RPC 不能覆盖当前账号状态。

截至当前：

- migration SQL 已在真实生产 Postgres 中通过 `BEGIN … ROLLBACK` 预演；SQL / RLS / function 定义可解析，rollback 后确认未留下表；
- **生产 migration 尚未应用**，因此当前线上网站仍不依赖 workspace RPC；
- PR #71 正在完成最新 head 的 CI / review；只有全绿后才允许生产 apply → advisor → frontend merge；
- 应用后必须再次更新本节为真实生产结果，不能把计划写成已上线。

## 当前架构边界

日常主闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

职责保持分开：

- **Learning Fact**：真实历史，只能由实际学习执行追加产生；
- **Evidence / Coaching Context**：从 facts 可重算的证据；
- **Learning Intent**：未来一段学习的策略约束；
- **Smart Session**：根据最新事实与 Intent 即时计算下一小段；
- **Cloud Plan**：少量明确、持久、可追踪的 explicit commitment；
- **Command**：页面/动作控制；command completed != learning completed；
- **Workspace State**：非证据的设备连续性状态；workspace restored != learning happened。

> **AI controls future intent, never past truth.**

## 当前真实学习能力

### 词汇执行

- 正常章节拼写；
- owner-bound Smart / manual / correction spelling，顺序冻结、cursor 权威、刷新可恢复；
- 专项：拼写 / 词义回想 / 选择词义；
- 词池：当前章节 / 已练过 / 拼写错词 / 词义模糊；
- 未完成专项 run 可恢复；Today 快捷入口会明确显示并携带当前专项范围。

### 学习证据

- `word_attempted`：真实拼写事实；零错误不等于语义掌握；
- `semantic_recall_attempted` sourceVersion 4：英文 → 词义主动回想，自评仅作为独立 evidence；
- `semantic_discrimination_attempted` sourceVersion 5：真实版本化词书释义的客观辨认；正确不等于 free recall / contextual comprehension / mastery。

Coaching Context v1.5 必须继续把 spelling / recall self-report / objective discrimination 分开，不合成无依据的“总掌握率”。

### Smart Session / AI Coach

- Smart Session：`elastic-v2`；
- Learning Intent precedence：`session > day > ongoing > local defaults`；
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与真实 executor availability；
- objective discrimination 仍主要作为 direct practice / follow-up，不假装已经是独立 planner purpose。

### Cloud Plan

当前真实可执行 task kind **只有 `chapter`**。

Cloud Plan run 捕获 owner / planRevision / taskFingerprint；chapter fingerprint 为 `chapter:<dictId>:<chapterIndex>`。标题、理由、预计时长、截止日期变化不作废同一真实章节目标；目标章节变化则旧 run 不能误完成新 task。Plan completion 只能由 matching immutable learning fact 推导。

## 同步 / 本机边界

- Learning Events：local-first，登录后只上传明确属于当前账号的事实；云端 pull 可恢复缺失事实；
- 未归属旧本机事实需要显式认领；
- ErrorBook / Analysis / 已练章节从当前账号可见事实重新派生；
- Dexie v9 为长期事实读取增加 owner-aware 索引；
- 普通章节和 owner-bound review 都有明确恢复边界；保存失败不会静默推进；
- 词书有校验后的 last-known-good CacheStorage fallback；不是完整 PWA；
- 本地备份先 staging validate 再覆盖真实 DB；
- Workspace State v1 当前仍在 PR #71，生产未应用（见上）。

## 产品真实性

- Vocabulary 是当前正式主阶段；
- Reading 主闭环仍未完成，只保留 **阅读实验** 入口；
- Exam Practice 尚未开放；
- 设置页会展示未来路线，但不会允许把不存在的 executor 当作已上线能力；
- 文学专业课继续冻结，当前只把英语现有体验做深做稳。

## 不可破坏原则

- Historical learning truth immutable；
- Only the user confirms long-term strategic stage changes；
- ChatGPT reasons; deterministic code guards；
- No evidence != mastery；
- Spelling != semantic mastery；
- Objective discrimination != free recall / contextual comprehension / mastery；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan works without AI；
- Wenyan should continue without cloud whenever possible；
- 不增加万能 `run_sql / execute_js / control_wenyan` 一类工具；
- 不再无休止叠加 CSS polish。

## 下一阶段高价值缺口

1. **完成 PR #71 rollout**：latest CI + Codex review → production migration → RLS/grants/functions verify → Supabase security/performance advisors → merge → main CI/Pages → 更新本页最终 production baseline。
2. **真实用户语义回流验收**：本人真实 semantic recall / objective discrimination → sync → MCP v1.5 读到真实 evidence；禁止制造 synthetic personal history。
3. **真实用户 Cloud Plan smoke**：自然出现新的 chapter Plan 时，验证 owner/revision/fingerprint → 真练习 → sync → `get_plan_status` completion。
4. **更高质量语义测量**：contextual meaning、熟词僻义、collocation / phrase、Chinese→English production；继续保持 measurement 分离。
5. **Reading 主闭环**：可信 provider → validation → candidate → stage gate → Smart Session → Runner → facts → evidence → Coaching Context；未完成前保持实验状态。
6. **正式词表 provider / denominator**：没有可信完整版本前，`observedProgress` 继续保持 null。
7. FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 重新读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migrations 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`CLOUD_PLAN_V2.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排沿 `Learning Intent → Smart Session` 演进；Cloud Plan 只承载 explicit commitment；
5. 优先真实纵向学习价值链与跨设备连续性，不继续堆零散功能；
6. 每个高价值阶段小批次 commit + push，GitHub 必须始终保留可续接状态。
