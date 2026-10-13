# 当前状态 / 续接入口

更新：2026-10-13。

> 本页只记录已经核实的生产事实、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase Edge Function；不要把这里的 SHA 当永久真相。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前 Web / UI 应用代码基线：`7119bda0787c5868294f8209c493adb42fd2ac9f`，PR #96 `Finish split-screen and IME interaction craft` 已 squash merge 到 `main`。
- PR #96 合并前 CI run `38329728397`：**success**。lint、type check、deterministic learning / coaching / MCP checks、浏览器流程、production Pages artifact 与 Pages vocabulary / recovery 验证全部通过。
- PR #96 合并后 `main` CI run `38330110029`：**success**。
- PR #96 合并后 Pages deploy run `38330110085`：**success**，已发布到生产 Pages。
- 稳定后端 / capability 基线仍来自 PR #87：`8c93ab39d2bb536bfa916fdd91041aacd0184f26`。
- Supabase project：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v20 ACTIVE**。
- v20 部署入口固定 pin 到已验证 commit `8c93ab39d2bb536bfa916fdd91041aacd0184f26`；UI finishing 没有修改 Edge / MCP 后端协议。
- Edge Function 继续 `verify_jwt=false`，这是既有有意配置；函数本身验证 Supabase OAuth/JWT issuer、audience、subject、session/client identity 与 capability，不代表匿名开放。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.6`。
- Reading 仍是实验入口；文学专业课继续冻结。

## 2026-10-12 生产验收收口

正式实机验收报告：

- `docs/acceptance/PRODUCTION_ACCEPTANCE_2026-10-12.md`
- `docs/acceptance/PLUGIN_MCP_ACCEPTANCE_2026-10-12.md`

已确认并修复：

1. Today / Cloud Plan helper authenticated 权限回归；`anon` 仍拒绝。
2. 外部 OAuth `get_plan_status` 最终由 Postgres `plans:read` 边界 fail closed。
3. 已通过 `plans:write` 的写 RPC 内部可读取刚写入的 plan status，不会被额外 `plans:read` 误伤。
4. Practice 640px 以下四个专项入口改为 2×2，避免依赖横向滚动。
5. 默写发音按钮不再在 accessible name 中暴露隐藏词头。

生产数据库已应用并记录：

- `20261012062110 plan_status_helper_execute`
- `20261012064210 plan_status_plans_read_boundary`
- `20261012082800 plan_status_write_internal_boundary`

生产探针已经确认 first-party / authenticated helper、`anon` 拒绝、外部 OAuth capability 边界与写 RPC 内部响应路径。未修改真实学习历史或完成记录。

### 仍保留的非阻塞项

- 验收中曾发现一条词书释义夹有未翻译英文 token，但没有记录精确词条。保留为 **P3 数据质量项**，后续只能通过定向词库质量扫描修复，不凭描述猜词。
- Coaching Context 曾观测到 `executionAvailability` stale / unknown。历史 / 语义证据读取仍可用，但代理不得把该字段解释为“当前候选池已经实时完整评估”。后续单独审计 freshness / persistence。
- 2026-10-12 验收会话没有暴露 `$wenyan` 自定义工具，因此 PR #87 / Edge v20 部署后没有在该会话再次做真实消费端 `get_plan_status` 调用。数据库 capability、MCP regression、CI 与部署已验证，但不得伪称这一条消费端 E2E 已完成。

## 词汇学习：当前上线能力

当前专项训练包括：

1. 拼写；
2. 英文 → 中文词义主动回想；
3. 英文 → 版本化参考释义客观辨认；
4. 版本化词书释义 → 英文词头主动产出（看义写词）。

看义写词 Learning Fact：

- eventType：`semantic_production_attempted`
- sourceVersion：`6`
- measurement：`reference_headword_production`
- direction：`meaning_to_en`
- cue：`dictionary_meanings`
- responseMode：`typed_headword`

它只表示学习者看到**当前版本词书的参考释义**后，是否输入了该词书对应的英文词头。不得解释为通用中译英、语境写作、同义词排斥、semantic mastery 或 memory strength。

Production 仍是手动专项，**没有加入 Smart Session planner**。

## 真实 v6 生产回流已验收

2026-10-12 实机验收已通过正常 UI 自然产生并同步 6 条 `semantic_production_attempted` sourceVersion 6 facts（5 对、1 错）。Cloud Work 随后真实调用生产 `get_coaching_context`，返回 `coaching-context-v1.6`，并独立识别 `semanticProductionEvidence`。

已验证：

`真实 UI production → local immutable fact → sync → Supabase learning_events → production MCP v1.6 → semanticProductionEvidence`

不得把这 6 条测试会话结果推广成长期掌握率。

## Coaching Context v1.6

生产 MCP 保持以下证据通道彼此独立：

- spelling evidence；
- `semanticEvidence`：sourceVersion 4，词义主动回想的用户自评；
- `semanticDiscriminationEvidence`：sourceVersion 5，客观 reference-choice；
- `semanticProductionEvidence`：sourceVersion 6，客观 exact reference-headword production。

不得合并成总 mastery score。

## Smart Session / AI Coach

- Smart Session：`elastic-v2`；
- Learning Intent precedence：`session > day > ongoing > local defaults`；
- 稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与 executor availability；
- semantic production 当前只做手动专项；
- AI 只判断未来策略；deterministic planner / executor 负责可执行约束与真实完成判定。

## Cloud Plan / Workspace / Control

- Cloud Plan 当前真实可执行 task kind 只有 `chapter`；completion 只能由 matching immutable learning fact 推导；
- Workspace State 只承担跨设备工作位置连续性，不是 Learning Fact；
- Remote Control browser RPC 已 captured-owner / generation fail closed；command completion 不是 learning completion；
- manual / smart / correction spelling 使用共享 owner-bound review contract；origin-less legacy review 保持旧语义；
- 未登录 `undefined === undefined` 是合法匿名 local owner，owner 隔离不能破坏 local-first 学习。

## 2026-10-13 界面与交互收口：已合并并发布

PR #88 到 #96 已连续完成一轮“保留原 Wenyan 骨架、只做收束式精修”的生产打磨。没有采用独立 HTML 设计实验的激进改版。

当前长期视觉规则见：

- `docs/VISUAL_QUALITY_SYSTEM_2026-10-13.md`
- `docs/INTERFACE_AUDIT_2026-10-13.md`
- `docs/FINAL_PRODUCT_CRAFT_AUDIT_2026-10-13.md`

### 已落地的核心原则

- Desk / Focus / Folio / Index / Utility 可以有不同密度，但共用 Paper / Ink、排版尺度、细边界与交互物理。
- 一屏一个主要视觉锚点；结构优先使用留白与对齐，边框其次，背景再次，阴影最后。
- `Light happens, ink remains`：正确、错误、完成只允许短暂而有意义的状态变化，不用星点、aurora、常驻 glow 或装饰性粒子。
- `One event, one signal`：同一状态不再同时叠背景色、边框、阴影、图标、文字多重喊话。
- Focus 页更接近连续工作面；Index / Utility 页允许更密、更理性；Reading 保持正文优先。
- UI 元信息通常不低于 11px；键盘 `focus-visible` 必须清楚；正文重新允许文本选择。
- 暗色主要靠 surface luminance 与细边界区分，不靠深阴影制造悬浮卡片。
- 纯页面入场、报表 stagger、搜索结果入场、Reading 逐题 reveal 等无信息动效已经收掉。

### 主要生产改动

- Today 保留原信息结构，Smart Session 成为第一视觉锚点，专项与概况降权而不删功能。
- Typing / 词义回想 / 选择词义 / 看义写词统一为 Focus family；正确 / 错误反馈更接近“墨迹校订”。
- 看义写词增加 IME composition guard，中文输入法候选确认期间 Enter 不会误提交；Playwright 已加入对应回归。
- Reading 增加“专注文章”模式，结果反馈改为安静边缘标记；正文排版继续保持阅读优先。
- Gallery 的语言 / 搜索工具条在长列表中保持可用；PR #96 修复窄桌面下 Header、sticky toolbar 与分类导航潜在叠层。
- Records / ErrorBook 空状态改为局部、上下文相关状态，不再套整页 SaaS 式模板。
- Sync、学习阶段、OAuth、Mobile、设置等工具页统一到更平、更可靠的 Utility grammar。
- 浏览器 `theme-color` / manifest 与当前 Paper 深浅色体系一致。
- Switch、Listbox、Slider 等设置控件补齐统一键盘 focus ring。

### 验证事实

- PR #96 合并前 CI `38329728397`：**success**，包含新增 IME 回归在内的 browser flows 全部通过。
- 生产代码 commit：`7119bda0787c5868294f8209c493adb42fd2ac9f`。
- 合并后 `main` CI `38330110029`：**success**。
- Pages deploy `38330110085`：**success**。
- 本轮未修改 Learning Fact、Dexie schema、owner isolation、Cloud Plan / MCP / Smart Session contract、Supabase Edge Function 或真实学习历史。

### 当前 UI 决策

视觉方向已定型，**停止新的全面 UI redesign / 主题探索**。以后只接受真实日常使用中可复现的问题做小步修复。

仍存在的主要技术债是 CSS source-of-truth 逐层历史覆盖（`wenyan.css` + 多个 polish 层）。它当前不构成已知用户阻塞，但后续如整理，目标只能是**不改变视觉结果的规则归并**，不能借“清 CSS”再次改版。

## 不可破坏 invariant

主闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

必须继续保持：

- Historical learning truth immutable；
- AI controls future intent, never past truth；
- Only the user confirms long-term learning-stage changes；
- No evidence != mastery；Spelling != semantic mastery；
- recall / discrimination / production 是不同 measurement；
- reference-headword production != general translation / contextual production / mastery；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan without AI / network 仍尽量可本地学习；
- owner 隔离不能以破坏 anonymous local-first 为代价；
- 不增加万能 SQL / JS / arbitrary control tool；
- 不伪造个人学习历史、完成记录、掌握率或验证结果。

## 下一步优先级

1. **主要研发重心转向正式 Reading Loop**：可信 private/provider → 整篇作答 → 一次提交 → immutable reading facts → 复盘 → AI interpretation → future intent。
2. Reading 稳定后，由用户明确确认是否从 `vocabulary` 切到 `mixed`；不得 AI 自动升级长期学习阶段。
3. 单独审计 Coaching Context `executionAvailability` 的 freshness / persistence 链路，避免 stale 状态长期存在。
4. 做一次定向词库数据质量扫描，定位并修复中英文夹杂等 P3 内容问题，不凭验收描述猜词修改。
5. UI 只处理真实使用证据；如做 CSS 归并，必须 visual-no-op、单独小 PR、完整 CI。
6. 再依次扩展新题型、完形、翻译、写作；FSRS 与文学模块继续延后。

## 续接顺序

新会话 / Work / Astra 接手：

1. 先读远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function；
2. 再读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`AI_COACHING_LOOP_V1.md`、三份界面质量文档与两份 2026-10-12 验收报告；
3. 不重做稳定的 Typing / Dexie / OAuth / MCP / Smart Session，也不要重新开启全面 UI redesign；
4. 每个高价值阶段小批次 commit + push，GitHub 始终保持可续接状态；
5. 优先真实学习价值、历史真实性、账号隔离、恢复一致性和跨设备闭环，不继续堆零散功能。
