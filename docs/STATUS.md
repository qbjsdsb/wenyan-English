# 当前状态 / 续接入口

更新：2026-10-08。续接前仍须核对远端 `main`、开放 PR、CI、GitHub Pages 与 Supabase 实际部署版本；本页只记录已经核实的状态，不把聊天记忆当事实。

## 当前正式主线

Wenyan English 已进入 **Local-first deterministic learning runtime + ChatGPT strategy brain** 阶段。

核心闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent / Cloud Plan → 本地 Smart Session 执行 → 新事实回流`

不可破坏的边界：

> AI controls future intent, never past truth. Only the user confirms long-term stage. ChatGPT reasons; deterministic code guards. Wenyan works without AI.

## 已完成并进入主线的能力

### 学习事实 / 同步

- 本地不可变 `word_attempted / chapter_completed` 学习事实；Reading 已有 `question_attempted / reading_completed`。
- Dexie 本地优先；Supabase 保存 owner-scoped 长期事实并支持上传/恢复。
- 完成状态只能由真实 immutable evidence 证明；网页命令成功、计划创建成功都不等于学习完成。

### Smart Session / Learning Intent

- deterministic Smart Session planner 已成为 Today 主入口。
- 可恢复未完成 vocabulary block；离线仍能学习。
- Learning Intent 支持 `ongoing / day / session`，优先级 `session > day > ongoing > local defaults`。
- MCP 支持 intent read/revise/clear；generic Intent 只控制未来短期学习，不取得长期 stage 写权限。
- owner-scoped last-valid Intent cache 已实现，账号切换不串缓存。
- `day` Intent 已按自身 IANA timezone 绑定到 `effectiveFrom` 所在自然日，不再仅凭 48h expiry 跨日生效。
- `session` Intent 已支持首次真实执行时 first-party bind；绑定后只对对应 Smart Session 生效，离线缓存不会抢占未绑定 session Intent。
- hard-stop 从真正开始学习时锁定 deadline；到点只在安全单词边界停止并回 Today，不伪造章节/任务完成。

### Cloud Plan / 网页控制

- Cloud Plan v2 支持创建、修订、归档与真实 completion evidence。
- MCP 已有 `open_today / open_dictionary / open_chapter / start_task / get_action_status` 等受限控制工具。
- command completion 与 learning completion 严格分离。

### Reading Loop v1

- versioned Reading domain、Runner、草稿恢复、答题与真实 facts 已实现。
- 尚未接 private provider、eligible candidates、fresh runtime admission，因此 Reading 还不能由 Smart Session 自动编排。

### AI Coaching Loop v1

- `docs/AI_COACHING_LOOP_V1.md` 为正式策略合同。
- Coaching core 不制造 readiness/mastery 分数；只提供有口径的 evidence、coverage、uncertainty 与硬约束。
- `get_coaching_context` 已在生产 MCP 使用；spelling evidence 不得解释为 semantic mastery。

## OAuth / MCP 生产基线

2026-10-08 OAuth capability v11 已收口：

- 生产 Supabase 项目：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v11 ACTIVE**，`verify_jwt=false`，由函数内部自行做 Supabase OAuth JWT resource-server 校验。
- 当前已批准 ChatGPT OAuth client 已授予：`plans:read`、`plans:write`、`coach:auto_adjust`、`navigation:control`、`session:control`。
- **未授予 `preferences:write`**；短期 coach 权限不能自动升级为长期偏好写权限。
- authenticated smoke 已确认 Intent read、Coaching Context、30 分钟 day Intent 和 active Cloud Plan 写入可用。
- 上一次 Cloud Plan smoke 时设备 offline，因此计划没有执行，也没有产生完成事实。

详情：`docs/oauth-capability-fix-v11.md`。

## Coaching Production Closure v1（PR #26，已合并）

PR #26 已合并到 `main`，merge SHA `d625446e7d9c1f6c6436b50afa2bf8eaff5957a9`；main CI #112 与 Pages #21 均成功。

### 1. owner-scoped last-valid Intent cache

- 成功读取云端 Intent 后，按 authenticated `user.id` 缓存经过运行时校验的 Intent。
- 云端暂时不可用时，只允许当前账号复用自己最近一次仍有效的缓存。
- `effectiveFrom / expiresAt` 每次重新过滤。
- 没有 authenticated user id 时不读取任何账号缓存。
- Today 明确显示 `cached-cloud` 降级状态。
- 缓存写入失败不阻塞学习。

### 2. Learning Preferences / Stage v1

生产数据库 migration `learning_preferences_v1` 已于 2026-10-08 成功应用。

新增：

- `public.learning_preferences`
- `public.learning_preference_revisions`
- `public.learning_preference_mutation_receipts`
- `get_learning_preferences()`
- `confirm_learning_stage(...)`
- `set_stage_reminder_preference(...)`
- `clear_stage_reminder_preference(...)`

约束：

- stage 仅允许 `vocabulary / mixed / exam_practice`。
- 没有正式记录时返回 `vocabulary` revision 0 + `product_default` provenance，而不是伪造用户确认。
- 长期 stage 写入使用 optimistic revision + idempotency receipt + revision history。
- stage 真正改变时 provenance 为 `user_confirmation`；Learning Intent 不能偷偷改 stage。
- OAuth 写长期偏好必须另外拥有 `preferences:write`；当前 ChatGPT client 没有该 capability。
- 第一方 Wenyan 登录会话可通过网站“策略”页显式确认长期阶段。

数据库核验：三张新表均启用 RLS，新增 helper/RPC 均为 `SECURITY INVOKER`。

### 3. Coaching Context v1.2 代码

代码 adapter 已升级为 `coaching-context-v1.2`，可读取 durable Learning Preferences，并在偏好服务异常时 fail-soft。

**重要部署边界：**生产 `wenyan-english-mcp` 仍是 v11；v1.2 adapter 代码已通过 CI，但 Edge Function v12 尚未部署，不得提前声称生产插件已经读取 durable stage preference。

## Intent Runtime Closure v1（PR #27）

分支：`intent-runtime-closure-v1`。

### 已实现

- Smart Session runtime 绑定当前 owner；authenticated 用户不会恢复其他账号或 legacy/anonymous runtime。
- hard-stop 不从打开 Today 开始计时；只有第一次真正开始 block 时才固定 deadline。
- 开始新 block 前执行 stale-draft / remaining-budget preflight，预估 block + 60 秒安全余量放不下时不再启动。
- 到 hard-stop 时允许当前单词安全保存，保留未完成 review index，随后返回 Today；**不会仅因到点触发 `FINISH_CHAPTER` 或伪造 completion fact**。
- `day` Intent 在客户端与生产 RPC 都按 Intent 自身 timezone 限定到 `effectiveFrom` 所在自然日。
- `session` Intent 第一次真实启动时由第一方网页会话执行 bind；绑定记录 owner-scoped，OAuth client 不能调用 bind RPC。
- 已绑定的 session Intent 只对对应 Smart Session id 生效；未绑定的 cached-cloud session Intent 离线时被忽略，避免双设备同时抢占。

### 生产数据库

migration `intent_runtime_closure_v1` 已于 2026-10-08 成功应用。

新增：

- `public.learning_intent_session_bindings`
- `bind_learning_session_intent(uuid, integer, text)`
- 更新 `wenyan_learning_intent_snapshot(uuid)`，返回 `boundSessionId / boundAt`
- 更新 `get_learning_intents()`，服务端按 Intent timezone 执行 day-boundary 过滤

安全核验：

- binding 表 RLS 已启用，共 2 条 owner/RPC policy。
- `bind_learning_session_intent`、`get_learning_intents`、`wenyan_learning_intent_snapshot` 均为 `SECURITY INVOKER`。
- Supabase Security Advisor 未报告由本批新增表/函数产生的新告警；当前 Advisor 中仍存在旧 `wenyan_private` RLS-info、旧 SECURITY DEFINER RPC 警告以及 Auth leaked-password protection 提示，需另批评估，不与本次 runtime closure 混改。

### 验证

PR 最新代码 head `0a9e539decf1c0f0305b0a17da5080b6d190f1b2` 的 GitHub Actions **Wenyan CI run #118 已完整成功**，覆盖：

- lint
- TypeScript typecheck
- Smart Session deterministic scenarios
- AI Coaching deterministic scenarios
- Cloud Coaching adapter scenarios
- OAuth capability scenarios
- production build
- Chromium / browser regression flows

另外加入纯 Intent policy 合同测试，用合成数据验证 day calendar-boundary 与 session binding 归属，不使用真实用户数据。

## 当前仍未完成 / 不得误称实现

1. **Production MCP v1.2 deploy**：数据库 Preference 已 live，但 Edge Function 仍 v11；需部署当前 main 对应的 `coaching.ts / authorization.ts` 后再做 authenticated smoke。
2. **真实 AI → 网页 → 学习 → fact → AI E2E**：后端与 runtime 组件已具备，但仍需在线设备上的一次完整真实验收。
3. **Learning Evidence / Coach v2**：当前 Coaching Context 能安全给出事实与约束，但还缺更适合 ChatGPT 判断的有口径窗口对比、趋势和证据摘要。
4. **Reading 自动编排**：private provider、eligible candidate adapter、fresh catalog/version/owner/license guard 与 Smart Session executor 未接通。
5. **红宝书 provider**：没有可信版本、分母和稳定 item mapping；`observedProgress` 必须继续为 null。
6. **snapshot replay**：只有 SHA-256 fingerprint + 非持久 descriptor，没有 server-side manifest/replay handle。
7. **语义词汇证据**：当前主要是 spelling evidence；semantic/contextual recall 尚未建立，FSRS 不应提前硬套。

## 下一步优先级

1. 完成 PR #27 合并后的 main CI / Pages 核验。
2. 开始 **AI Coach v2 / Learning Evidence v1**：在现有 immutable facts 上增加有口径、可解释、带 coverage/uncertainty 的窗口摘要与趋势，不新增虚假 mastery/readiness 分数。
3. 部署 MCP Coaching Context v1.2/后续 evidence adapter，并用 authenticated plugin smoke 验证真实结构化返回。
4. 在线打开 Wenyan，完成一次 ChatGPT Cloud Plan / Intent → start_task / Smart Session → 真学习 → immutable fact → ChatGPT reread 的完整 E2E。
5. 接 private Reading provider + eligible candidates + fresh runtime guard；用户明确确认 `mixed` 后才允许自动执行 Reading。
6. 增加 semantic/contextual vocabulary evidence；再评估 item-level scheduler/FSRS。
7. 内容验收后扩考研阅读、完形、新题型、翻译、作文；文学继续冻结到英语闭环稳定。

## 续接检查

```bash
git fetch origin
git checkout main
git pull --ff-only
yarn install --frozen-lockfile
node --experimental-strip-types scripts/check-smart-session.mjs
node --experimental-strip-types scripts/check-coaching.mjs
node --experimental-strip-types scripts/check-coaching-adapter.mjs
node --experimental-strip-types scripts/check-mcp-authorization.mjs
yarn lint
yarn tsc --noEmit
yarn build
```

部署续接额外核对：

- Supabase migration list 与 `wenyan-english-mcp` 实际 ACTIVE version；
- Edge Function 源码是否与 `main` 一致；
- `verify_jwt=false` 只因为函数自身执行 JWT 验证，不代表匿名开放；
- OAuth protected-resource discovery、未认证拒绝、authenticated `get_coaching_context`；
- `adapter.intentReadStatus` / `adapter.preferenceReadStatus`，不可把 unavailable 当“没有偏好”；
- Supabase Security / Performance Advisor；
- 不提交 token、secret 或真实学习历史。

GitHub 是代码与交接的持久化来源。后续会话不要从旧 SHA、旧 STATUS 或聊天记忆猜进度。
