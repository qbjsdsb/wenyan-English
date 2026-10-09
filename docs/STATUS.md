# 当前状态 / 续接入口

更新：2026-10-08。续接前仍须核对远端 `main`、开放 PR、CI、GitHub Pages 与 Supabase 实际部署版本；本页只记录已经核实的持久状态，不把聊天记忆当事实，也不保存用户真实学习明细。

## 2026-10-09 vocabulary reliability checkpoint

- **Baseline**：最新 main `f0e957f`，包含 PR #49、#50、#51；新分支 `fix/vocabulary-daily-reliability`。
- **Found / implemented**：原单词保存 hook 吞掉失败，260ms 后仍前进；现等待本机原子事务成功，失败留在该词、暂停并允许重试。章节结果页同样等待保存，失败时保留结果现场而不放行下一章。
- **Keyboard / UX**：输入框、按钮、对话框、IME 和设置浮层不再被开始/输入快捷键抢占；暂停时 Tab 恢复正常导航；按住 Tab 后失焦不会持续泄露提示。保留原单词完成反馈时长，增加清楚的加载、保存、重试反馈。
- **Recovery**：词书不在窗口重新聚焦/网络重连时后台重取，避免新数组触发 SETUP_CHAPTER 重置当前练习；显式重试仍保留。
- **Validation**：本地 typecheck 通过，Typing/DB 定向 lint 无错误（既有 non-null warnings）。新增浏览器回归覆盖写入失败/重试、章节失败、Tab/Enter 隔离、焦点恢复；结果待运行。
- **Boundary**：未更改 schema、AI、云端部署或既有学习语义；未宣称全部功能已验收。普通章节刷新仍从该章开头开始，已保存事实保留；Smart Session 有单独恢复路径。

## 2026-10-09 quiet-study UI follow-up

- **Baseline / merged**：重新 fetch main，确认 PR #49 已合并，真实 main 为 `48090e3c8cad7529d1794c35e8ff187480a355b1`。下方“#49 尚未合并”为当时历史状态。
- **Implemented**：Today 主行动适配窄窗口、状态标题区分恢复/新安排/休息、说明字号改善；首次使用无需先建计划；当日统计增加真实 semantic facts 计数并明确拼写指标；队列为空不再虚称云端“已同步”。词义页统一 Studio 表面、已保存进度、分步提示、同等权重自评按钮和可见键帽。
- **Tested**：本地 TypeScript 检查通过；改动页面 targeted ESLint 无错误（SmartSessionDock 原有 effect cleanup ref warning）。现有 CI 负责浏览器回归，尚未取得本次运行结果。保持原有自评按钮 accessible name。
- **Not changed**：事实/评分/调度/数据库/同步算法、Typing engine、MCP 与 Supabase 部署。
- **Not yet verified**：本次 UI 尚未合并/部署；未做人工浏览器视觉验收或真实用户验收。未新增测试或反复运行全量检查。

## 2026-10-09 next-generation 续接（优先于下方旧里程碑）

- **Baseline**：开始时 main `2807972`（PR #48）；专用分支 `astra/wenyan-next-generation`，Draft PR #49。
- **Designed**：语义测量边界、多活动渐进接入、Agent self-correction、四领域文学/真题的未来边界，详见 [durable handoff](ASTRA_WENYAN_NEXT_GENERATION.md)。文学未开发。
- **Implemented**：词义主动回想独立活动、sourceVersion 4 facts、Dexie v7 原子保存/恢复、既有同步/严格恢复校验、独立词义证据、Context v1.4、bounded semantic intent、elastic-v2 semantic lane、Today 入口、键盘/揭示恢复/账号隔离。
- **Tested**：实现提交 `674f962` 的 **Wenyan CI #202 全绿**：lint、typecheck、全部deterministic gates、production build、原有/新增浏览器流程、Pages artifact build与Pages资源/恢复回归均通过。本地只运行了针对性算法检查与一次typecheck，没有反复跑完整套件。
- **Merged**：本分支尚未合并。不要把新版词义页面说成现有Pages已上线。
- **Deployed**：semantic_recall_agent_contract migration；生产 MCP **v14 ACTIVE**，完整源码部署自 `834a306`，替换旧shim，server 0.8.0 / context v1.4。
- **Smoke verified**：真实已安装插件可读取v1.4、词义证据状态、明确stale runtime、unknown新执行器能力；已有intent/preferences读取正常。OAuth discovery及既有Pages HTTP 200；匿名POST和无效token POST均401。未扩大能力授权。
- **Real-user verified**：新词义活动尚无真实用户完成→同步→MCP回流验收；CI fixture不等于真实学习。
- **Not completed**：正式Reading provider/orchestration、跨设备未完成活动迁移、objective semantic marking、FSRS、文学、插件安装包重新对齐。

