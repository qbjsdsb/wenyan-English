# MCP tool contract

更新：2026-10-12。

Wenyan English 使用独立远程 MCP：`supabase/functions/wenyan-english-mcp/` 是英语插件的源码真相。更早的 `wenyan-mcp` 属于旧路线，不作为当前英语生产实现复用。

## 当前生产版本

- Supabase project：`cmjhxvpkdeheujuteqoi`
- Edge Function：`wenyan-english-mcp`
- Production Edge Function：**v16 ACTIVE**
- Production pin：GitHub `5d8ac1fe13a89e58fbdaa2f115a8087e1f2f496d`
- MCP server contract：0.8.x
- Coaching Context adapter：`coaching-context-v1.6`
- Transport：MCP Streamable HTTP
- Authentication：Supabase OAuth 2.1 + DCR

Edge Function `verify_jwt=false` 是既有有意配置：函数自身验证 Supabase JWKS、issuer、`aud=authenticated`、`sub`、`session_id`、`client_id` 等 claims；不代表匿名开放。后端只使用 publishable key + 当前 OAuth Bearer token，不暴露 `service_role`。

核心 invariant：

> AI may control future learning intent, but must never rewrite past learning truth.

## 首选高层入口：`get_coaching_context`

高层学习判断优先读取 owner-scoped、预算受限的 Coaching Context，而不是让 ChatGPT 自己拼接大量原始事实。

v1.6 必须保持以下 measurement 分离：

1. `word_attempted`：拼写学习事实；
2. `semanticEvidence`：sourceVersion 4，英文 → 中文词义主动回想的用户自评；
3. `semanticDiscriminationEvidence`：sourceVersion 5，英文 → 版本化参考释义的客观选择；
4. `semanticProductionEvidence`：sourceVersion 6，版本化参考释义 → 当前词书精确英文词头的客观产出；
5. Learning Intent / explicit Cloud Plan future state；
6. execution availability / device runtime；
7. coverage、truncation、unsynced / local-only uncertainty；
8. Reading candidate/provider 状态。

不得把 spelling / recall / discrimination / production 合成没有校准依据的总 mastery score。

### Semantic recall 的解释边界

`semantic_recall_attempted` 是用户在揭示参考释义后做的自评。

它不是 objective correctness，也不能单独证明 contextual comprehension、production ability 或 semantic mastery。

### Objective discrimination 的解释边界

`semantic_discrimination_attempted` 的 measurement 是 `reference_meaning_discrimination`。

正确只代表：学习者在本次展示的版本化参考释义选项中选中了当前词条对应参考项。

不得解释为 free recall、contextual comprehension、Chinese→English production、熟词僻义完整覆盖、collocation / phrase knowledge、semantic mastery 或 memory strength。

### Semantic production 的解释边界

`semantic_production_attempted` 的 measurement 是 `reference_headword_production`。

正确只代表：学习者看到当前版本词书的参考释义后，输入了该词书对应的精确英文词头。

不得解释为：

- 通用中译英；
- 语境写作 / contextual production；
- “其它合理同义词一定错误”的证据；
- 熟词僻义完整覆盖；
- collocation / phrase knowledge；
- semantic mastery；
- memory strength。

production adapter 只读 14 天窗口，最多 500 条有效 sourceVersion 6 facts；invalid rows 单独剔除并进入 coverage。production fingerprint rows 会进入 v1.6 snapshot identity，因此 production facts 变化必须改变 Coaching Context snapshot id。

## v1.5 回退结构

原 v1.5 Coaching Context 实现保存在 `coachingV15.ts`，作为稳定回退基线。

`coaching.ts` 是 runtime dispatcher：

- Deno Edge Runtime → v1.6；
- Node legacy adapter regression → v1.5。

`coachingV16.ts` 必须直接 import `coachingV15.ts`，不能经 `coaching.ts` dispatcher 回调，否则会在 Deno 环境递归。

`check-coaching-production.mjs` 会显式模拟 `globalThis.Deno` 并通过真实 dispatcher 验证 v1.6 Edge 路径；不要把它退化成只直接 import `coachingV16.ts` 的 Node 测试。

## 学习证据读取

### `get_learning_overview`

读取有界时间范围内已同步学习事实概览。拼写首次无错率不是语义掌握率；duration 不是 recall latency；未同步设备数据视为未知。

### `get_weak_words`

返回可解释的近期拼写复习证据排序。排名代表近期有较强复习证据，不代表词义一定不会。

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

`semantic_recall` 已能作为自动 Smart Session activity 到达 executor。

`semantic_discrimination` 与 `semantic_production` 当前都不是独立 Smart Session planner activity。v1.6 只是让 Coach 看见 production evidence，**不是**授权 AI 自动安排 production。

