# 当前状态 / 续接入口

更新：2026-10-08。续接前仍须核对远端 `main`、开放 PR、CI、GitHub Pages 与 Supabase 实际部署版本；本页只记录已经核实的状态，不把聊天记忆当事实。

## Pages 词库加载修复（2026-10-08）

- 根因已实测：旧 `/qwerty-learner/dicts/2025KaoYanHongBaoShu.json` 返回 404 HTML；正确 `/wenyan-English/dicts/2025KaoYanHongBaoShu.json` 返回 200 JSON。
- 词库和本地音效使用 Vite `BASE_URL`，移除上游部署前缀；未改变词库版本、学习事实、数据库或 OAuth 权限。
- 词库加载检查 HTTP 状态、JSON MIME、解析结果和非空单词数组，15 秒超时并显示中文错误。
- Today 失败后结束“正在安排”，支持重新安排；刷新时清除旧草案，避免失败后启动过期安排。
- 练习页显示加载错误和重试，错误时禁止开始及键盘启动；保存的复习词组和内置首章直接使用本机内容，不依赖词库网络请求。
- 新增 `playwright.pages.config.ts` 与 `pages-assets.spec.ts`：正式构建、真实词库、Pages 子路径、音效、失败及重试。默认开发测试排除这组专用测试；CI 增加 Pages 构建验收和 Smart Session 浏览器回归。
- 验证：lint 通过（7 条既有警告，0 错误）；TypeScript 通过；Pages 正式构建通过；Pages 真实资源与故障恢复 7/7、Smart Session 2/2、学习计划 5/5 通过。Smart Session 旧 fixture 补齐当前必填 id/timezone 后通过，未放宽生产校验。线上部署状态待提交后核验。
- 后续：修复部署成功后，在用户已登录的真实设备验证学习与事实上传闭环；本次浏览器回归不替代真实账号 E2E。

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
- `day` Intent 已按自身 IANA timezone 绑定到 `effectiveFrom` 所在自然日。
- `session` Intent 已支持首次真实执行时 first-party bind；绑定后只对对应 Smart Session 生效，离线缓存不会抢占未绑定 session Intent。
- hard-stop 从真正开始学习时锁定 deadline；到点只在安全单词边界停止并回 Today，不伪造章节/任务完成。

### Cloud Plan / 网页控制

- Cloud Plan v2 支持创建、修订、归档与真实 completion evidence。
- MCP 已有 `open_today / open_dictionary / open_chapter / start_task / get_action_status` 等受限控制工具。
- command completion 与 learning completion 严格分离。

### Learning Preferences / Stage

- 长期 Stage 为第一方持久化偏好：`vocabulary / mixed / exam_practice`。
- 没有用户确认记录时返回 `vocabulary` revision 0 + `product_default` provenance，不伪造用户选择。
- Stage 真正改变必须保留 `user_confirmation` provenance。
- OAuth 长期偏好写入必须单独拥有 `preferences:write`；当前 ChatGPT client **没有**该 capability。
- 第一方 Wenyan 登录会话可在“策略”页显式确认长期阶段。

### AI Coaching / Learning Evidence

- `docs/AI_COACHING_LOOP_V1.md` 为基础策略合同。
- Coaching core 不制造 readiness/mastery/fatigue/motivation/recall-speed 分数。
- spelling evidence 不得解释为 semantic mastery；typing duration 不得解释为 recall latency。
- `derived.learningEvidence` 已进入主线，算法版本 `learning-evidence-v1`：
  - current calendar 7d vs immediately previous calendar 7d；
  - active days、attempts、zero-error/error spelling attempts、unique observed words、first observations、repeated exposure、distinct error words；
  - 7d delta 仅为 descriptive comparison，不作因果判断；
  - latest observed、calendar days since latest、recent active-day streak；
  - bounded repeated-spelling-error evidence（14d，最多 8 个词，每词最多 4 个事实 UUID）；
  - comparability 明确为 `sparse / complete_visible_history / partial_visible_history`。

### Reading Loop v1

- versioned Reading domain、Runner、草稿恢复、答题与真实 facts 已实现。
- 尚未接 private provider、eligible candidates、fresh runtime admission，因此 Reading 还不能由 Smart Session 自动编排。

## OAuth / MCP 生产基线

2026-10-08 当前生产状态：

- Supabase 项目：`cmjhxvpkdeheujuteqoi`。
- Edge Function：`wenyan-english-mcp` **v12 ACTIVE**。
- `verify_jwt=false` 仅因为函数内部自行执行 Supabase OAuth JWT resource-server 校验，不代表匿名开放。
- 当前已批准 ChatGPT OAuth client 已授予：`plans:read`、`plans:write`、`coach:auto_adjust`、`navigation:control`、`session:control`。
- **未授予 `preferences:write`**；短期 coach 权限不能升级为长期偏好写权限。
- 生产 authenticated `get_coaching_context` smoke 已成功，真实返回确认：
  - `toolVersion = coaching-context-v1.2`；
  - `adapter.intentReadStatus = available`；
  - `adapter.preferenceReadStatus = available`；
  - `preferences.learningStage` 可从 durable Preference 层读取；当前无用户确认记录时为 `vocabulary` revision 0 / `product_default`；
  - `derived.learningEvidence.algorithmVersion = learning-evidence-v1`；
  - 当前真实学习 facts 仍为 sparse：`wordRowsRead = 0`，不得把空数据解释为已掌握或不会。
- 生产 smoke 时当前 day Intent 仍可读取：30 分钟、hard stop 30 分钟、normal、balanced。

