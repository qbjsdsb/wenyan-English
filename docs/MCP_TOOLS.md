# MCP tool contract

更新：2026-10-10。

Wenyan English 使用独立远程 MCP：`supabase/functions/wenyan-english-mcp/` 是英语插件的源码真相。Supabase 中更早的 `wenyan-mcp` 属于旧 Wenyan 路线，不作为当前英语插件生产实现复用。

## 当前生产版本

- Supabase project：`cmjhxvpkdeheujuteqoi`
- Edge Function：`wenyan-english-mcp`
- Production Edge Function：**v15 ACTIVE**
- MCP server contract：0.8.x
- Coaching Context adapter：`coaching-context-v1.5`
- Transport：MCP Streamable HTTP
- Authentication：Supabase OAuth 2.1 + DCR

PR #61 / #62 的 Plan 生命周期与 execution-identity 收口只修改前端 / Supabase RPC contract，没有扩大 MCP capability，也没有重新部署 Edge Function v15。

## 认证与安全边界

- Edge Function `verify_jwt=false` 是有意配置：函数自身验证 Supabase JWKS、issuer、`aud=authenticated`、`sub`、`session_id`、`client_id` 等 claims；不代表匿名开放。
- 后端只使用 publishable key + 当前 OAuth Bearer token，不读取或暴露 `service_role`。
- 数据层继续由 RLS、SECURITY INVOKER RPC 和当前 OAuth client capability 共同约束。
- capability 查询失败时受限能力 fail closed。
- 学习历史 `learning_events` 不允许 AI 修改或删除。
- Learning Intent / Cloud Plan 是未来意图，不是过去事实。
- 网站命令回执只证明网页动作执行；永远不是学习完成证据。

核心 invariant：

> AI may control future learning intent, but must never rewrite past learning truth.

## 首选高层入口：`get_coaching_context`

高层学习判断优先读取 owner-scoped、预算受限的 Coaching Context，而不是让 ChatGPT 自己拼接大量原始事实。

v1.5 必须分开：

1. `word_attempted` 拼写证据；
2. `semanticEvidence`：sourceVersion 4 的词义主动回想用户自评；
3. `semanticDiscriminationEvidence`：sourceVersion 5 的客观参考释义辨认；
4. Learning Intent / explicit Cloud Plan future state；
5. execution availability / device runtime；
6. coverage、truncation、unsynced / local-only uncertainty；
7. Reading candidate/provider 状态。

不得把这些 measurement 合成没有校准依据的总 mastery score。

### Objective semantic 的解释边界

`semantic_discrimination_attempted` 的 measurement 是 `reference_meaning_discrimination`。

正确只代表：学习者在本次展示的版本化参考释义中选中了当前词条对应参考项。

不得解释为 free recall、contextual comprehension、Chinese→English production、熟词僻义完整覆盖、collocation / phrase knowledge、semantic mastery 或 memory strength。

## 学习证据读取

### `get_learning_overview`

读取有界时间范围内已同步学习事实概览。拼写首次无错率不是语义掌握率；duration 不是 recall latency；未同步设备数据视为未知。

### `get_weak_words`

返回可解释的近期拼写复习证据排序。排名代表“近期有较强复习证据”，不代表词义一定不会。

### `get_word_history`

读取一个词的有界真实事实链。缺失记录既不等于 mastered，也不等于从未学过。

## Learning Intent / AI Coach

### `get_learning_intents`

读取当前 active 的 `ongoing / day / session` future-learning intent。

Smart Session 合并顺序：

`session > day > ongoing > local defaults`

### `revise_learning_intent`

创建或修改 future scope。必须使用当前 revision 做 optimistic concurrency；网络重试才复用相同 requestId/payload。

当前 bounded constraints：

- `focusDictionary`
- `targetMinutes`
- `hardStopMinutes`
- `newWordCeiling`
- `reviewPreference = balanced | review_first`
- `intensity = gentle | normal`
- `preferredActivities`

`preferredActivities` 已能实际到达 Smart Session；不要在 adapter 层把受支持的 `semantic_recall` 无理由改回 vocabulary。

objective semantic discrimination 当前仍不是独立 Smart Session planner activity，因此不为它扩大 intent/tool surface。

### `clear_learning_intent`

归档 scope，使其停止影响未来 Smart Session；不删除 intent revision，也不删除学习事实。

## Cloud Plan：明确任务，不是每日调度器

Cloud Plan 只承载需要稳定 task identity、due date、completion evidence 或跨设备持久存在的 explicit commitment。

“今天 30 分钟 / 复习优先 / 新词 ≤ 5 / 多做词义回想”等属于 Learning Intent，不应冻结成 Cloud Plan。

### 当前真实 task kind

网站和 MCP 当前真正可执行 / 可创建的 Cloud Plan task kind **只有 `chapter`**。

数据库里历史预留的 `smart_review / word_set / dictation / weak_words / mixed_session` 名字不是当前产品能力。MCP 不应创建它们，Agent 也不得宣称它们已可执行。

