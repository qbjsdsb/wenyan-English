# 当前状态 / 续接入口

更新：2026-10-08。开始续接仍须先核对远端 `main`、开放 PR、CI 与 Supabase 当前部署版本；本页记录的是已核实基线，不把 SHA 或部署号当永久最新状态。

## 当前正式主线

Wenyan English 已从“Qwerty + 云同步”进入 **Local-first deterministic learning runtime + ChatGPT strategy brain** 阶段。

核心闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent / Cloud Plan → 本地 Smart Session 执行 → 新事实回流`

不可破坏的边界：

> AI controls future intent, never past truth. Only the user confirms long-term stage. ChatGPT reasons; deterministic code guards. Wenyan works without AI.

## 已完成并进入主线的能力

### 学习事实与同步

- 本地不可变 `word_attempted / chapter_completed` 事实。
- Reading source-v3 `question_attempted / reading_completed` 事实。
- Dexie 本地优先写入、Supabase 上传/恢复、所有权隔离和显式认领。
- 完成状态必须由真实 immutable evidence 证明；网页命令执行成功不等于学习完成。

### Smart Session / Learning Intent

- deterministic Smart Session planner 已实现并成为 Today 主入口。
- 可恢复未完成 vocabulary block；断网仍可学习。
- Learning Intent 已有 `ongoing / day / session`，优先级为 `session > day > ongoing > local defaults`。
- MCP 已支持 intent read/revise/clear；generic intent 只影响未来学习，不获得长期 stage 写权限。

### Reading Loop v1

- versioned Reading domain、Runner、草稿恢复、答题和阅读完成事实已完成。
- Reading 当前仍不是 Smart Session 自动执行活动：private provider、eligible candidate adapter 与 fresh runtime admission 尚未接通。

### AI Coaching Loop v1

- 正式合同：`docs/AI_COACHING_LOOP_V1.md`。
- 纯核心：`src/coaching/types.ts`、`src/coaching/context.ts`。
- 16 组 Coaching deterministic scenarios 已进入 CI；原 Smart Session 16 场景继续保留。
- 不生成 readiness/mastery 分数；代码提供可信描述性证据和硬约束，ChatGPT 负责高层判断。
- 长期 stage 默认 `vocabulary`；ChatGPT 可以建议 `mixed`，但不能替代用户确认。

### live MCP Coaching Context

PR #24 已把 `get_coaching_context` 接入 MCP 0.7.0。PR #25 进一步完成 Coaching Context v1.1 hardening，并已合并到 `main`（merge `1d48df3a64551da79bd60a6c2b362665fdcbce76`）：

- `word_attempted` 云事实是必需来源；active Learning Intent 是可选增强。
- 没有 Intent read capability、Intent HTTP 故障、fetch reject 或 JSON decode 失败时，不再拖垮整个 Coaching Context；返回词汇证据并把 Intent 明确标记为 unknown/unavailable。
- word-event 分页冻结 `created_at <= receivedAtOrBefore` 接收水位，降低分页期间新到事件造成的页漂移。
- snapshot ID 改为 SHA-256 内容指纹；不是持久化对象，也不是 replay handle。
- `evidence.refs[*].replayable=false`，避免把描述性聚合引用冒充以后可重放的审计快照。
- 明确 `multi_source_snapshot_not_atomic`：word facts 与 Learning Intent 不是数据库单事务快照。
- 24 KiB 输出预算继续硬限制。
- 插件 guidance 要求检查 `adapter.intentReadStatus`；当状态不是 `available` 时，`currentIntent=[]` 不能解释为“没有 Intent”。
- plugin metadata 为 0.5.1；adapter toolVersion 为 `coaching-context-v1.1`。

没有为此扩大 OAuth capability、没有 service-role、没有数据库 migration、没有学习事实写权限。

## 本批最终验证与生产状态

PR #25 最终 head `5f06ea7e20bc8d18a11f9dfd92b3e48efdbc32fb` 的 GitHub Actions `Wenyan CI` run #94 已完整成功，最终验证覆盖：

- Yarn install、lint、TypeScript typecheck；
- Smart Session 16 组 deterministic scenarios；
- AI Coaching 16 组 deterministic scenarios；
- Cloud Coaching adapter 4 条场景：正常 Intent、无 Intent 权限、网络 reject、JSON decode failure；
- production build；
- Chromium 安装与 Wenyan browser regression flows。

PR #25 自动 Code Review 的 STATUS 与 optional Intent transport/decode 两项反馈均已修复、回复并 resolve；不能再引用更早的 run #91 替代最终 head 验证。

生产 Supabase 项目 `cmjhxvpkdeheujuteqoi` 的 `wenyan-english-mcp` 已从 v9 部署为 **v10 ACTIVE**。部署后重新读取生产 Edge Function 源码，已确认包含 `coaching-context-v1.1` 的降级读取、分页接收水位、SHA-256 fingerprint、非回放 evidence refs 与 snapshot descriptor。

生产公开 OAuth protected-resource discovery 已在部署后做 live fetch，返回 HTTP 200，`resource`、Supabase `authorization_servers`、`openid` scope 与 bearer header metadata 正常。当前这个 ChatGPT 会话没有暴露私人 Wenyan custom-plugin 工具，因此**没有伪称完成一次新的 post-deploy 已认证 `get_coaching_context` 调用**；此前生产日志已证明真实 OpenAI MCP OAuth 集成存在并有成功调用。下一次有私人插件工具可用时，可把一次真实 authenticated `get_coaching_context` 作为补充验收，而不是把它误写成当前已执行。

部署后重新运行 Supabase Security / Performance Advisor，没有出现本批新增的英语 MCP DDL/RLS 安全问题；现存提示来自旧 `wenyan_private` 路线、账户 leaked-password protection，以及低使用量/旧索引提示。本批没有数据库变更，不为清零 Advisor 而擅自修改旧系统。

## 当前仍未完成 / 不得误称实现

1. **长期 stage 确认与偏好持久化**：用户确认 provenance、decline/revisit reminder suppression 还没有正式第一方存储/确认路径；generic `revise_learning_intent` 继续禁止改 stage。
2. **Reading 自动编排**：Runner 和真实 facts 已有，但 private provider、eligible candidates、fresh catalog/version/owner/license guard 与 Smart Session executor 尚未接通。
3. **snapshot replay**：当前只有内容 fingerprint + 非持久 descriptor；没有 server-side manifest，也没有按 snapshot ID 重放工具。
4. **Intent 本地稳态**：owner-scoped last-valid intent cache、正式 sessionId binding、day 日界语义与精确 hard-stop enforcement 仍待补。
5. **红宝书 provider**：尚未接入可信版本/分母/item mapping；`observedProgress` 必须保持 null，不能用其他词书冒充。
6. **学习证据口径**：spelling evidence ≠ semantic mastery；duration ≠ recall latency；未同步/未观察 ≠ 0；scheduler due 与 interruptions 当前仍未可靠测量。

## 下一步优先级

Coaching Context v1.1 的代码、CI、合并、生产部署与公开 OAuth discovery 已收口。下一批直接按以下顺序推进，不再重复本批工作：

1. stage preference + verified user confirmation provenance + reminder suppression；
2. owner-scoped last-valid Intent cache、日界/session binding、hard-stop；
3. private Reading provider + eligible candidates + runtime fresh-selection guard；
4. mixed 阶段经用户确认后，再让 Smart Session 自动执行 Reading；
5. 内容验收后扩展真题/其他题型；FSRS 延后到存在可信 semantic/contextual evidence。

## 续接检查

```bash
git fetch origin
git checkout main
git pull --ff-only
yarn install --frozen-lockfile
node --experimental-strip-types scripts/check-smart-session.mjs
node --experimental-strip-types scripts/check-coaching.mjs
node --experimental-strip-types scripts/check-coaching-adapter.mjs
yarn lint
yarn tsc --noEmit
yarn build
```

部署续接必须额外核对：

- Supabase 当前项目与 `wenyan-english-mcp` 实际版本；
- Edge Function 源码是否与 `main` 一致；
- `verify_jwt=false` 只因函数自身执行 OAuth resource-server JWT 校验，不代表匿名开放；
- OAuth protected-resource discovery、未认证拒绝；有私人插件工具时补真实 authenticated MCP tool smoke；
- Supabase security/performance advisors；
- 不提交 token、secret、真实学习历史。

GitHub 是代码与交接的持久化来源。不要让后续会话从旧 SHA、旧 STATUS 或聊天记忆猜进度。
