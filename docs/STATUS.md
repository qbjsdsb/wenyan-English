# 当前状态 / 续接入口

更新：2026-10-09。

本页只保留 **当前已核实的生产事实、不可破坏边界和下一步缺口**。历史阶段、旧 SHA、旧 PR 状态请看 Git history 与对应专题文档；不要把下方内容与旧聊天记忆混用。

## 生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 前端生产代码基线：`982cba3cba39ca8c4b4e6012643a9da7639c4eef`
  - PR #56 `Make daily vocabulary practice recoverable and calmer`，合并 `39bcdf7`，最后仅指标文案/文档收口 `982cba3`
  - PR #54 `Add objective semantic evidence v1`
  - PR #55 `Refine library keyboard flow, calm motion and rendering cost`
- PR #54 合并 SHA：`23f785a97f07fad7884ca1de90f76df40ecba25b`
- PR #55 合并 SHA：`3b20da322d8d18c64b371b7f228ce380b4eadc3f`
- PR #54 CI #245：success
- #54 + #55 重放后的 PR CI #248：success
- 上一生产基线 main CI #249：success
- PR #56 CI #251：完整 success；新生产基线的自动 main CI 另见 run `37927645884`
- GitHub Pages：最新部署 run `37927645763`，build + deploy success，源码 `982cba3`；旧 #50 对应 `3b20da3`
- Supabase：`cmjhxvpkdeheujuteqoi`
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**
- MCP server contract 仍为 0.8.x；Coaching Context：`coaching-context-v1.5`
- `verify_jwt=false` 仍为有意配置：Edge Function 自己校验 Supabase OAuth JWT 的 JWKS / issuer / audience / session / client / authenticated identity；这不代表匿名开放。
- v15 部署固定到其部署时不可变源码 `3b20da3…`；PR #56 未改动 MCP/Edge Function 源码，前端本机恢复不要求重新部署后端。CI 同时生成 `ci-artifacts/wenyan-mcp-deploy.json`，其中包含完整 13 文件函数依赖闭包，作为后续完整源码部署的可复现产物。
- v15 上线后，OAuth protected-resource discovery 已实时返回 HTTP 200，并报告正确 resource、Supabase Auth issuer、`openid` scope。

本页之后如再出现 docs-only closure commit，前端运行时代码基线仍以上述 `982cba3…` 为准，后端源码仍为 `3b20da3…`，除非新的功能提交明确更新本节。

## 2026-10-09 vocabulary focus / recovery（PR #56）

- **Baseline**：本轮从最新 main `572a609` 建立 `polish/vocabulary-focus-and-recovery`；上述生产基线未因本分支代码改变。
- **Implemented**：普通英语章节的本机恢复（Dexie v8），单词事实与下一保存位置原子写入；账号/词书/章节/taskRun 隔离，严格内容签名、随机顺序、循环计数和记录引用验证。未完成的当前词重新输入；章节提交失败可以刷新恢复；重开只丢弃游标、不删除历史。
- **Truth**：普通章节含未完成输入的词时只结束本段，不生成 chapter_completed / chapterRecords。已保存单词事实保留；已有 review / Smart Session 的完成与恢复边界保持兼容。
- **Experience**：首字母直接开始且不丢失；Esc 暂停；隐藏窗口暂停；词表支持单词/释义搜索、当前位置、已练状态与继续按钮；原生发音按钮的名称/焦点完善；结果页区分已练词、拼写无错和输入准确率，支持仅练本次错词；反复输错给提示而不臆测“插件冲突”。
- **Tested**：一次定向浏览器批次 7 通过、1 因测试读取逐字母 innerText 换行失败；修正为 textContent 后只重跑该用例并通过，覆盖随机/循环/账号/内容变化。类型检查通过；源码定向 lint 通过。无需反复运行全套测试。
- **Visual / interaction QA**：词表浅深色、结果页中文截图已检查；首词中途重开与只练错词流程通过，页面无异常。CI #250 的算法/类型/构建通过，浏览器旧文案断言和过早读取 fixture 已修正；只重跑相关三项，全通过（26.9s）。
- **Merged / tested**：PR #56 合并为 `39bcdf7b8c74f02c303bea7187bd61816b9b39a3`；CI #251（run `37926660281`）完整通过，包括算法、类型、构建、浏览器和 Pages 恢复。
- **Deployed / smoke verified**：Pages build + deploy success（run `37927645763`，源码 `982cba3`）；线上首页 HTTP 200，发布后的入口 bundle 包含新 typingCheckpoints 表。
- **Real-user verified**：本轮尚未由用户本人走完真实学习；合成浏览器验收不等于个人学习验收。设计和代码均进入 PR #56；不将本机恢复称为跨设备恢复或完整离线 PWA。游标只在完成词时保存，用时恢复到最近已提交词的边界。

## Vocabulary practice desk（PR #57，分支实施中）

- Baseline：最新 main `6b3369197c15db9239b145f74216863a2655237d`。
- Implemented：`/practice` 集中提供拼写 / 词义主动回想 / 参考释义四选一；当前章、已练、近 14 天最近一次仍拼错、仍模糊的词池；每段 6 / 12 个词，普通章节拼写沿用原完整章节。Today、主导航、暂停背词、拼写结束均有入口。
- Implemented：manual semantic runs 用同一 sourceVersion 4/5 immutable fact + atomic cursor；新 origin 只区分本机运行，不改上传合同。手动词义段不会被 Smart Session 恢复或绑定云计划；既有 Smart 后续辨认恢复修正为正确路由。专项拼写使用真实 ReviewRecord，并带本机 owner 边界。
- Implemented：词义证据在记录页和 Today 可见；回想、自评与客观辨认不混成掌握率。模糊池验证当前释义 hash，旧版本不继承。自评揭示后焦点回到题目，鼠标开启也能继续数字键操作。
- Designed / deferred：中文→英文辨认需要独立版本化的测量 / 云端 parser，暂不假装已实现；当前有提示/发音的默写仍只记录真实拼写条件。易混词依真实选错记录归入模糊池，不生成假混淆关系。
- Validation：正在进行一次必要的类型、定向 lint 和核心浏览器验收。尚未 merged / deployed / real-user verified。阅读、MCP 与 Supabase 保持本轮 scope 之外。

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
- 公开词书具备经过校验的 last-known-good CacheStorage fallback；
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
6. ordinary English chapter 的已提交词边界恢复已随 PR #56 合并；当前未完成输入重输。跨设备/多标签并发恢复未实现，Smart Session 使用独立 resume 路径。
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