### `clear_learning_intent`

归档 scope，使其停止影响未来 Smart Session；不删除 intent revision，也不删除学习事实。

## Cloud Plan：明确任务，不是每日调度器

Cloud Plan 只承载需要稳定 task identity、due date、completion evidence 或跨设备持久存在的 explicit commitment。

“今天 30 分钟 / 复习优先 / 新词 ≤ 5 / 多做词义回想”等属于 Learning Intent，不应冻结成 Cloud Plan。

### 当前真实 task kind

网站和 MCP 当前真正可执行 / 可创建的 Cloud Plan task kind **只有 `chapter`**。

历史预留的 `smart_review / word_set / dictation / weak_words / mixed_session` 名字不是当前产品能力，MCP 不应创建它们。

### `get_plan_status`

默认读取当前仍有 actionable chapter task 的活动计划，或按 explicit planId 读取历史计划。

Completion 权威是 immutable `chapter_completed` evidence，不是 Plan row、Command receipt 或网页状态。

新 Cloud Plan run 启动时捕获：

- owner；
- `planRevision`；
- `taskFingerprint = chapter:<dictId>:<chapterIndex>`。

新 task-linked facts 携带 revision + fingerprint；当前 task config 改变后，旧执行目标的事实不能误完成新任务。

### `create_study_plan`

创建新的显式 chapter Plan。同一 owner 最多一个 active Cloud Plan；新 create 在 revision 留痕后 supersede 旧 active Plan。

### `revise_study_plan`

修改未来任务，必须使用最新 `expectedRevision`。已有真实 completion evidence 的任务保持 immutable。

### `archive_study_plan`

归档计划，不删除 plan / revision / task / learning facts。

## 网站设备与受控动作

### `get_active_devices`

读取近期 Wenyan Web 设备及 current page / dictionary / chapter / mode / taskRun，并可包含目标设备的短期 execution availability。

运行时可执行性不是学习事实或 mastery。

### `open_today`

排队打开 Today。

### `open_dictionary`

选择真实英文词书并打开 Today。

### `open_chapter`

选择真实英文词书与 zero-based chapterIndex，进入对应学习页。

### `start_task`

启动指定 Cloud Plan chapter task。网站启动前重新通过 Supabase / RLS 验证 Plan/task；新 run 绑定 owner/revision/fingerprint。启动仍不等于完成。

### `get_action_status`

读取 durable command receipt。`effectiveStatus=completed` 只表示浏览器报告网页动作已执行，不表示学习完成。

控制工具都要求稳定 requestId。没有在线可控设备时不得声称动作已执行。

## capability 映射

- `get_learning_intents`：`plans:read` 或 `coach:auto_adjust`
- `revise_learning_intent / clear_learning_intent`：`coach:auto_adjust`
- Cloud Plan writes：`plans:write`
- stage/preferences 用户确认：`preferences:write`
- device read / action status：`navigation:control` 或 `session:control`
- open Today / dictionary / chapter：`navigation:control`
- start task：`session:control`

没有全局历史事实写权限，也没有自动授予 capability。

## Agent 使用原则

推荐顺序：

`read context → 判断 evidence / uncertainty → 必要时调整 bounded future intent → 需要明确 commitment 时才创建/revise Plan → 选定在线设备 → bounded action → 读取 action status → 等待真实 learning facts → 再判断`

必须区分：

- Observed Fact
- Derived Evidence
- User Statement
- AI Inference / Recommendation
- Unknown

blocked / cooldown / stale executor 时不要无限重复写相同 intent。

禁止添加：

- `run_sql(anything)`
- `execute_js(anything)`
- `control_wenyan(anything)`
- 任意历史事实修改工具

## 当前未完成

- production 当前仍是手动专项，不是 Smart Session planner activity；
- 生产 v16 部署时，生产库尚无自然产生的 `semantic_production_attempted` v6 facts，因此“用户真实 v6 → sync → production MCP summary”仍待自然使用后验收；禁止 synthetic personal history；
- 当前会话没有暴露自定义 `$wenyan` tool，因此 ChatGPT 端真实 `get_coaching_context` v1.6 smoke 尚待可调用插件的会话完成；
- 新 Cloud Plan owner/revision/fingerprint 的自然生产回流继续等待真实任务，不制造无意义完成事实；
- Reading Runner 存在，但可信/private provider、eligible candidate admission 与自动 Smart Session orchestration 尚未形成正式主闭环；
- 正式红宝书 provider 尚未接入；可信完整 denominator 不存在时 `observedProgress` 必须为 null；
- contextual meaning、熟词僻义、collocation / phrase 仍没有独立可靠 evidence channel；
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
