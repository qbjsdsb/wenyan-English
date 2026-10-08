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

## Coaching Production Closure v1（PR #26）

分支：`coaching-production-closure-v1`。

### 1. owner-scoped last-valid Intent cache

已实现：

- 成功读取云端 Intent 后，按 authenticated `user.id` 缓存经过运行时校验的 Intent。
- 云端暂时不可用时，只允许当前账号复用自己最近一次仍有效的缓存。
- `effectiveFrom / expiresAt` 每次重新过滤；过期 day/session 不会因为缓存继续生效。
- 没有 authenticated user id 时不读取任何账号缓存，避免账号切换串数据。
- Today 明确显示 `cached-cloud` 降级状态，不把旧缓存冒充实时云端结果。
- 缓存写入失败不阻塞学习。

尚未包含：正式 sessionId binding、精确 day 日界合同、运行中 hard-stop 强制中断。

### 2. Learning Preferences / Stage v1

生产数据库 migration `learning_preferences_v1` **已于 2026-10-08 成功应用**。

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
- reminder preference 支持 `user_reopens` 或明确 `after(notBefore + additionalActiveDays)`；不编造“科学冷却期”。

数据库核验：

- 三张新表均已启用 RLS。
- 五个新增 helper/RPC 均为 `SECURITY INVOKER`，不是 `SECURITY DEFINER`。
- migration 后 Supabase Security Advisor 没有新增来自这三张表/五个函数的安全告警；现存 WARN/INFO 仍来自旧 `wenyan_private` 路线和 Auth leaked-password protection。
- Performance Advisor 对两个刚创建的索引报告 `unused_index` 属于低使用量新索引的预期 INFO，不应因此立即删除。

### 3. 网站“策略”页

代码已加入 `/preferences`：

- 显示当前长期阶段、revision 与 provenance。
- vocabulary / mixed / exam_practice 三个阶段由用户点击确认。
- 文案明确：ChatGPT 可以建议，不能替代长期阶段确认。
- revision conflict 会刷新最新状态并要求重新确认。
- 确认阶段不写学习事实、不补完成记录。

### 4. Coaching Context v1.2 代码

PR #26 中 adapter 已升级为 `coaching-context-v1.2`：

- 在 word facts + Intent 之外读取 durable Learning Preferences。
- 有用户确认时将真实 stage/reminder 提供给 Coaching core。
- Preferences transport/403/decode 异常时 fail-soft：保留事实与 Intent，stage 降级为明确的 product default，并增加 `learning_preferences_unavailable` warning/uncertainty。
- snapshot fingerprint / descriptor 包含 preference 状态，继续声明 multi-source 非原子。
- `scripts/check-coaching-adapter.mjs` 已扩为 9 个 adapter 场景。

**重要部署边界：**截至本页最后更新，生产 `wenyan-english-mcp` 仍是 v11；v1.2 adapter 代码已经通过 CI，但 Edge Function v12 尚未部署，不得提前声称生产插件已经读取 durable stage preference。

## PR #26 验证

修复一次 import 排序 lint 后，GitHub Actions **Wenyan CI run #110** 在 commit `546cd4da2749bc42393a2f8ba070611b89c6d0de` 完整成功：

- Yarn install
- lint
- TypeScript typecheck
- Smart Session deterministic scenarios
- AI Coaching deterministic scenarios
- Cloud Coaching adapter scenarios
- OAuth capability scenarios
- production build
- Chromium installation
- study-plan / sync-queue / event-restore / oauth-consent browser regression flows

最终合并前必须以 PR 最新 head 的 CI 为准；后续若更新本 STATUS 导致新 run，应引用新的最终 run，而不是只引用 #110。

## 当前仍未完成 / 不得误称实现

1. **Production MCP v1.2 deploy**：数据库 Preference 已 live，但 Edge Function 仍 v11，需部署 PR #26 的 `coaching.ts / authorization.ts` 后再做 authenticated smoke。
2. **真实 AI → 网页 → 学习 → fact → AI E2E**：后端组件均存在，但还缺在线设备上的完整真实验收。
3. **Intent 精确稳态**：last-valid owner cache 已补；sessionId binding、day 日界语义与 hard-stop enforcement 仍待补。
4. **Reading 自动编排**：private provider、eligible candidate adapter、fresh catalog/version/owner/license guard 与 Smart Session executor 未接通。
5. **红宝书 provider**：没有可信版本、分母和稳定 item mapping；`observedProgress` 必须继续为 null。
6. **snapshot replay**：只有 SHA-256 fingerprint + 非持久 descriptor，没有 server-side manifest/replay handle。
7. **语义词汇证据**：当前主要是 spelling evidence；semantic/contextual recall 尚未建立，FSRS 不应提前硬套。

## 下一步优先级

1. 部署 MCP Coaching Context v1.2，并用当前 authenticated plugin 验证 `preferenceReadStatus` 与默认/确认 provenance。
2. 在线打开 Wenyan，完成一次 ChatGPT Cloud Plan → start_task → 真学习 → immutable fact → ChatGPT reread 的完整 E2E。
3. 补 sessionId binding、day 日界与真正 hard-stop enforcement。
4. 接 private Reading provider + eligible candidates + fresh runtime guard；用户明确确认 `mixed` 后才允许自动执行 Reading。
5. 增加 semantic/contextual vocabulary evidence；再评估 item-level scheduler/FSRS。
6. 内容验收后扩考研阅读、完形、新题型、翻译、作文；文学继续冻结到英语闭环稳定。

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
