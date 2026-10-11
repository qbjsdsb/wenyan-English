# 当前状态 / 续接入口

更新：2026-10-12。

> 本页记录已核实的生产事实、当前候选工作、不可破坏边界和下一步。新会话接手时仍须重新读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function；不要把这里的 SHA 当永久真相。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前生产功能基线：`395dfde1404de228a57b554b4e94eeb23a76c118`，PR #84 `Reduce explanatory copy across learning surfaces` 已进入 `main`。
- #84 合并后 `main` CI run `38162437331`：**success**。
- #84 合并后 GitHub Pages run `38162437273`：**success**。
- Supabase project：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**，固定加载 GitHub commit `3b20da322d8d18c64b371b7f228ce380b4eadc3f`。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。
- Reading 仍是实验入口；文学专业课继续冻结。

## PR #85：看义写词 / reference headword production

PR #85 `Add reference headword production practice` 当前是已经通过完整候选验证、尚待合并的前端/数据闭环。

最终功能 head：`8b62e8e0a8a0d0cdb4b1ca1fe4899780e7825229`。
最终 PR CI run `38164715875`：**success**，包括 lint、TypeScript、全部 deterministic guardrails、build、54 条 Chromium browser flows、production Pages artifact 与 Pages vocabulary/failure-recovery smoke。

### Measurement

新增 immutable learning fact：

- eventType：`semantic_production_attempted`
- sourceVersion：`6`
- measurement：`reference_headword_production`
- direction：`meaning_to_en`
- cue：`dictionary_meanings`
- responseMode：`typed_headword`

它只表示：学习者看到**当前版本词书的参考释义**后，是否输入了该词书对应的英文词头。

不得解释为：

- 通用中译英能力；
- 语境写作能力；
- “其它同义词一定错误”的证据；
- semantic mastery；
- memory strength。

### 出题边界

- 只有完整可见释义签名在当前词书中只对应一个 normalized headword 的词才可进入 production；
- 可见释义若直接包含目标英文词头，出题前即排除；例如 `bridle` 的释义中直接出现 `bridle`，不能产生有效 production fact；
- 专项训练准备页在 production 模式不预览英文目标词；runner 提交前 DOM 也不暴露正确词头；
- 答案保存成功后才显示当前版本词书参考词头。

### 执行 / 恢复

- 第一版只开放**手动专项训练**，不进入 Smart Session；
- production run 支持暂停、继续、结束、刷新恢复；结束执行不伪造完成；
- 最后一题提交后仍先显示本题反馈，再进入结果；
- `learningEvents` fact 与 authoritative run cursor 在同一 Dexie 事务提交；
- 提交与结束都捕获 owner，并在事务内重新读取和二次确认；账号切换 fail closed；
- 重复提交由 authoritative cursor 阻止；hard stop 不允许继续写事实；
- `词义模糊` 词池可以利用最近 production 写错证据，但 recall / discrimination / production 三种 measurement 仍独立统计，不合成“总掌握率”。

### Sync / backup

- browser upload RPC 是通用 Learning Event ingest，sourceVersion 6 会原样上传；生产数据库约束只要求 `source_version > 0`，因此本功能**不需要 Supabase schema migration**；
- cloud pull 已显式允许 `semantic_production_attempted` v6，并使用严格 parser；现有 `event-restore` 回归验证 v6 能恢复、保持 owner、推进同步 cursor；
- 本机备份使用整库 Dexie staging + 原子恢复，没有 event-type/source-version 白名单，因此 v6 自动随 `learningEvents` 备份/恢复，无需新备份格式。

### Browser acceptance

focused production 回归真实覆盖：

`进入专项 → production 已选中 → 准备页不泄目标词 → 进入 runner → 释义出现但答案不在 DOM → 写对 → 保存事实后显示词头 → 下一词 → 刷新恢复已保存 cursor → 写错 → 最后一题仍先反馈 → 结果显示 1 对 / 1 错 → Exactly 2 条 v6 facts → run completed`

