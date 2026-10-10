# 当前状态 / 续接入口

更新：2026-10-10。

本页只保留 **当前已核实的生产事实、不可破坏边界和下一步缺口**。历史阶段、旧 SHA、旧 PR 状态请看 Git history 与对应专题文档；不要把旧聊天记忆当作当前生产状态。

## 生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 当前前端运行时代码基线：`41b08dd3fa510e1e6b1bbac3415651a6d94e9587`
- 对应 PR：#62 `Bind Cloud Plan runs to task execution identity`
- PR #62 CI #270（run `38037719559`）：success。
- merge 后 main CI #271（run `38037986838`）：success；lint、TypeScript、deterministic learning / coaching / OAuth checks、MCP packaging、browser flows、production Pages build、Pages vocabulary / recovery checks 全部通过。
- GitHub Pages #57（run `38037986842`）：build + deploy success，部署源码为同一 `41b08dd…`。
- Supabase：`cmjhxvpkdeheujuteqoi`。
- 2026-10-10 已应用生产 migrations：`plan_lifecycle_closure`、`plan_run_execution_identity`。
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**；PR #61 / #62 都没有修改或重新部署 Edge Function。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。
- `verify_jwt=false` 仍为有意配置：Edge Function 自己校验 Supabase OAuth JWT 的 JWKS / issuer / audience / session / client / authenticated identity；这不代表匿名开放。

本页之后如出现 docs-only `[skip ci]` commit，运行时代码基线仍以上述 `41b08dd…` 为准，除非新的功能提交明确更新本节。

## 当前架构边界

Wenyan English 的日常主闭环已经稳定为：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

职责必须保持分开：

- **Learning Fact**：真实历史，只能由实际学习执行追加产生；
- **Evidence / Coaching Context**：从 facts 可重算的证据与覆盖说明；
- **Learning Intent**：ChatGPT / 用户对未来一段学习的策略与约束；
- **Smart Session**：根据最新事实与 Intent 即时计算的下一小段；
- **Cloud Plan**：少量明确、持久、可追踪的 commitment / explicit task；
- **Command**：打开页面或启动动作；command completed 不等于 learning completed。

日常使用默认走 `Learning Intent → Smart Session`。Cloud Plan 不再承担 rigid daily list，不冻结每日词表，不制造滚动欠债。

## Plan / Intent 生命周期（PR #61）

已上线：

- `preferredActivities: ['semantic_recall']` 不再被客户端硬覆盖成 vocabulary，可以真正进入 Smart Session planner。
- Today 原“计划”区域已定位为“明确任务”；动态下一段由 Smart Session 负责。
- Cloud Plan 本机缓存绑定 `ownerUserId`；旧无 owner cloud cache 不自动继承当前账号。
- Today 手动开始 cloud task 前会按 planId 重新向 Supabase / RLS 验证 owner、active 状态与 task。
- 同一 owner 最多一个 active Cloud Plan；create 使用 owner 级 transaction advisory lock。
- 新建显式 Plan 会 supersede 旧 active Plan：旧 Plan archive、revision +1，并保留 revision snapshot；不修改 Learning Facts。
- `get_plan_status(null)` 只返回仍有网站可执行、且尚无匹配完成证据的 active chapter Plan；explicit planId 仍可读取 archived / exhausted 历史。
- Plan completion 永远由 immutable matching learning event 推导；Plan row 自己不能声明 completed。

## Cloud Plan run 执行身份（PR #62）

PR #62 补上了 Plan 在“开始以后又被修订”的并发边界。

新 Cloud Plan run 启动时现在捕获：

- `ownerUserId`；
- `planRevision`；
- `taskFingerprint`。

当前唯一可执行 Plan task kind 是 `chapter`，执行 fingerprint 为：

`chapter:<dictId>:<chapterIndex>`

设计语义：

- `planRevision` 记录“这次 run 从哪个 Plan revision 开始”，用于 provenance；
- `taskFingerprint` 判断“当前 task 是否还是同一个真实执行目标”。

fingerprint **故意不包含** title / reason / dueDate / estimatedMinutes。因此：

- 只改截止日期、标题、理由或预计时长，不会无谓作废正在进行的同一章节学习；
- 如果 task 从某词书第 1 章改成另一词书 / 另一章，旧 run 不能再误完成修订后的 task。

新 task-linked `word_attempted` / `chapter_completed` facts 会携带 run 的 `planRevision + taskFingerprint`。客户端恢复云端 fact 时保留这些字段。

生产 `get_plan_status` 已增加 fingerprint guard：

- 新 completion fact 的 fingerprint 必须与当前 task config 一致，才算该 task 的 completion evidence；
- 历史 pre-fingerprint completion facts 保持兼容，不回写历史；
- 生产纯函数核验已确认：同目标匹配=true，改章节匹配=false，历史无 fingerprint=true；
- 没有为了验证插入任何 synthetic personal learning fact。

