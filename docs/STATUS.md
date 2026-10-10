# 当前状态 / 续接入口

更新：2026-10-10。

本页只保留 **当前已核实的生产事实、不可破坏边界和下一步缺口**。历史阶段、旧 SHA、旧 PR 状态请看 Git history 与对应专题文档；不要把旧聊天记忆当作当前生产状态。

## 生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 当前前端运行时代码基线：`84b4f6e19989d71d59bc07b0a7712ae0be3e913d`
- 对应 PR：#61 `Close Plan lifecycle and Learning Intent execution gaps`
- PR head CI #268：success。
- merge 后 main CI #269（run `38036616370`）：success；lint、TypeScript、deterministic learning / coaching / OAuth checks、MCP packaging、browser flows、production Pages build、Pages vocabulary / recovery checks 全部通过。
- GitHub Pages #56（run `38036616364`）：build + deploy success，部署源码为同一 `84b4f6e…`。
- Supabase：`cmjhxvpkdeheujuteqoi`。
- 2026-10-10 已应用生产 migration：`plan_lifecycle_closure`。
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**；本轮没有修改或重新部署 Edge Function。
- MCP server contract 仍为 0.8.x；Coaching Context：`coaching-context-v1.5`。
- `verify_jwt=false` 仍为有意配置：Edge Function 自己校验 Supabase OAuth JWT 的 JWKS / issuer / audience / session / client / authenticated identity；这不代表匿名开放。

本页之后如出现 docs-only closure commit，运行时代码基线仍以上述 `84b4f6e…` 为准，除非新的功能提交明确更新本节。

## 2026-10-10 Plan / Intent 生命周期收口（PR #61）

### 已实现

- **Learning Intent 真正进入执行器**：客户端不再把已经校验通过的 `preferredActivities: ['semantic_recall']` 强制覆盖成 `['vocabulary']`。ChatGPT 的词义回想策略现在可以到达 deterministic Smart Session planner。
- **职责正式收口**：
  - Learning Fact = 真实历史；
  - Learning Intent = 未来策略 / 约束；
  - Smart Session = 此刻下一小段的动态执行计划；
  - Cloud Plan = 少量明确、持久、可追踪的 commitment / explicit task；
  - Command = 打开页面或启动动作，不代表学习完成。
- **Today 信息架构**：原“计划”区域改为“明确任务”，并明确说明智能学习会按当前策略实时生成下一段。旧 rigid Plan 不再承担每日动态编排职责。
- **Cloud Plan 本机缓存绑定账号**：缓存写入 `ownerUserId`；旧的无 owner 云缓存不会被猜测归属到当前账号，只有成功从 Supabase / RLS 重新拉取后才成为当前可执行云任务。
- **手动启动云任务前重新验证**：Today 不再直接相信 Dexie 中的旧云缓存；点击开始时会按 plan id 重新向 Supabase 读取并通过 RLS 验证，确认 owner、active 状态与 task 仍有效后才创建本机 run。
- **Today 只展示当前账号真正可执行的 Cloud Plan**：已完成 / 已归档 / 非当前 owner 的云计划不再占据当前任务区；local/import portable task 仍保留原行为。

### Cloud Plan 生产生命周期

`plan_lifecycle_closure` 已应用并核验：

- `study_plans_one_active_per_user_idx` 为 partial unique index：同一 owner 最多一个 `status='active'` 的 Cloud Plan。
- `create_study_plan` 使用 owner 级 transaction advisory lock，避免并发 create 产生两张 active Plan。
- 新建显式 Plan 时，已有 active Plan 会被 supersede：旧 Plan 归档、revision +1，并写入 `study_plan_revisions` snapshot；不会修改任何 Learning Fact。
- `get_plan_status(null)` 现在只返回至少有一个当前网站能够执行、且没有匹配真实完成证据的 active `chapter` task。
- `get_plan_status(explicitPlanId)` 仍可读取 archived / exhausted 历史，历史没有被删除。
- Plan response 增加 derived `lifecycle` / `taskSummary`；完成仍只能由匹配 immutable `chapter_completed` evidence 推导，Plan row 不能自己伪造 completed。
- 生产数据核验时仍保留一张历史 active row `今日30分钟英语学习`，但其 actionable chapter task = 0、completed chapter task = 1；因此它不再被默认当作当前 Plan。下一次自然创建新的显式 Plan 时会按新规则 supersede / archive 它。没有为了清表而改写历史。

### 验证

- 新增 browser regression：Cloud Learning Intent 指定 `semantic_recall`，在存在真实形态的 owner-bound spelling fixture 时，Today 必须生成“词义回想” block，并进入 semantic runner，而不能退回 vocabulary。
- 原 Study Plan browser truthfulness tests 保留：导入不能伪造完成、启动不等于完成、错章节不能完成、skip 不能完成、真实练完才产生 matching completion evidence。
- PR #61 CI #268 全绿；merge 后 main CI #269 再次全绿。
- Supabase production preflight 确认不存在多 active owner；migration apply success；随后核验 unique index、owner lock、supersede revision 与 actionable filtering 均存在。
- Pages #56 已从 merge commit 成功发布。
- 没有生成任何生产 synthetic learning fact；没有为了验收伪造用户个人学习历史。

### 本轮未改

- Typing / Qwerty 核心引擎未重写。
- 词义 sourceVersion 4 / 5 的事实语义未改变。
- MCP / OAuth authority 未扩大。
- Edge Function v15 未重部署。
- Reading 主闭环未扩张。
- 文学专业课继续冻结。

## 当前产品形态

Wenyan English 现在的主闭环是：

