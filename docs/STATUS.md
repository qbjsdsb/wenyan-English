# 当前状态 / 续接入口

更新：2026-10-13。

> 本页只记录已经核实的生产事实、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase Edge Function；不要把这里的 SHA 当永久真相。

## Reading Intelligence v1 · 独立 stacked 分支

- 分支 `astra/reading-intelligence-v1`，基于 PR #97 封口 head `993f75029e071b2d37e5ec95b0d58416cb1719da`；不修改 main 或 PR #97。
- 首批落地纯 TS reading evidence core：v3 事实完整对账后才纳入计数，明确窗口/覆盖/重复练习/墙钟时间/证据样本边界。
- 合同见 `docs/READING_INTELLIGENCE_V1.md`。没有能力总分、错因判定、标签诊断或私人正文输出。
- 尚未接生产 MCP、自动 Reading executor 或新 Intent 写权限；本轮未运行测试/构建/lint，未部署。

## 2026-10-13 阅读连续性修复（分支待合并）

- 草稿恢复校验题号、选项、重复答案、修改次数和开始时间；提交事实前重复校验，损坏草稿不会被写成学习证据。
- 提交期间锁定答案，并以同步提交锁阻止重复调用；避免展示答案与已保存事实不一致。
- 草稿保存失败明确提示；跨标签页账号变化重新载入独立草稿，专注文章时也可看到错误提示。
- 提交前明确提示未答题数；复盘区分答对、答错、未作答，不改变 v3 fact 口径。
- 保留现有视觉、题源和数据库 schema；正式题源 provider、提交后刷新恢复复盘仍待后续。
- 验证：TypeScript 检查、改动文件 lint 与 diff 检查通过。4 项定向阅读回归因本地缺少 Playwright Chromium，均未进入浏览器执行；已保留回归用例交给仓库 CI。未安装额外浏览器，未执行全量测试或生产部署。

## 2026-10-13 智能学习入口连续性（同一分支待合并）

- 自动前台/定时刷新不再抢占已开始的启动操作；同步启动锁避免重复创建练习。
- 准备与启动的每个异步边界核对请求代次及账号；旧结果不能在账号/页面切换后触发导航或覆盖新状态。
- 补充标签页可见、网络恢复、跨标签账号切换监听；恢复后及时重算下一段，避免只依赖窗口 focus 和一分钟定时器。
- 类型检查与改动文件 lint 通过；没有重跑全量测试。executionAvailability 后端持久化新鲜度仍待独立审计，不能把本次前端刷新修复描述为该项已解决。
- 代码通过 GitHub connector 保存到 `fix/reading-and-study-continuity`；命令行 push 缺少凭据，不影响 connector 提交。生产 main 未改变。

## 2026-10-13 题库接入推进（分支开发，未合并）

- 新增 Reading Pack v1 解析与本地存储：纯文本、标准答案校验、账号隔离、原子导入、重复跳过、同版本不同内容拒绝覆盖。
- Dexie v10 只新增 readingPassages，原学习表不变；完整备份自动包含题库。私人正文不上传学习事件或 GitHub。
- 保留题源链接、使用声明、来源版本、考试年份与英一/英二信息；导入内容不自动进入 Smart Session。
- 新增 /reading 题库入口：题包预览、导入、分包导出、搜索、英一/英二与年份筛选；阅读路由按内容版本打开私人题目。
- 阅读加载增加账号/版本隔离与失败反馈；演示篇目独立收起，题库页可下载原创示例包。
- 新增 ESQ 1.0/1.1 纯文本 reading_a 转换脚本，保留来源/许可/版本，按年输出；未运行。英语其他题型与四门文学的接入边界见 `docs/CONTENT_EXPANSION.md`。
- 用户明确要求不测试、不合并；本轮不运行测试、构建或 lint，不声称通过验证。

## 2026-10-13 阅读复盘推进（继续分支提交，未合并）

- 新增从当前账号 immutable reading facts 还原历史结果的接口；逐题答案、题目版本、计数与完整性全部匹配才允许复盘。
- 提交接收稳定 attempt UUID，并在同一 Dexie 事务中检查 completion 主键，重试不重复生成整篇及逐题事实。
- 草稿新增可选 attemptId，兼容已有草稿；实际提交使用该 ID，提交后 URL 固定 attempt，刷新按历史事实还原。
- 新增 /reading/history 阅读记录入口，可查看答对/答错/未答，筛选有遗漏的练习并进入对应版本复盘；缺少私人题目正文时保留历史、提示重新导入。
- 复盘支持全部题目/错题与未答切换，不创建新事实；可显式重新练习，保留旧记录。
- 增加题目导航、来源许可说明、复盘读取失败后的重试；按固定版本直接查找正文，避免无关损坏篇目阻断复盘。
- 修正复盘状态的可空类型、历史目录类型及单篇导出大小边界。
- 按用户要求，本轮不执行测试、lint、构建，不合并、不部署。

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