同时验证直接泄露词头的 cue 不进入 run。

## Semantic cloud / MCP 当前边界

生产库已有自然产生的 v4/v5 semantic facts，并已完成后端纵向验收：

- `semantic_recall_attempted` v4：24 条；
- `semantic_discrimination_attempted` v5：10 条；
- 验收时全部满足生产 parser；没有为验收伪造个人学习历史。

生产 MCP v15 / Coaching Context v1.5 当前仍只消费：

- spelling evidence；
- `semanticEvidence`（v4 self-report recall）；
- `semanticDiscriminationEvidence`（v5 objective reference choice）。

**PR #85 不修改或部署 MCP。v6 production evidence 尚未进入生产 Coaching Context。**

下一阶段应新增独立 `semanticProductionEvidence`，并同时更新 fingerprint、coverage、uncertainty、epistemic guidance、adapter descriptor 与 deterministic adapter tests。仍不得合并成 mastery score。

本会话当前也没有暴露自定义 `$wenyan` 插件工具，所以不能伪称已经从 ChatGPT 端完成 live `get_coaching_context` smoke。

## 其它稳定边界

- Review execution：manual / smart / correction 共享 owner-bound contract；origin-less legacy review 继续保持旧语义；匿名 `undefined === undefined` 是合法 local owner。
- Smart Session：`elastic-v2`；Learning Intent precedence：`session > day > ongoing > local defaults`。
- Cloud Plan 当前真实可执行 task kind 只有 `chapter`；completion 只能由 matching immutable fact 推导。
- Workspace State 只承担跨设备工作位置连续性，不是 Learning Fact。
- Remote Control browser RPC 已 captured-owner / generation fail closed；command completion 不是 learning completion。
- ErrorBook / Analysis 暂不机械改成 current-owner-only 查询；legacy companion 去重仍需要跨 owner 检查，正确性优先于局部查询性能。

## 不可破坏 invariant

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

必须继续保持：

- Historical learning truth immutable；
- AI controls future intent, never past truth；
- Only the user confirms long-term learning-stage changes；
- No evidence != mastery；Spelling != semantic mastery；
- recall / discrimination / production 是不同 measurement；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan without AI / network 仍尽量可本地学习；
- owner 隔离不能以破坏 anonymous local-first 为代价；
- 不增加万能 SQL / JS / arbitrary control tool；
- 不伪造个人学习历史、完成记录、掌握率或验证结果。

## 下一步优先级

1. 合并并生产验收 PR #85（main CI + Pages 都必须通过后才称上线）。
2. 新开独立分支把 v6 `semanticProductionEvidence` 接入 MCP Coaching Context，更新 deterministic tests / docs，CI 通过后再部署 Edge Function；不要与 Smart Session 混做。
3. 等用户自然产生 production facts 后，再验收 `local → sync → production MCP evidence`；禁止 synthetic personal history。
4. 在能调用 `$wenyan` 的 ChatGPT 会话做一次真实 `get_coaching_context` live smoke。
5. 只有真实 usage 证明 production 值得自动编排后，才考虑加入 Smart Session；当前保持手动专项。
6. 随后把主要研发重心转向真实 Reading Loop：private/provider → 整篇作答 → 一次提交 → immutable facts → AI 复盘 → future intent；用户确认后才从 vocabulary 切到 mixed。
7. 阅读稳定后再依次扩展新题型、完形、翻译、写作；FSRS 与文学模块继续延后。

## 续接顺序

新会话 / Work / Astra 接手：

1. 先读远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function；
2. 再读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`AI_COACHING_LOOP_V1.md`；
3. 不重做稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 每个高价值阶段小批次 commit + push，GitHub 始终保持可续接状态；
5. 优先真实学习价值、历史真实性、账号隔离、恢复一致性和跨设备闭环，不继续堆零散功能。