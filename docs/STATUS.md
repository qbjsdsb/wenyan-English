# 当前状态 / 续接入口

更新：2026-10-11。

本页只保留 **当前已核实的生产事实、不可破坏边界、正在收口的变更和下一步缺口**。历史阶段与旧 PR 结论请看 Git history；不要把旧聊天记忆当作生产状态。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 当前生产 `main`：`9be1f2876a8afe7c19d95fbde096996399fb8d37`（PR #71，Workspace State v1）。
- main CI run `38096486832`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、浏览器流程、production Pages build 与 Pages recovery checks 全部通过。
- GitHub Pages run `38096486851`：**success**，部署源码同为 `9be1f287…`。
- Supabase：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**；#63–#72 未修改 MCP/Edge tool contract。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。

### 2026-10-10 / 11 Existing Experience Closure 已进入主干

- #63：Smart spelling owner-bound cursor / stable order / fail-closed；ErrorBook、Analysis、词库进度重新对齐 immutable facts 与 legacy compatibility。
- #64：Vite build fallback、Docker/Yarn 可复现构建、Wenyan backup 命名。
- #65：Dexie v9 owner-aware Learning Event 索引；Today/Practice/Smart Session 高频读取按 owner 收敛。
- #66：正常章节统一使用唯一词书内容源，删除 CET4 第一章硬编码双真相。
- #67：只有真实存在 executor 的学习阶段可确认；Reading / Exam 保持 roadmap，不假装上线。
- #68：Smart Session 样式不再依赖中文 aria 文案。
- #69：Realtime presence 首次连接发布最新设备状态，不发布订阅开始时的旧闭包状态。
- #70：Today 专项快捷入口显式携带并展示上次词池/数量；Today 当日事实使用 owner + time 索引；Reading 入口明确标为“阅读实验”。
- #71：Workspace State v1；显式保存 / 恢复当前词书、章节和专项偏好，账号切换 / stale read / ambiguous save / 本机部分写失败均 fail closed。

## Workspace State v1：已上线

Workspace State 只承担跨设备工作区连续性，不是 Learning Fact，也不属于长期 Learning Preference。

生产事实：

- migration `workspace_state_v1` 已应用，生产 migration version `20261010185505`；
- 每个用户最多一条 `wenyan_workspace_state`；内容仅为 `dictId / chapterIndex / practiceMode / practicePool / practiceLimit`；
- Sync 页提供 **“保存本机位置” / “恢复云端位置”** 两个明确动作；v1 不做自动 last-write-wins；
- browser-native session 通过 `p_expected_user_id = auth.uid()` 绑定 owner；OAuth client 不允许写 workspace；
- restore 前验证词书 / 章节 / 专项偏好，并在本机持久化失败时回滚；
- mounted `SyncPage` 浏览器回归已覆盖账号切换、TOKEN_REFRESHED、旧读取晚到、保存响应不确定后重读以及本机回滚；
- migration 上线验收时 workspace 表为 0 行，没有测试数据污染生产；相关 RLS / RPC 未被 Supabase advisor 报新增问题；
- PR #71 合并后的 main CI 与 Pages 均已再次通过。

## 正在收口：Learning Facts owner binding（PR #72）

目的：把 Workspace 审计中发现的同类账号竞态继续收紧到最重要的历史真相层。浏览器可能先捕获账号 A，再在 RPC 真正执行前切到账号 B；Learning Facts 不能依赖返回后的 UI 检查来防串号。

当前实现：

- web upload 使用 `ingest_learning_events_for_owner(p_expected_user_id, p_events)`；
- web pull 使用 `pull_learning_events_for_owner(p_expected_user_id, ...)`；
- 两个 wrapper 均为 `SECURITY INVOKER`，要求 `p_expected_user_id = auth.uid()` 且仅允许 direct Wenyan browser session；
- 原 generic Learning Event RPC 暂时保留，避免破坏现有 MCP / OAuth read contract；
- sync batch 先解析同一个稳定 session/user snapshot；session 与 `getUser()` 不一致时 fail closed；
- in-flight upload / data sync 按 owner 分桶，账号切换不再共享一个全局 Promise；
- owner mismatch 不把原账号的 immutable local facts 标成网络失败，也不增加 retry backoff；它们保持 pending，等原账号下次重试；
- 初始 `getSession()` 通过 auth generation gate 防止晚到结果覆盖更新后的本机 owner marker；
- `supabase/verification/learning_sync_owner_binding.sql` 保存生产负向验收脚本。

