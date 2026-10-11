# 当前状态 / 续接入口

更新：2026-10-12。

> 本页只记录已经核实的生产事实、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase Edge Function；不要把这里的 SHA 当永久真相。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前功能代码基线：`5d8ac1fe13a89e58fbdaa2f115a8087e1f2f496d`，PR #86 `Add semantic production evidence to Coaching Context v1.6` 已 squash merge 到 `main`。
- #86 合并后 `main` CI run `38168048312`：**success**。
- 该 main CI 已通过 lint、TypeScript、Smart Session / Review / Semantic / AI Coaching / OAuth deterministic guardrails、旧 v1.5 cloud adapter、v1.6 production evidence Edge-dispatch regression、MCP source packaging、production build、54 条 Chromium browser flows、Pages artifact 与 Pages recovery。
- 看义写词前端来自 PR #85，生产代码基线 `d4427da76a2eb9e96054f60de91a83fe8f11e592`；#85 main CI `38165104928` 与 Pages deploy `38165105082` 均为 **success**。
- Supabase project：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v16 ACTIVE**。
- v16 部署入口固定 pin 到已验证的 GitHub main commit `5d8ac1fe13a89e58fbdaa2f115a8087e1f2f496d`；不是随 `main` 漂移。
- Edge Function 继续 `verify_jwt=false`，这是既有有意配置；函数本身验证 Supabase OAuth/JWT issuer、audience、subject、session/client identity 与 capability，不代表匿名开放。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.6`。
- Reading 仍是实验入口；文学专业课继续冻结。

## 词汇学习：当前已上线能力

### 四种专项训练

当前专项训练包括：

1. 拼写；
2. 英文 → 中文词义主动回想；
3. 英文 → 版本化参考释义客观辨认；
4. 版本化词书释义 → 英文词头主动产出（看义写词）。

看义写词使用：

- eventType：`semantic_production_attempted`
- sourceVersion：`6`
- measurement：`reference_headword_production`
- direction：`meaning_to_en`
- cue：`dictionary_meanings`
- responseMode：`typed_headword`

它只表示：学习者看到**当前版本词书的参考释义**后，是否输入了该词书对应的英文词头。

不得解释为：通用中译英、语境写作、同义词排斥能力、semantic mastery 或 memory strength。

### 看义写词出题 / 执行边界

- 只有完整可见释义签名在当前词书中只对应一个 normalized headword 的词才可出题；
- 可见释义若直接包含目标英文词头，出题前即排除；
- 准备页与 runner 提交前不在 DOM 暴露标准英文词头；
- 提交成功后才显示当前版本词书参考词头；
- production run 支持暂停、继续、结束、刷新恢复；
- 最后一题先显示本题反馈，再进入结果；
- Learning Fact 与 authoritative run cursor 在同一 Dexie 事务提交；
- owner 在异步边界捕获并在事务内再次确认，账号切换 fail closed；
- `词义模糊` 词池可以利用最近 production 写错证据，但 recall / discrimination / production 仍是三条不同 semantic measurement。

### Sync / backup

- browser Learning Event ingest 对 sourceVersion 6 通用兼容，不需要数据库 migration；
- cloud pull 已显式支持 `semantic_production_attempted` v6，并走严格 parser；
- v6 已进入现有 event-restore 回归；
- 本机备份为整库 Dexie staging + 原子恢复，不需要增加新的 v6 备份格式。

## Coaching Context v1.6：已部署

生产 MCP 现在把以下学习证据保持为彼此独立的通道：

- spelling evidence；
- `semanticEvidence`：sourceVersion 4，词义主动回想的用户自评；
- `semanticDiscriminationEvidence`：sourceVersion 5，客观 reference-choice；
- `semanticProductionEvidence`：sourceVersion 6，客观 exact reference-headword production。

v1.6 的 production adapter：

- 只读 `semantic_production_attempted`；
- 只接受 sourceVersion 6；
- 严格复用 `parseSemanticProductionPayload()`；
- 14 天窗口，最多读取 500 条有效 facts；
- invalid rows 单独剔除并进入 coverage；
- production fingerprint rows 会进入新的 snapshot identity；production facts 变化必须改变 snapshot id；
- `adapter.semanticProductionReadStatus` 与 `snapshotDescriptor.semanticProductionFacts` 显式暴露该通道状态；
- agent guidance 明确 production 不是 general translation、contextual production、synonym rejection evidence 或 semantic mastery。

### v1.5 回退与 Edge 验证

原 v1.5 实现以 `coachingV15.ts` 原 blob 保留，不重写其逻辑。

PR #86 review 曾真实发现一个 P1：第一版 `coachingV16.ts` 错从 dispatcher `coaching.ts` 导入 v1.5，在 Deno Edge Runtime 会递归回 v1.6。已修为直接导入 `coachingV15.ts`。

同时 `scripts/check-coaching-production.mjs` 现在显式设置伪 `globalThis.Deno`，通过真实 `coaching.ts` dispatcher 进入 v1.6，因此该回归覆盖的是 Edge 分支，不再只是 Node 直接 import。

## 生产 v6 数据验收边界

2026-10-12 部署 v16 后，使用只读 SQL 查询生产 `learning_events`：

- 当前自然产生的 `semantic_production_attempted` v6 facts：**0 条**。

因此现在已经验证的是：

`前端 v6 fact contract / local persistence / cloud pull → MCP v1.6 production read path → production Edge Function v16 deployment`

但还**不能**声称已经完成“用户本人真实 v6 fact → sync → production MCP summary”的数据回流验收。禁止为了 smoke 制造个人学习历史。

等用户自然做一次看义写词并同步后，再只读检查 v6 facts 与 MCP `semanticProductionEvidence` 即可。

本会话也没有暴露自定义 `$wenyan` 插件工具，因此尚未从 ChatGPT 侧实际调用一次生产 `get_coaching_context`；不要伪称最后一跳已验收。

## Smart Session / AI Coach

- Smart Session：`elastic-v2`；
- Learning Intent precedence：`session > day > ongoing > local defaults`；
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与 executor availability；
- semantic production **当前只做手动专项**，尚未成为 Smart Session planner activity；
- 只有真实 usage 证明 production 提供稳定、独立的学习价值后，才考虑自动编排；不要仅因为已经有 v6 evidence 就机械加入 planner；
- AI 只判断未来策略；deterministic planner / executor 负责可执行约束与真实完成判定。

## Cloud Plan / Workspace / Control

- Cloud Plan 当前真实可执行 task kind 只有 `chapter`；completion 只能由 matching immutable learning fact 推导；
- Workspace State 只承担跨设备工作位置连续性，不是 Learning Fact；
- Remote Control browser RPC 已 captured-owner / generation fail closed；command completion 不是 learning completion；
- manual / smart / correction spelling 使用共享 owner-bound review contract；origin-less legacy review 继续保持旧语义；
- 未登录 `undefined === undefined` 是合法匿名 local owner，owner 隔离不能破坏 local-first 学习。

## 不可破坏 invariant

主闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

必须继续保持：

- Historical learning truth immutable；
- AI controls future intent, never past truth；
- Only the user confirms long-term learning-stage changes；
- No evidence != mastery；Spelling != semantic mastery；
- recall / discrimination / production 是不同 measurement；
- objective discrimination != free recall / contextual comprehension / mastery；
- reference-headword production != general translation / contextual production / mastery；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan without AI / network 仍尽量可本地学习；
- owner 隔离不能以破坏 anonymous local-first 为代价；
- 不增加万能 SQL / JS / arbitrary control tool；
- 不伪造个人学习历史、完成记录、掌握率或验证结果。

## 下一步优先级

1. 用户自然完成至少一次看义写词并同步后，只读验收 `local v6 fact → cloud → production MCP semanticProductionEvidence`；不要 synthetic history。
2. 在能调用 `$wenyan` 的 ChatGPT 会话做一次真实生产 `get_coaching_context` smoke，确认 v1.6 四类 evidence 与 uncertainty 边界。
3. 在出现一定真实 production usage 后，再判断它是否值得进入 Smart Session；默认保持手动专项。
4. 主要研发重心转向正式 Reading Loop：可信 private/provider → 整篇作答 → 一次提交 → immutable facts → 复盘 → AI interpretation → future intent。
5. Reading 稳定后，由用户明确确认是否从 `vocabulary` 切到 `mixed`；不得 AI 自动升级长期学习阶段。
6. 再依次扩展新题型、完形、翻译、写作；FSRS 与文学模块继续延后。

## 续接顺序

新会话 / Work / Astra 接手：

1. 先读远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function；
2. 再读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`AI_COACHING_LOOP_V1.md`；
3. 不重做稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 每个高价值阶段小批次 commit + push，GitHub 始终保持可续接状态；
5. 优先真实学习价值、历史真实性、账号隔离、恢复一致性和跨设备闭环，不继续堆零散功能。