发现并记录：执行可用性表/RPC其实已在生产存在，但未完整反映在迁移列表；原生产v13只返回context v1.2。不能根据迁移列表缺行就重建表。旧文档中的v13/PR35/semantic未实现等描述为历史状态，以本节与handoff为准。

## 当前结论

Wenyan English 已进入 **Local-first deterministic learning runtime + ChatGPT strategy brain** 阶段，英语词汇主闭环已能真实使用。

核心闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent / Cloud Plan → 本地 Smart Session 执行 → 新事实回流`

不可破坏的边界：

> AI controls future intent, never past truth. Only the user confirms long-term stage. ChatGPT reasons; deterministic code guards. Wenyan works without AI.

2026-10-08 已完成真实登录设备闭环验收：ChatGPT / MCP 能读取 owner-scoped 状态，网页端能执行受限学习入口，真实学习产生 immutable facts，云端同步后 ChatGPT 能重新读取新证据；Cloud Plan 的完成状态由匹配的 immutable completion evidence 推导，而不是由 command completed、页面打开或计划创建伪造。

### 2026-10-08 Smart Session review-only deadlock 已收口

PR #35 `Fix Smart Session review-only deadlock` 已合并到 `main`，merge SHA：

```text
b50c9d61dfb66bc41fc0d74396851a5b98fbc5b8
```

问题是合法的 Cloud Learning Intent 可以同时要求 `review_first` 与 `newWordCeiling = 0`，但旧 planner 只有“重复错误达到 weak 条件”或“到期 review”才有可执行复习内容，导致 AI 正确要求“今天只复习”时，本地可能恰好 `blocks=[]`，Today 主入口看起来像坏掉。

本次升级 Smart Session planner 到 `elastic-v2`：

- 单次最近拼写错误不再夸大成 `weak`，新增独立 `correction` purpose；
- 最新一次拼写错误在 20 分钟 cooldown 后可进入 correction block；
- 最近重复错误仍按原规则进入 `weak`；
- 最新已纠正成功的单次旧错误不会继续占据 correction 队列；
- `newWordCeiling = 0` 继续作为硬约束，planner 不会为了让按钮可点而偷偷加入新词；
- cooldown 会返回 `retryAt`，Today 到点自动重新计算；
- 无 block 时明确区分 cooldown、new-word ceiling、nothing due、budget reached；
- 用户仍可显式选择 `手动继续当前章节（不按这条智能安排）`，该入口是明确 override，不伪装成智能计划执行。

PR #35 的最终 PR CI `Wenyan CI #160` 全绿；合并后的 `main` CI `Wenyan CI #161` 也全绿。合并后的 `Deploy Wenyan Pages #27` build + deploy 均成功，因此生产 Pages 已包含本次修复。

验证包括：Smart Session deterministic **20 passed**、AI Coaching **18 passed**、Coach decision guardrails **7 passed**、Cloud coaching adapter **9 passed**、OAuth capability **9 passed**、普通浏览器 E2E **12 passed**、Pages vocabulary / failure recovery **7 passed**，以及 production build / Pages artifact build。

本次无需 Supabase schema migration，也无需修改或重新部署 `wenyan-english-mcp` Edge Function；问题属于 Learning Intent 与本地 deterministic planner 的执行语义缝隙，以及 Today 空状态表达不足。

## 当前生产基线

