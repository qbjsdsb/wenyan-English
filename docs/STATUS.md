# 当前状态 / 续接入口

更新：2026-10-09。

本页只保留 **当前已核实的生产事实、不可破坏边界和下一步缺口**。历史阶段、旧 SHA、旧 PR 状态请看 Git history 与对应专题文档；不要把下方内容与旧聊天记忆混用。

## 生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 最终运行时代码基线：`3b20da322d8d18c64b371b7f228ce380b4eadc3f`
  - PR #54 `Add objective semantic evidence v1`
  - PR #55 `Refine library keyboard flow, calm motion and rendering cost`
- PR #54 合并 SHA：`23f785a97f07fad7884ca1de90f76df40ecba25b`
- PR #55 合并 SHA：`3b20da322d8d18c64b371b7f228ce380b4eadc3f`
- PR #54 CI #245：success
- #54 + #55 重放后的 PR CI #248：success
- 最终 main CI #249：success
- GitHub Pages：Deploy Wenyan Pages #50，build + deploy success
- Supabase：`cmjhxvpkdeheujuteqoi`
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**
- MCP server contract 仍为 0.8.x；Coaching Context：`coaching-context-v1.5`
- `verify_jwt=false` 仍为有意配置：Edge Function 自己校验 Supabase OAuth JWT 的 JWKS / issuer / audience / session / client / authenticated identity；这不代表匿名开放。
- v15 部署固定到不可变最终 main `3b20da3…`。CI 同时生成 `ci-artifacts/wenyan-mcp-deploy.json`，其中包含完整 13 文件函数依赖闭包，作为后续完整源码部署的可复现产物。
- v15 上线后，OAuth protected-resource discovery 已实时返回 HTTP 200，并报告正确 resource、Supabase Auth issuer、`openid` scope。

本页之后如再出现 docs-only closure commit，运行时代码基线仍以上述 `3b20da3…` 为准，除非新的功能提交明确更新本节。

## 当前产品形态

Wenyan English 已进入：

> **Local-first deterministic learning runtime + ChatGPT strategy brain**

