# MCP tool contract

更新：2026-10-09。

Wenyan English 使用独立远程 MCP：`supabase/functions/wenyan-english-mcp/` 是英语插件的源码真相。Supabase 中更早的 `wenyan-mcp` 属于旧 Wenyan 路线，不作为当前英语插件生产实现复用。

## 当前生产版本

- Supabase project：`cmjhxvpkdeheujuteqoi`
- Edge Function：`wenyan-english-mcp`
- Production Edge Function：**v15 ACTIVE**
- 最终运行时代码基线：`3b20da322d8d18c64b371b7f228ce380b4eadc3f`
- MCP server contract：**0.8.0**
- Coaching Context adapter：**coaching-context-v1.5**
- Transport：MCP Streamable HTTP
- Authentication：Supabase OAuth 2.1 + DCR

v15 固定到不可变 final-main commit `3b20da3…`。CI 同时生成 `ci-artifacts/wenyan-mcp-deploy.json`，包含完整 13 文件依赖闭包，作为后续完整源码部署的可复现 payload。

生产 v15 上线后，OAuth protected-resource discovery 已实时返回 HTTP 200，并报告正确 resource、Supabase Auth issuer 与 `openid` scope。

## 认证与安全边界

- Edge Function `verify_jwt=false` 是有意配置：函数自身使用 Supabase JWKS、issuer、`aud=authenticated`、`sub`、`session_id`、`client_id` 等 claims 执行 OAuth resource-server 校验；这不代表匿名开放。
- 后端只使用 publishable key + 当前 OAuth Bearer token，不读取或暴露 `service_role`。
- 数据层继续由 RLS、SECURITY INVOKER RPC 和当前 OAuth client capability 共同约束。
- `openid` 只证明身份，不等于 Wenyan capability。
- capability 查询失败时受限能力 fail closed。
- 学习历史 `learning_events` 不允许 AI 修改或删除。
- Learning Intent / Cloud Plan 是未来意图，不是过去事实。
- 网站命令回执只证明网页动作执行；它永远不是学习完成证据。

核心 invariant：

> AI may control future learning intent, but must never rewrite past learning truth.

## 首选高层入口：`get_coaching_context`

高层学习判断优先读取 owner-scoped、预算受限的 Coaching Context，而不是让 ChatGPT 自己拼接大量原始事实。

v1.5 会明确分开：

1. `word_attempted` 拼写证据；
2. `semanticEvidence`：sourceVersion 4 的词义主动回想 **用户自评**；
3. `semanticDiscriminationEvidence`：sourceVersion 5 的 **客观参考释义辨认**；
4. Learning Intent / Cloud Plan 的未来状态；
5. execution availability / device runtime；
6. coverage、truncation、unsynced / local-only 风险与 uncertainty；
7. Reading candidate 状态（provider 不可用时必须如实降级）。

### Objective semantic 的解释边界

`semantic_discrimination_attempted` 的 measurement 是：

`reference_meaning_discrimination`

正确只代表：学习者在本次展示的四个版本化参考释义中，选中了当前词条对应的参考项。

不得把它解释为：

- free recall；
- contextual comprehension；
- Chinese→English production；
- 熟词僻义完整覆盖；
- collocation / phrase knowledge；
- semantic mastery；
- readiness / memory strength。

自评 semantic recall 与 objective discrimination 必须保持两个独立 evidence channel，不合成无依据的总掌握率。

### Context 快照语义

- cloud word history 有界读取，截断、坏行、离线/未同步设备都会降低 coverage；不得假装是完整人生学习史。
- 读取冻结 `created_at <= receivedAtOrBefore` 的接收水位，避免分页期间新事实移动边界。
- `snapshot.id` 是内容 SHA-256 指纹，不是服务端持久对象。
- evidence refs 是聚合查询描述，不是可回放句柄。
- word facts、semantic facts、preferences、intent、runtime 来自多个读取；不得包装成单数据库事务快照。
- 输出预算仍受限；不得为了 transport 静默删掉关键不确定性。

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

创建或修改一个 future scope。必须使用当前 revision 做 optimistic concurrency；网络重试才复用相同 requestId/payload。

当前 bounded constraints：

- `focusDictionary`
- `targetMinutes`
- `hardStopMinutes`
- `newWordCeiling`
- `reviewPreference = balanced | review_first`
- `intensity = gentle | normal`
- `preferredActivities`