旧的、升级前正在进行且缺少 owner/revision/fingerprint 的 Cloud Plan run 会 fail closed：普通学习事实仍正常保存，但不会把不可靠 task identity 附成 Cloud Plan completion。

## 当前真实 Plan 能力

网站和 MCP 当前真正可执行 / 可创建的 Cloud Plan task kind **只有 `chapter`**。

数据库早期 migration 中曾预留 `smart_review / word_set / dictation / weak_words / mixed_session` 等枚举；它们不是当前产品能力。不要因为 schema 中存在名字就宣称已实现。Smart review / semantic practice 应优先由 Intent + Smart Session / 专项训练承担，除非未来形成独立、真实的 completion contract。

当前 single-active-per-owner 是 English-first 阶段的有意简化。未来只有在 Literature 或另一真实 domain 确实需要并行 commitments 时，才考虑升级为 `owner + domain/lane`，不要提前复杂化。

## 已上线学习证据

### 拼写

`word_attempted` 表示真实拼写练习事实。零错误拼写不是语义掌握；键间时长不是回忆潜伏期或疲劳指标。

### 词义主动回想

`semantic_recall_attempted` / sourceVersion 4：英文 → 词义的主动心理回想；先回想、再揭示参考释义；`recalled / partial / not_recalled` 是用户自评。自评是 evidence，不是客观正确率或 mastery。

### 客观参考释义辨认

`semantic_discrimination_attempted` / sourceVersion 5：只使用真实、带版本的词书参考释义进行 `reference_meaning_discrimination`。正确只证明本次给定选项中选中了当前参考义；不等于 free recall、contextual comprehension、Chinese→English production、熟词僻义覆盖、collocation knowledge 或 global mastery。

Coaching Context v1.5 必须把 spelling / semantic recall self-report / objective discrimination 保持为不同 evidence channel，不合成无依据的总掌握率。

## Smart Session / AI Coach

- Smart Session：`elastic-v2`。
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 和真实 execution availability。
- Learning Intent precedence：`session > day > ongoing > local defaults`。
- objective semantic discrimination 当前仍是 semantic recall 后的可选 follow-up / direct practice，不是独立 planner purpose。
- per-device execution availability 是运行状态，不是 Learning Fact。

## 日常体验 / 可靠性

当前重要可靠性边界：

- 普通章节保存失败不会静默跳词；真实 chapter completion 等本地事实提交成功后才产生。
- 普通章节存在 owner / dict / chapter / taskRun / content-order-bound 本机 checkpoint；未完成输入按最近已提交词边界恢复。
- 专项支持拼写 / 词义回想 / 选择词义，并保留模式、词池、数量与未完成 run。
- 公开词书有经过校验的 last-known-good CacheStorage fallback；这不是完整 Service Worker / PWA。
- Reading draft owner isolation、备份导入 staging validation、per-device executor availability 已存在；Reading 主学习闭环仍未完成。
- 登录 / 同步 / 退出失败不会永久卡 busy。

## 不可破坏的原则

> **AI controls future intent, never past truth.**

同时保持：

- Historical learning truth immutable。
- Only the user confirms long-term strategic stage changes。
- ChatGPT reasons; deterministic code guards。
- Command completion != learning completion。
- No evidence != mastery。
- Spelling != semantic mastery。
- Objective discrimination != free recall / contextual comprehension / mastery。
- Wenyan works without AI。
- Wenyan should continue without cloud whenever possible。
- 不增加万能 `run_sql / execute_js / control_wenyan` 一类工具。

## 仍未完成 / 下一阶段

这些是当前真正剩下的高价值缺口：

1. **真实用户语义回流验收**：用户本人完成 semantic recall / objective discrimination → 正常同步 → MCP v1.5 读到真实 evidence；禁止制造假个人历史。
2. **真实用户 Cloud Plan smoke**：以后自然出现新的显式 chapter Plan 时，验证 owner/revision/fingerprint → 真练习 → sync → `get_plan_status` completion 全链路；不要为了验收创建无意义生产学习事实。
3. **更高质量语义测量**：contextual meaning、熟词僻义、collocation / phrase、Chinese→English production；继续分开 measurement semantics。
4. **Reading 主闭环**：可信/private provider → validation → eligible candidate → stage gate → Smart Session → Runner → facts → evidence → Coaching Context。
5. **正式红宝书 provider / denominator**：没有可信完整版本前，`observedProgress` 必须保持 null。
6. objective semantic 自动进入 Smart Session、跨设备 objective run 恢复，等待真实使用证据后再决定；当前不是 blocker。
7. FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。
8. 文学专业课继续冻结；未来开发前重新核对目标年份南京师大官方招生科目、考试范围和参考信息。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 先重新读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migrations 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`CLOUD_PLAN_V2.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排沿 `Learning Intent → Smart Session` 演进；Cloud Plan 只承载 explicit commitment；
5. 优先做完整纵向学习价值链，而不是继续无休止 CSS polish；
6. 每个高价值阶段尽早 commit + push，GitHub 必须保留可续接状态。