核心闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent / Cloud Plan → 本地 Smart Session 执行 → 新事实回流`

Wenyan 负责真实内容、执行器、离线能力、学习事实、权限与硬约束；ChatGPT 负责解释证据、制定未来策略和可逆计划；MCP 负责受限、可验证的连接。

## 已上线学习证据

### 拼写

`word_attempted` 继续表示真实拼写练习事实。零错误拼写不是语义掌握；键间时长不是回忆潜伏期或疲劳指标。

### 词义主动回想

`semantic_recall_attempted` / sourceVersion 4：

- 英文 → 词义的主动心理回想；
- 先回想、再揭示参考释义；
- `recalled / partial / not_recalled` 是用户自评；
- 自评是证据，但不是客观正确率或 mastery。

### 客观参考释义辨认

PR #54 已上线 `semantic_discrimination_attempted` / sourceVersion 5：

- measurement：`reference_meaning_discrimination`；
- 每题只使用真实、带版本的词书参考释义；
- 至少 4 个安全且不同的参考项才出题；
- 不使用 LLM 生成干扰项，不生成假释义；
- 选择结果可客观判分；
- 事实与题目游标同一 Dexie transaction 保存；
- 云端上传与 sourceVersion 5 回拉 parser 均已验证；
- `get_coaching_context` v1.5 将其作为 `derived.semanticDiscriminationEvidence`，与自评 `semanticEvidence` 严格分开。

客观辨认正确只证明：

> 用户在本次给定选项中选中了当前版本词书的参考释义。

它 **不等于** 自由回忆、语境理解、产出能力、熟词僻义覆盖、搭配能力或全局语义掌握。

## Smart Session / AI Coach

- Smart Session：`elastic-v2`。
- 当前可以稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、预算、hard stop、new-word ceiling 和真实执行可用性。
- objective semantic discrimination v1 当前仍是 semantic recall 完成后的可选后续，不是新的 Smart Session planner purpose；这是有意的渐进 rollout。
- Learning Intent scope：`session > day > ongoing > local defaults`。
- Cloud Plan 完成只认匹配 immutable learning fact 的 completion evidence。
- 网站命令 completed 只说明浏览器动作执行，永远不等于学习完成。
- per-device execution availability 已上线；多设备时应使用目标设备自己的短期执行状态，不把运行状态当学习证据。

## ChatGPT / MCP

当前高层入口仍优先使用 `get_coaching_context`，并按需下钻到学习概览、弱词、单词历史、Intent、Cloud Plan 与设备状态。

v1.5 Context 现在能同时区分：

1. spelling evidence；
2. semantic recall self-report；
3. objective reference-meaning discrimination；
4. execution availability / device state；
5. active future intent / plan；
6. 数据覆盖、截断、未同步与不确定性。

Agent 不得把这些证据压成一个没有依据的“掌握率”。

## 日常体验 / 可靠性

最近已正式上线：

- 词汇保存失败不会静默跳到下一词；
- 章节完成等待本地事实真正提交；
- 表单 / 按钮 / IME / 设置区不再被学习快捷键劫持；
- 公开词书具备经过校验的 last-known-good IndexedDB fallback；
- 生产 `/gallery` 使用 `Gallery-N`，搜索覆盖完整匹配词书；
- 选书 / 选章交互改成更明确的原生控件；
- review chapter `-1` 不计入章节覆盖；章节覆盖明确是 practiced chapters，不是 mastery；
- Error Book 分组改为单次 Map 聚合；
- 共享 Dialog 浅深色表面、焦点和 reduced-motion 更一致；
- 去除两层大面积背景 blur，保留克制的输入反馈；
- Reading draft owner isolation、备份导入 staging validation、per-device executor availability 已完成；
- 登录 / 同步 / 退出失败不会永久卡 busy。

## 不可破坏的原则

> AI controls future intent, never past truth.

同时保持：

- Historical learning truth immutable。
- Only the user confirms long-term strategic stage changes。
- ChatGPT reasons; deterministic code guards。
- Command completion != learning completion。
- No evidence != mastery。
- Spelling != semantic mastery。
- Objective discrimination != free recall / contextual comprehension / mastery。
- Wenyan works without AI。
- Wenyan should continue without cloud whenever possible。
- 不增加万能 `run_sql / execute_js / control_wenyan` 一类工具。

## 仍未完成 / 下一阶段

这些是当前真正剩下的高价值缺口，不要机械清空旧 TODO：

1. **真实用户 objective semantic 回流验收**：用户本人完成参考释义辨认 → 正常同步 → 通过 MCP v1.5 再读到真实 `semanticDiscriminationEvidence`。禁止为了验收写假个人历史。
2. **更高质量语义测量**：contextual meaning、熟词僻义、collocation / phrase、Chinese→English production；继续分开 measurement semantics，不做万能 mastery score。
3. **Reading 主闭环**：可信/private provider → content validation → eligible candidates → stage gate → Smart Session → Runner → facts → evidence → Coaching Context。
4. **正式红宝书 provider**：在没有可信完整版本与 denominator 之前，`observedProgress` 必须保持 null。
5. objective semantic 自动进入 Smart Session、跨设备 objective run 恢复，等待真实使用证据后再决定；当前不是 blocker。
6. ordinary chapter 精确刷新恢复尚未实现；已提交学习事实不会丢，Smart Session 有独立 resume 路径。
7. 当前 dictionary cache 不是完整 Service Worker / PWA，不承诺未加载内容的冷启动离线。
8. FSRS 继续延后，直到 semantic/contextual evidence 足够可靠。
9. 文学专业课继续冻结；未来开发前重新核对目标年份南京师大官方招生科目、考试范围和参考信息。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 先重新读取远端 `main`、开放 PR、最新 CI / Pages 和 Supabase Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 优先做一条完整纵向学习价值链，而不是继续无休止 CSS polish；
5. 每个高价值阶段尽早 commit + push，GitHub 必须保留可续接状态。