### `get_plan_status`

默认读取当前仍有 actionable chapter task 的活动计划，或按 explicit planId 读取历史计划。

Completion 的权威仍然是 immutable `chapter_completed` evidence，不是 Plan row、Command receipt 或网页状态。

PR #62 后，新 Cloud Plan run 会在启动时捕获：

- owner；
- `planRevision`；
- `taskFingerprint = chapter:<dictId>:<chapterIndex>`。

新 task-linked word/chapter facts 会携带 `planRevision + taskFingerprint`。

生产 `get_plan_status` 对新 completion evidence 额外验证 fingerprint 是否仍匹配当前 task config：

- 只改 title / reason / dueDate / estimatedMinutes：执行目标未变，旧 run 仍可完成；
- 改 dictionary / chapter：fingerprint 改变，旧 run 的事实不能误完成修订后的 task。

`planRevision` 是 provenance，不是严格 equality gate。历史 pre-fingerprint completion facts 保持兼容，不重写历史。

### `create_study_plan`

创建新的显式 chapter Plan。当前同一 owner 最多一个 active Cloud Plan；新 create 会在 revision 留痕后 supersede 旧 active Plan。

### `revise_study_plan`

修改未来任务，必须使用最新 `expectedRevision`。已有真实 completion evidence 的任务保持 immutable。正在执行的 task 即使经过 revision，也只能由仍匹配当前 execution fingerprint 的新 completion fact 完成。

### `archive_study_plan`

归档计划，不删除 plan / revision / task / learning facts。

## 网站设备与受控动作

### `get_active_devices`

读取近期 Wenyan Web 设备及 current page / dictionary / chapter / mode / taskRun，并可包含目标设备自己的短期 execution availability。

运行时可执行性不是学习事实或 mastery。

### `open_today`

排队打开 Today。

### `open_dictionary`

选择真实英文词书并打开 Today。

### `open_chapter`

选择真实英文词书与 zero-based chapterIndex，进入对应学习页。

### `start_task`

启动指定 Cloud Plan chapter task。启动前网站会重新通过 Supabase / RLS 验证该 Plan/task；新 run 绑定 owner/revision/fingerprint。启动仍然不是完成。

### `get_action_status`

读取 durable command receipt。只有 `effectiveStatus=completed` 表示浏览器报告网页动作已执行；仍不表示学习完成。

控制工具都要求稳定 requestId。没有在线可控设备时不得声称动作已执行。

## capability 映射

- `get_learning_intents`：`plans:read` 或 `coach:auto_adjust`
- `revise_learning_intent / clear_learning_intent`：`coach:auto_adjust`
- Cloud Plan writes：`plans:write`
- stage/preferences 的受控用户确认：`preferences:write`
- device read / action status：`navigation:control` 或 `session:control`
- open Today / dictionary / chapter：`navigation:control`
- start task：`session:control`

没有全局历史事实写权限，也没有自动授予 capability。

## Agent 使用原则

推荐执行顺序：

`read context → 判断 evidence / uncertainty → 必要时调整 bounded future intent → 需要明确 commitment 时才创建/revise Plan → 选定在线设备 → bounded action → 读取 action status → 等待真实 learning facts → 再判断`

必须区分：

- Observed Fact
- Derived Evidence
- User Statement
- AI Inference / Recommendation
- Unknown

blocked / cooldown / stale executor 时不要无限重复写相同 intent。结束得早、保持原安排或建议休息都可以是正确结果。

禁止添加：

- `run_sql(anything)`
- `execute_js(anything)`
- `control_wenyan(anything)`
- 任意历史事实修改工具

## 当前未完成

- objective semantic discrimination 尚未成为独立 Smart Session planner purpose；v1 是 semantic recall 后的可选 follow-up / direct practice。
- objective run 不支持跨设备无缝迁移。
- 用户本人完成 objective exercise → sync → MCP v1.5 读取真实 `semanticDiscriminationEvidence` 的 post-release 验收仍待真实使用触发；禁止制造假个人学习记录。
- 新的 Cloud Plan owner/revision/fingerprint 完整生产回流，应等待自然真实任务验证；不要为了 smoke 制造无意义学习事实。
- Reading Runner 存在，但可信/private provider、eligible candidate admission 与自动 Smart Session orchestration 尚未完整接通。
- 正式红宝书 provider 尚未接入；可信完整 denominator 不存在时 `observedProgress` 必须为 null。
- contextual meaning、熟词僻义、collocation / phrase、Chinese→English production 尚未形成独立可靠 evidence channel。
- FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。

## 相关文档

- `docs/STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/CLOUD_PLAN_V2.md`
- `docs/AI_COACHING_LOOP_V1.md`
- `docs/AI_COACH_CONTRACT.md`
- `docs/LEARNING_INTENT_V1.md`
- `docs/SMART_SESSION_V1.md`
- `docs/COMMAND_BUS.md`
- `docs/OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`