详情历史：`docs/oauth-capability-fix-v11.md`。

## Coaching Production Closure v1（PR #26，已合并）

PR #26 merge SHA `d625446e7d9c1f6c6436b50afa2bf8eaff5957a9`；main CI #112 与 Pages #21 成功。

完成：

- owner-scoped last-valid Intent cache；
- Learning Preferences / Stage v1；
- `/preferences` 第一方确认入口；
- Coaching Context v1.2 adapter 的 durable preferences 读取与 fail-soft；
- `preferences:write` 与 `coach:auto_adjust` 权限分离。

生产 migration `learning_preferences_v1` 已应用；三张 preference 表启用 RLS，新增 helper/RPC 均为 `SECURITY INVOKER`。

## Intent Runtime Closure v1（PR #27，已合并）

PR #27 merge SHA `f21d0639769fcbf3d4ca2709994d2d2dc88d100a`。

完成：

- owner-bound Smart Session runtime；
- hard-stop 从首次真实 block 开始；
- stale-draft / remaining-budget preflight；
- safe word-boundary stop，不伪造 completion；
- day Intent 精确 calendar-day 语义；
- session Intent first-party bind-on-first-use；
- cached unbound session Intent 离线不抢占。

生产 migrations 已应用：

- `intent_runtime_closure_v1`
- `intent_binding_fk_index`

数据库核验：

- `learning_intent_session_bindings` RLS=true，共 2 条 policy；
- `bind_learning_session_intent`、`get_learning_intents`、`wenyan_learning_intent_snapshot` 均为 `SECURITY INVOKER`；
- Performance Advisor 中本批新增复合 FK 未覆盖索引问题已由 `(intent_id, user_id)` index 消除；
- Security Advisor 未报告本批新增对象的新问题。

CI：最终 PR head `3e902b4260b83d6d71679e9339b9a77158cd50ce` 的 CI #121 全绿；合并后 main CI #122 与 Pages #22 成功。

## AI Coach v2 / Learning Evidence v1（PR #28，已合并）

PR #28 merge SHA `e6bdc19dec9c280caa43b8d28b56dcae5f1a2f8d`。

完成：

- 在 immutable `word_attempted` facts 上加入 bounded comparative evidence；
- current 7d / previous 7d 使用 calendar-day window；
- evidence derivation 对事实输入顺序稳定；
- repeated-spelling-error evidence 保留事实 UUID 回链；
- partial/sparse coverage 明示 uncertainty；
- 不生成 mastery/readiness 等虚假综合分数；
- Cloud adapter 的 24KB context transport budget 回归通过。

CI：PR head `65cc0112fdb41f9ec599e6bc922e133f66621f96` 的 CI #127 全绿；合并后 main CI #128 全绿，Pages #23 成功。

## 当前在线设备 / 真实 E2E 边界

2026-10-08 生产 smoke 时 `get_active_devices` 返回 1 个 Windows Web 设备，但 `online=false`；最后 heartbeat 为 2026-10-07。

因此目前可以确认：

`ChatGPT OAuth → MCP v12 → Preferences / Intent / Learning Evidence` ✅

但暂时不能确认：

`ChatGPT → 在线 Wenyan 网页命令 → Smart Session 真学习 → immutable fact 上传 → ChatGPT reread` ⏳

只有设备真正在线并完成学习后才能验收这一圈，禁止用 command queued/completed 代替 learning completion。

## 当前仍未完成 / 不得误称实现

1. **真实在线 AI → 网页 → 学习 → fact → AI E2E**：唯一需要真实设备参与的近期闭环验收。
2. **Reading 自动编排**：private provider、eligible candidate adapter、fresh catalog/version/owner/license guard 与 Smart Session executor 未接通。
3. **红宝书 provider**：没有可信版本、分母和稳定 item mapping；`observedProgress` 必须继续为 null。
4. **snapshot replay**：只有 SHA-256 fingerprint + 非持久 descriptor，没有 server-side manifest/replay handle。
5. **语义词汇证据**：当前仍主要是 spelling evidence；semantic/contextual recall 尚未建立，FSRS 不应提前硬套。
6. **旧 Supabase Advisor 项**：旧 `wenyan_private` RLS/SECURITY DEFINER/Auth password 配置告警另批治理，不与 Coaching Loop 功能混改。

## 下一步优先级

1. 用户打开并登录 Wenyan Web 后，立即完成一次真实 ChatGPT → 网站 → 真学习 → fact → ChatGPT reread E2E。
2. 继续 **AI Coach v2**：在 Learning Evidence v1 上设计 bounded diagnosis / decision contract，让 ChatGPT 能区分“描述性变化、证据不足、可逆短期调整、需要用户确认的长期变化”。
3. 接 private Reading provider + eligible candidates + fresh runtime guard；只有用户确认 `mixed` 后才允许自动执行 Reading。
4. 增加 semantic/contextual vocabulary evidence，再评估 item-level scheduler/FSRS。
5. 内容验收后扩考研阅读、完形、新题型、翻译、作文；文学继续冻结到英语闭环稳定。

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
- `verify_jwt=false` 必须与函数内部 JWT 验证同时存在；
- OAuth protected-resource discovery、未认证拒绝、authenticated `get_coaching_context`；
- `adapter.intentReadStatus / preferenceReadStatus`，不可把 unavailable 当“没有偏好”；
- `derived.learningEvidence.algorithmVersion`；
- Supabase Security / Performance Advisor；
- 不提交 token、secret 或真实学习历史。

GitHub 是代码与交接的持久化来源。后续会话不要从旧 SHA、旧 STATUS 或聊天记忆猜进度。