- GitHub `main`：Smart Session `elastic-v2` 已通过 PR #35 合并；当前已核实 merge SHA `b50c9d61dfb66bc41fc0d74396851a5b98fbc5b8`，`Wenyan CI #161` 成功，`Deploy Wenyan Pages #27` 成功。
- Supabase 项目：`cmjhxvpkdeheujuteqoi`。
- Edge Function：`wenyan-english-mcp` **v13 ACTIVE**。
- `verify_jwt=false` 仍为有意配置：函数内部执行 Supabase OAuth JWT resource-server 校验；这不代表匿名开放。
- v13 部署逻辑仍固定到 AI Coach v2 / Decision Support 已验证的生产源码；生产 authenticated `get_coaching_context` smoke 已确认 `derived.coachDecisionSupport.algorithmVersion = coach-decision-support-v1` 可读取。本次 Smart Session 本地修复不要求 Edge Function 升版。
- 当前 OAuth client 的已批准能力继续保持 `plans:read`、`plans:write`、`coach:auto_adjust`、`navigation:control`、`session:control`；没有 `preferences:write`，因此 ChatGPT 不能越权修改长期学习阶段。
- `toolVersion` 仍为 `coaching-context-v1.2`；当前合同继续提供 bounded derived decision support，没有扩大历史事实写权限。
- v13 当前 Supabase source entrypoint 使用一个固定 Git SHA 的部署 shim 来解析已合并源码；行为已通过真实 MCP smoke。后续如建立稳定 CI/CLI 自动部署，应恢复完整 source tree 直接上传，避免把该 shim 当长期发布规范。

## 已完成并进入主线的能力

### 学习事实 / 同步

- 本地不可变 `word_attempted / chapter_completed` 学习事实；Reading 已有 `question_attempted / reading_completed`。
- Dexie 本地优先；Supabase 保存 owner-scoped 长期事实并支持上传/恢复。
- 完成状态只能由真实 immutable evidence 证明；网页命令成功、计划创建成功都不等于学习完成。
- 真实登录设备已经验证学习事实能上传并再次被 ChatGPT / MCP 读取。

### Smart Session / Learning Intent

- deterministic Smart Session planner 已成为 Today 主入口，当前算法合同为 `elastic-v2`。
- 可恢复未完成 vocabulary block；离线仍能学习。
- 单次近期拼写错误进入 bounded `correction`，重复近期错误仍进入 `weak`；二者不再混为同一种证据。
- 20 分钟 cooldown 后 correction 才可执行；cooldown 期间有 `retryAt` 并自动重新计算。
- `newWordCeiling = 0` 不会被本地 executor 静默突破；没有可执行 block 时页面给出真实原因和显式 override。
- Learning Intent 支持 `ongoing / day / session`，优先级 `session > day > ongoing > local defaults`。
- MCP 支持 intent read/revise/clear；generic Intent 只控制未来短期学习，不取得长期 stage 写权限。
- owner-scoped last-valid Intent cache 已实现，账号切换不串缓存。
- `day` Intent 按自身 IANA timezone 绑定自然日；`session` Intent 支持 first-party bind-on-first-use。
- hard-stop 从真正开始学习时锁定 deadline；到点只在安全单词边界停止，不伪造章节或任务完成。

### Cloud Plan / 网页控制

- Cloud Plan v2 支持创建、修订、归档与真实 completion evidence。
- MCP 已有 `open_today / open_dictionary / open_chapter / start_task / get_action_status` 等受限控制工具。
- command completion 与 learning completion 严格分离。
- 真实在线设备已完成从计划/网页入口到学习事实回流的端到端验收。

### Learning Preferences / Stage

- 长期 Stage 为第一方持久化偏好：`vocabulary / mixed / exam_practice`。
- 没有用户确认记录时只能返回 `vocabulary` revision 0 + `product_default` provenance，不伪造用户选择。
- Stage 真正改变必须保留 `user_confirmation` provenance。
- OAuth 长期偏好写入必须单独拥有 `preferences:write`；当前 ChatGPT client 没有该 capability。
- 第一方 Wenyan 登录会话可在“策略”页显式确认长期阶段。

### AI Coaching / Learning Evidence v1

`docs/AI_COACHING_LOOP_V1.md` 仍是基础策略合同。

`derived.learningEvidence` 已进入主线，算法版本 `learning-evidence-v1`：