### #72 当前真实 rollout 状态

- PR head 在写本页前为 `1ae6ed59…`；完整 CI run `38097051190`：**success**，包括 browser flows 与 Pages recovery；
- migration `learning_sync_owner_binding` 已于 2026-10-11 正式应用，生产 migration version `20261011000645`；
- 生产函数核验：
  - `ingest_learning_events_for_owner(uuid,jsonb)`：`SECURITY INVOKER`，authenticated execute=true，anon/public=false；
  - `pull_learning_events_for_owner(uuid,timestamptz,uuid,integer)`：`SECURITY INVOKER`，authenticated execute=true，anon/public=false；
- 上线后负向 / 兼容验收全部通过：
  1. direct session + matching owner：允许空 ingest；
  2. token owner A + expected owner B：以 `learning_owner_changed` 拒绝；
  3. OAuth-shaped token 调 browser wrapper：以 `direct_wenyan_session_required` 拒绝；
  4. 旧 generic `pull_learning_events` 在 OAuth-shaped claims 下仍可调用；
- Supabase security / performance advisor 对 000026 新函数没有新增 finding。当前 advisor 仍提示项目早期 private 表无 policy、三个旧 `SECURITY DEFINER` RPC 可由 authenticated 执行、leaked-password protection 未开启以及若干 unused index；这些不是 #72 引入，后续单独审计，不借 #72 顺手改旧基础设施；
- **前端 owner-bound Learning Sync 尚未合并到 main**。正确顺序仍为：production wrapper 已就绪 → 最新 head CI / review → merge #72 → main CI / Pages 再验收。

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

- Learning Events：local-first；只有明确 owner 的事实进入对应账号上传队列；云端 pull 可恢复缺失事实；
- 未归属旧本机事实需要显式认领；
- ErrorBook / Analysis / 已练章节从当前账号可见事实重新派生；
- Dexie v9 为长期事实读取增加 owner-aware 索引；
- 普通章节和 owner-bound review 都有明确恢复边界；保存失败不会静默推进；
- 词书有校验后的 last-known-good CacheStorage fallback；不是完整 PWA；
- 本地备份先 staging validate 再覆盖真实 DB；
- Workspace State v1 已在生产，用于显式跨设备恢复非证据工作区状态；
- #72 merge 后 Learning Event browser upload / pull 将与 Workspace 一样在数据库 RPC 边界绑定 captured owner。

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

1. **完成 PR #72 frontend rollout**：最新 head CI + Codex review → merge → main CI / Pages；production 000026 已就绪并验收。
2. **Browser owner concurrency closure v2**：复用 #72 的 captured-owner 模式继续检查 Cloud Plan browser cache、Learning Preferences 与 Control Runtime；优先修真正会影响 owner/cache 的路径，不重写 MCP/OAuth 架构。
3. **词库 registry 完整性**：修复 `frequently_used_words02/03` 重复 ID；让 registry 拒绝重复 ID 与原型链伪词书，避免持久化异常值破坏 current dictionary。
4. **现有训练可用率 / 恢复**：选择词义的真实同词书 distractor pool、Reading 实验 passage/version 切换状态重置、owner-bound review 规则统一。
5. **长期性能**：Analysis / ErrorBook 继续审计 owner-aware index 的安全使用；legacy 去重需要跨 owner companion facts，不能为了快重新制造跨账号泄漏。
6. **真实用户语义回流验收**：本人真实 semantic recall / objective discrimination → sync → MCP v1.5 读到真实 evidence；禁止制造 synthetic personal history。
7. **真实用户 Cloud Plan smoke**：自然出现新的 chapter Plan 时，验证 owner/revision/fingerprint → 真练习 → sync → `get_plan_status` completion。
8. **更高质量语义测量**：contextual meaning、熟词僻义、collocation / phrase、Chinese→English production；继续保持 measurement 分离。
9. **Reading 主闭环**：可信 provider → validation → candidate → stage gate → Smart Session → Runner → facts → evidence → Coaching Context；未完成前保持实验状态。
10. FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 重新读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migrations 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`CLOUD_PLAN_V2.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排沿 `Learning Intent → Smart Session` 演进；Cloud Plan 只承载 explicit commitment；
5. 优先真实纵向学习价值链与跨设备连续性，不继续堆零散功能；
6. 每个高价值阶段小批次 commit + push，GitHub 必须始终保留可续接状态。