> **Local-first deterministic learning runtime + ChatGPT strategy brain**

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → Smart Session / explicit Plan → 本地执行 → 新事实回流`

Wenyan 负责真实内容、执行器、离线能力、学习事实、权限与硬约束；ChatGPT 负责解释证据、制定未来策略和可逆安排；MCP 负责受限、可验证的连接。

日常使用默认应优先走：

`Learning Intent → Smart Session`

Cloud Plan 只用于真正需要明确 due date / task identity / completion evidence / 跨设备持久存在的任务，不再用来冻结每日词表或制造滚动欠债。

## 已上线学习证据

### 拼写

`word_attempted` 表示真实拼写练习事实。零错误拼写不是语义掌握；键间时长不是回忆潜伏期或疲劳指标。

### 词义主动回想

`semantic_recall_attempted` / sourceVersion 4：

- 英文 → 词义的主动心理回想；
- 先回想、再揭示参考释义；
- `recalled / partial / not_recalled` 是用户自评；
- 自评是证据，但不是客观正确率或 mastery。

### 客观参考释义辨认

`semantic_discrimination_attempted` / sourceVersion 5：

- measurement：`reference_meaning_discrimination`；
- 每题只使用真实、带版本的词书参考释义；
- 至少 4 个安全且不同的参考项才出题；
- 不使用 LLM 生成假释义 / 假干扰项；
- 选择结果可以客观判分；
- 事实与题目游标原子保存；
- 云端上传与回拉 parser 已上线；
- Coaching Context v1.5 将 objective discrimination 与 semantic recall self-report 分开表达。

客观辨认正确只证明用户在本次给定选项中选择了当前版本词书的参考释义；它不等于自由回忆、语境理解、产出能力、熟词僻义覆盖、搭配能力或全局 semantic mastery。

## Smart Session / AI Coach

- Smart Session：`elastic-v2`。
- 当前可以稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、预算、hard stop、new-word ceiling 与真实执行可用性。
- objective semantic discrimination v1 当前仍是 semantic recall 完成后的可选后续，不是新的 Smart Session planner purpose；这是有意的渐进 rollout。
- Learning Intent scope：`session > day > ongoing > local defaults`。
- 支持的 Intent activity 在客户端经过 capability / enum 校验后应保持原意，不得再被 adapter 无理由重写。
- Cloud Plan 完成只认匹配 immutable learning fact 的 completion evidence。
- 网站命令 completed 只说明浏览器动作执行，永远不等于学习完成。
- per-device execution availability 已上线；多设备时应使用目标设备自己的短期执行状态，不把运行状态当学习证据。

## ChatGPT / MCP

高层入口优先使用 `get_coaching_context`，并按需下钻到学习概览、弱词、单词历史、Intent、Cloud Plan 与设备状态。

Coaching Context v1.5 能区分：

1. spelling evidence；
2. semantic recall self-report；
3. objective reference-meaning discrimination；
4. execution availability / device state；
5. active future intent / explicit plan；
6. 数据覆盖、截断、未同步与不确定性。

Agent 不得把这些不同 measurement 压成一个没有依据的“掌握率”。

## 日常体验 / 可靠性

当前已经上线的重要可靠性边界：

- 普通章节保存失败不会静默跳到下一词；章节完成等待事实真正提交。
- 普通章节存在 owner / 词书 / chapter / taskRun / content-order-bound 本机 checkpoint；未完成输入仍按最近已提交词边界恢复。
- 专项训练支持拼写 / 词义主动回想 / 参考释义四选一，并保留模式、词池、数量与未完成 run。
- 表单 / 按钮 / IME / 设置区不被学习快捷键劫持。
- 公开词书具备经过校验的 last-known-good CacheStorage fallback。
- `/gallery` 使用 Gallery-N，并有搜索与键盘安全导航。
- review chapter `-1` 不计入普通章节覆盖；章节覆盖是 practiced chapters，不是 mastery。
- Error Book / Analysis / Sync 的空状态、失败恢复和 busy state 已做过针对性收口。
- Reading draft owner isolation、备份导入 staging validation、per-device executor availability 已完成。
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

这些是当前真正剩下的高价值缺口，不要机械清空旧 TODO：

1. **真实用户回流验收**：用户本人完成一次语义练习 / objective discrimination → 正常同步 → MCP v1.5 再读真实 evidence。禁止为了验收写假个人历史。
2. **真实用户 Plan / Intent smoke**：刷新生产 Today，确认历史 exhausted Plan 不再占据“明确任务”；以后出现自然的新显式 Plan 时再验证 supersede revision，不为了测试制造无意义生产任务。
3. **更高质量语义测量**：contextual meaning、熟词僻义、collocation / phrase、Chinese→English production；继续分开 measurement semantics，不做万能 mastery score。
4. **Reading 主闭环**：可信/private provider → content validation → eligible candidates → stage gate → Smart Session → Runner → facts → evidence → Coaching Context。
5. **正式红宝书 provider / denominator**：在没有可信完整版本前，`observedProgress` 必须保持 null。
6. objective semantic 自动进入 Smart Session、跨设备 objective run 恢复，等待真实使用证据后再决定；当前不是 blocker。
7. 当前 dictionary cache 不是完整 Service Worker / PWA，不承诺未加载内容的冷启动离线。
8. FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。
9. 文学专业课继续冻结；未来开发前重新核对目标年份南京师大官方招生科目、考试范围和参考信息。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 先重新读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排优先沿 `Learning Intent → Smart Session` 演进；Cloud Plan 仅承载 explicit commitment，不重新退回 rigid daily list；
5. 优先做一条完整纵向学习价值链，而不是继续无休止 CSS polish；
6. 每个高价值阶段尽早 commit + push，GitHub 必须保留可续接状态。