- current calendar 7d vs immediately previous calendar 7d；
- active days、attempts、zero-error/error spelling attempts、unique observed words、first observations、repeated exposure、distinct error words；
- 7d delta 只允许 descriptive comparison，不作因果判断；
- latest observed、calendar days since latest、recent active-day streak；
- bounded repeated-spelling-error evidence，保留有限事实 UUID 回链；
- comparability 明确区分 `sparse / complete_visible_history / partial_visible_history`。

硬边界继续保持：

- spelling evidence 不能解释为 semantic mastery；
- typing duration 不能解释为 recall latency 或 fatigue；
- 不制造 readiness/mastery/fatigue/motivation 等综合分数；
- 未观察到不等于不会，也不等于已掌握。

### AI Coach v2 / Decision Support v1

PR #31 新增 `derived.coachDecisionSupport`，算法版本 `coach-decision-support-v1`。

它不是自动诊断器，也不会替 ChatGPT 决定学习策略，只提供确定性的推理护栏：

- `evidenceStatus` 区分 sparse、单窗口可见、双窗口完整/部分可见；
- `longitudinalComparison.use` 明确区分 `not_available / limited_descriptive_only / bounded_descriptive_only / partial_descriptive_only`；
- 两个 7d 窗口都缺少足够观察时，不允许把周变化解释成趋势；
- 即使可以比较，也明确 `window_deltas_are_descriptive_not_causal`；
- ordinary Coach 调整只落在可逆的 `session / day / ongoing` future Learning Intent；
- 可自动调整的字段限定在 target/hard-stop/new-word ceiling/review preference/intensity/preferred activities/focus dictionary；
- rationale 必须声明 evidence / inference / user statement / default 等 basis；
- ChatGPT 可以建议长期 stage 变化，但实际写入仍必须由用户确认；
- 明确禁止从拼写推 semantic mastery、从窗口变化推因果、从 typing duration 推 fatigue、从 command status 推 learning completion。

专用 deterministic guardrail scenarios 已加入 CI，并与现有 coaching、OAuth、浏览器 E2E、Pages 回归一起通过。

### Reading Loop v1

- versioned Reading domain、Runner、草稿恢复、答题与真实 facts 已实现。
- 尚未接 private provider、eligible candidate adapter、fresh catalog/version/owner/license guard 与 Smart Session executor，因此 Reading 还不能由 Smart Session 自动编排。

## Pages 生产修复

2026-10-08 已修复 GitHub Pages 词库部署前缀问题：

- 旧 `/qwerty-learner/dicts/...` 404；正式使用 `/wenyan-English/dicts/...`；
- 词库与本地音效统一使用 Vite `BASE_URL`；
- 加入 HTTP 状态、JSON MIME、解析、非空词组检查和超时；
- Today / 练习页支持失败恢复与重试；
- Pages 专用浏览器回归覆盖真实资源、子路径、音效、失败和重试。

修复提交 `1b74f4e798f3c2a6c82997d7fb5883e7e69d26c0` 的 CI 与 Pages 部署均成功，线上 smoke 已确认真实红宝书资源路径和练习入口正常。后续真实账号 E2E 也已完成，不再把该项列为阻塞。

PR #35 合并后，`Deploy Wenyan Pages #27` 再次成功，当前 Pages 已部署 Smart Session `elastic-v2` 与新的 review-only / cooldown / explicit override UI。

## 近期已收口里程碑

- Coaching Production Closure v1：PR #26，Learning Preferences / Stage、owner-scoped Intent cache、v1.2 adapter、权限分离。
- Intent Runtime Closure v1：PR #27，owner-bound Smart Session、hard-stop、day/session intent 精确语义、bind-on-first-use。
- AI Coach v2 / Learning Evidence v1：PR #28，bounded comparative evidence，不生成虚假综合分数。
- Pages vocabulary repair：提交 `1b74f4e...`，线上资源与浏览器 smoke 通过。
- AI Coach v2 / Decision Support v1：PR #31，merge SHA `0baf8bd5...`，生产 MCP v13 smoke 通过。
- English workspace polish：PR #33，Today / 词书 / 策略 / 统计等桌面学习工作区视觉打磨进入主线。
- Smart Session review-only deadlock closure：PR #35，merge SHA `b50c9d61...`；`elastic-v2`、correction block、retryAt、真实空状态解释、浏览器与 Pages 回归均通过并已部署。
- Real authenticated E2E：真实登录网页学习 → immutable fact → cloud → ChatGPT reread 已验收。