`preferredActivities` 当前包含现有受控 activity 枚举；objective semantic discrimination v1 **尚未**成为新的 Smart Session planner activity，因此不为它扩大 intent/tool surface。

Rationale 的 summary / basis / confidence / uncertainties 是未来决策解释，不是 immutable learning fact。

### `clear_learning_intent`

归档 scope，使其停止影响未来 Smart Session；不删除历史 intent revision，也不删除学习事实。

## Cloud Plan v2

### `get_plan_status`

读取活动计划或指定计划。只有匹配 immutable learning event 的 `completionEventId / completedAt` 才是完成证据。

### `create_study_plan`

创建未来 chapter 计划。执行器只接受受控任务结构，不接受万能脚本或任意 SQL。

### `revise_study_plan`

修改活动计划的未来任务。必须使用最新 `expectedRevision`；已有 completion evidence 的任务保持 immutable。

### `archive_study_plan`

归档计划，不删除 plan / revision / task / learning facts。

## 网站设备与受控动作

### `get_active_devices`

读取近期 Wenyan Web 设备及 current page / dictionary / chapter / mode / taskRun，并可包含具体设备自己的短期 `executionAvailability`。

per-device execution availability 是运行时可执行性，不是学习事实或 mastery。

### `open_today`

排队打开 Today。

### `open_dictionary`

选择真实英文词书并打开 Today。

### `open_chapter`

选择真实英文词书与 zero-based chapterIndex，进入对应学习页。

### `start_task`

启动指定 Cloud Plan chapter task。启动不是完成。

### `get_action_status`

读取 durable command receipt。只有 `effectiveStatus=completed` 表示浏览器报告网页动作已执行；仍不表示学习完成。

控制工具都要求稳定 requestId。没有在线可控设备时不得声称动作已执行。

## capability 映射

MCP 在调用 RPC 前做 capability 预检查，数据库仍是最终安全边界：

- `get_learning_intents`：`plans:read` 或 `coach:auto_adjust`
- `revise_learning_intent / clear_learning_intent`：`coach:auto_adjust`
- Cloud Plan writes：`plans:write`
- stage/preferences 的受控用户确认：`preferences:write`
- device read / action status：`navigation:control` 或 `session:control`
- open Today / dictionary / chapter：`navigation:control`
- start task：`session:control`

没有全局历史事实写权限，也没有自动授予 capability。

## Agent 使用原则

ChatGPT 的推荐执行顺序：

`read context → 判断 evidence / uncertainty → 必要时调整 bounded future intent → 选定在线设备 → 发送受控动作 → 读取 action status → 重新读取 fresh runtime → 等待真实 learning facts → 再调整`

必须区分：

- Observed Fact
- Derived Evidence
- User Statement
- AI Inference / Recommendation
- Unknown

blocked / cooldown / stale executor 时不要无限重复写相同 intent。结束得早、保持原计划或建议休息都可以是正确结果。

禁止添加：

- `run_sql(anything)`
- `execute_js(anything)`
- `control_wenyan(anything)`
- 任意历史事实修改工具

## 当前未完成

- objective semantic discrimination 尚未自动进入 Smart Session planner；v1 是 semantic recall 后的可选后续。
- objective run 不支持跨设备无缝迁移。
- 用户本人完成 objective exercise → sync → MCP v1.5 读取真实 `semanticDiscriminationEvidence` 的 post-release 验收仍待真实使用触发；禁止制造假个人学习记录。
- Reading Runner 存在，但可信/private provider、eligible candidate admission 与自动 Smart Session orchestration 尚未完整接通。
- 正式红宝书 provider 尚未接入；在可信完整 denominator 不存在时 `observedProgress` 必须为 null。
- contextual meaning、熟词僻义、collocation / phrase、Chinese→English production 尚未形成独立可靠 evidence channel。
- FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。

## 相关文档

- `docs/STATUS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/AI_COACHING_LOOP_V1.md`
- `docs/AI_COACH_CONTRACT.md`
- `docs/LEARNING_INTENT_V1.md`
- `docs/SMART_SESSION_V1.md`
- `docs/CLOUD_PLAN_V2.md`
- `docs/COMMAND_BUS.md`
- `docs/OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`