## 当前仍未完成 / 不得误称实现

1. **Reading 自动编排**：private provider、eligible candidate adapter、fresh runtime admission、Smart Session executor 尚未接通。
2. **红宝书正式 provider**：还没有可信版本号、稳定 item mapping 与可信全书分母，因此 `observedProgress` 必须继续为 null。
3. **snapshot replay**：只有 SHA-256 fingerprint + 非持久 descriptor，没有 server-side manifest / replay handle。
4. **语义词汇证据**：当前主要仍是 spelling evidence；semantic/contextual recall 尚未建立，FSRS/item-level scheduler 不应提前硬套。
5. **Coach 对执行器即时可执行性的可见度仍有限**：Coaching Context 还没有把 `reviewEligibleCount / correctionCooldownCount / newWordCapacity` 一类 deterministic execution availability 作为稳定公共合同完整暴露给 ChatGPT。本次已保证本地 executor 不死锁并真实解释状态，下一阶段再从源头减少 Coach 与 executor 的信息差。
6. **旧 Supabase Advisor 项**：旧 `wenyan_private` RLS / SECURITY DEFINER / Auth password 配置告警另批治理，不与 Coaching Loop 功能混改。
7. **生产部署工程化**：v13 已可用，但当前使用固定 commit 的 deployment shim；后续应建立可重复的完整源码 CI/CLI deploy pipeline。

## 下一步优先级

1. **Execution Availability → Coaching Context**：把本地 planner 可解释的即时可执行状态整理成 deterministic derived evidence，让 ChatGPT 在写 `newWordCeiling=0`、review-only 等 Intent 前就能知道当前真正有多少可执行复习 / correction / cooldown / 新词容量；不能把它包装成 mastery 分数。
2. **Reading provider + executor**：先接可信 private provider、eligible candidates 与 fresh runtime guard；只有用户确认 `mixed` 后才允许自动执行 Reading。
3. **红宝书 provider 正式化**：建立稳定版本、item mapping、可信 denominator，之后才能给出真实 observed progress。
4. **Semantic / contextual vocabulary evidence**：增加真正能反映词义/上下文回忆的证据，再评估 item-level scheduler / FSRS。
5. **AI Coach v2 继续迭代**：用多日真实数据验证 decision support 是否足够，再增加 bounded diagnosis vocabulary；不要用一天数据制造趋势。
6. 内容验收后扩考研阅读、完形、新题型、翻译、作文；文学继续冻结到英语闭环稳定。
7. 把 Supabase Edge Function 发布整理为可重复、可审计的完整源码部署流程。

## 续接检查

```bash
git fetch origin
git checkout main
git pull --ff-only
yarn install --frozen-lockfile
node --experimental-strip-types scripts/check-smart-session.mjs
node --experimental-strip-types scripts/check-coaching.mjs
node --experimental-strip-types scripts/check-coach-decision.mjs
node --experimental-strip-types scripts/check-coaching-adapter.mjs
node --experimental-strip-types scripts/check-mcp-authorization.mjs
yarn lint
yarn tsc --noEmit
yarn build
```

部署续接额外核对：

- GitHub `main` 是否仍包含 PR #35 / `elastic-v2`，以及最近一次 Wenyan CI / Pages deploy 是否成功；
- Supabase `wenyan-english-mcp` 实际 ACTIVE version；
- `verify_jwt=false` 必须与函数内部 OAuth JWT 验证同时存在；
- OAuth protected-resource discovery、未认证拒绝、authenticated `get_coaching_context`；
- `adapter.intentReadStatus / preferenceReadStatus`，不可把 unavailable 当“没有偏好”；
- `derived.learningEvidence.algorithmVersion = learning-evidence-v1`；
- `derived.coachDecisionSupport.algorithmVersion = coach-decision-support-v1`；
- Supabase Security / Performance / Health Advisors；
- 不提交 token、secret、真实学习历史、词表学习明细或用户事实 UUID。

GitHub 是代码与交接的持久化来源。后续会话不要从旧 SHA、旧 STATUS 或聊天记忆猜进度。
