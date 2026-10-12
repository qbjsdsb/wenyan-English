# 当前状态 / 续接入口

更新：2026-10-13。

> 本页只记录已经核实的生产事实、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase Edge Function；不要把这里的 SHA 当永久真相。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前 Web / UI 生产基线：`fd557f538d3ffa5ea4abb21715204a79a866d112`，PR #88 `统一纸面微光视觉与学习操作流程` 已 squash merge 到 `main`。
- PR #88 合并前最终 CI run `38288338980`：**success**，包含 lint、type check、deterministic coaching / MCP checks、56 条浏览器流程、production Pages artifact 与 Pages vocabulary / recovery 验证。
- PR #88 合并后 `main` CI run `38288924834`：**success**。
- PR #88 合并后 Pages deploy run `38288924992`：**success**，build 与 deploy 均完成。
- PR #87 `Fix acceptance follow-ups for Cloud Plan and narrow Practice` 的稳定后端 / capability 基线仍为 `8c93ab39d2bb536bfa916fdd91041aacd0184f26`。
- Supabase project：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v20 ACTIVE**。
- v20 部署入口固定 pin 到已验证的 GitHub commit `8c93ab39d2bb536bfa916fdd91041aacd0184f26`；不是随 `main` 漂移。PR #88 没有修改 Edge / MCP 后端协议。
- Edge Function 继续 `verify_jwt=false`，这是既有有意配置；函数本身验证 Supabase OAuth/JWT issuer、audience、subject、session/client identity 与 capability，不代表匿名开放。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.6`。
- Reading 仍是实验入口；文学专业课继续冻结。

## 2026-10-12 生产验收收口

正式实机验收报告：

- `docs/acceptance/PRODUCTION_ACCEPTANCE_2026-10-12.md`
- `docs/acceptance/PLUGIN_MCP_ACCEPTANCE_2026-10-12.md`

已收掉的主要问题：

1. **Today / Cloud Plan helper 权限回归**：恢复 authenticated 对纯 helper 的执行权，`anon` 仍拒绝；前端不再把原始 Postgres/RPC 错误直接暴露给用户。
2. **MCP `plans:read` 授权边界**：外部 OAuth `get_plan_status` 最终由 Postgres fail closed；无 `plans:read` 时返回 `42501 plans_read_not_granted`。
3. **`plans:write` 内部响应兼容**：create/revise/archive RPC 已有的事务级 `wenyan.plan_write_rpc=1` 标记允许写 RPC 在通过 `plans:write` 后内部调用 `get_plan_status`，不会被额外的 `plans:read` 误伤；外部读取边界不放宽。
4. **Practice 窄屏发现性**：640px 以下四个专项入口改为 2×2，可直接发现，不再依赖横向滚动；对应 Playwright 回归已进 CI。
5. **默写无障碍答案泄漏**：发音按钮不再在 accessible name 中暴露隐藏词头。

生产数据库已应用并记录：

- `20261012062110 plan_status_helper_execute`
- `20261012064210 plan_status_plans_read_boundary`
- `20261012082800 plan_status_write_internal_boundary`

生产只读 / 事务回滚探针已经确认：

- first-party / authenticated helper 路径可执行；
- `anon` 无 helper execute；
- 外部 OAuth 无 `plans:read` 时 fail closed；
- 已通过 `plans:write` 的写 RPC 内部响应路径可继续读取刚写入的 plan status；
- 未修改真实学习历史或完成记录。

### 仍保留的非阻塞项

- 验收中发现一条词书释义夹有未翻译英文 token，但报告没有记录精确词条。为避免猜测修改词库，目前保留为 **P3 数据质量项**，后续应做定向词库质量扫描后修复。
- 插件验收曾观测到 Coaching Context `executionAvailability` 为 stale / unknown。历史 / 语义证据读取仍可用，但代理不得把该字段解释为“当前候选池已经实时完整评估”。后续应单独审计 availability freshness / persistence 链路。
- 2026-10-12 验收会话没有暴露 `$wenyan` 自定义工具，因此 PR #87 / Edge v20 部署后没有在该会话再做一次真实消费端 `get_plan_status` 调用。数据库 capability 边界、MCP capability regression、CI 与部署均已验证，但不要把这一点伪称为消费端 E2E。

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

它只表示：学习者看到**当前版本词书的参考释义**后，是否输入了该词书对应的英文词头。

不得解释为：通用中译英、语境写作、同义词排斥能力、semantic mastery 或 memory strength。

Production 仍是手动专项，**没有加入 Smart Session planner**。

## 真实 v6 生产回流已验收

2026-10-12 实机验收已通过正常 UI 自然产生并同步 6 条 `semantic_production_attempted` sourceVersion 6 facts（5 对、1 错）。Cloud Work 随后真实调用生产 `get_coaching_context`，返回 `coaching-context-v1.6`，并能独立识别 `semanticProductionEvidence`。

因此已经验证：

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
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与 executor availability；
- semantic production 当前只做手动专项；
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
- reference-headword production != general translation / contextual production / mastery；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan without AI / network 仍尽量可本地学习；
- owner 隔离不能以破坏 anonymous local-first 为代价；
- 不增加万能 SQL / JS / arbitrary control tool；
- 不伪造个人学习历史、完成记录、掌握率或验证结果。

## 2026-10-13 界面统一与纸面微光（已合并并发布）

PR #88 采取“保留现有 Wenyan 骨架，做收束式精修”的路线，没有采用独立设计原型中的激进重构。主要落地：

### 第一、二批：公共界面与学习流程

- 七个主要页面使用共用标题 / 辅助操作布局；导航在错词、词义子页面保留所属栏目状态，记录与错词可直接切换。
- Today 快捷入口与统计补齐看义写词；四种练习 measurement 继续独立。
- 纸面调整为更中性的暖白 / 炭灰层次、细线和轻阴影；删除常驻聚光、按钮扫光、完成页星点及旧任务重播光效。
- 输入正确只保留短暂 glint 后归于墨色；错误使用短暂暖色和下划线，并尊重 `prefers-reduced-motion`。
- 取消 641–1023px 窗口仍被强制撑到 1024px 的限制，补导航、专项、词库和设置的窄窗布局。
- 拼写结果页收成一个主要下一步，Enter 与主按钮一致；其他练习方式进入次级区域。
- 练习准备栏改为有文字的快捷设置，去掉与主导航重复的统计 / 错词图标；统一三种词义练习顶栏，减少拼写开始 / 暂停时的位置跳动。
- 专项空候选增加可执行的替代入口；同步页正确标注看义写词；导出失败有可见反馈。

### 第三、四批：连续性与记录页

- 修复“专项设置 → 更换词书 / 章节 → 返回专项设置”路径，保留所选模式、范围和每段词数；返回目标只接受已知安全目标。
- Smart Session 恢复提示改为真实剩余词数，去掉重复的云安排说明和常驻状态光晕。
- 记录页按近期拼写、学习日历、词义训练、输入细节重组；两个重复日历合并为一个可切换视图，输入图表默认收起并在展开时才创建。
- 三种词义训练采用统一记录行，各自回到对应模式和范围；保留自评与客观 measurement 的语义边界。
- 图表补充空状态、可访问名称和 reduced-motion 支持；统计日期按天稳定计算。

### 最终验证与发布

- PR #88 首轮 CI 的唯一失败来自 Smart Session E2E 仍匹配旧文案；生产实现已经按 cursor 显示真实剩余数量。
- commit `a8a26157c9c7e86bf9b19dba357cc73339075506` 将测试改为验证“完成 1 / 3 后剩余 2 个”的新语义，没有放宽功能断言。
- PR head 随后的 CI run `38288338980`：**success**，全部 browser flow、production Pages artifact 与 Pages recovery 验证通过。
- PR #88 squash merge 后的生产 commit：`fd557f538d3ffa5ea4abb21715204a79a866d112`。
- `main` CI run `38288924834`：**success**。
- Pages deploy run `38288924992`：**success**，已发布到生产 Pages。
- 本轮没有修改 Learning Fact 语义、账号隔离、AI 编排边界或 Edge / MCP 后端协议。
- 自动浏览器流程已经通过；人工审美验收不视为完成，后续以真实日常使用中发现的具体问题做定点微调，不再开启另一轮大规模视觉换皮。

## 2026-10-13 Interface Finishing Pass（分支，未发布）

分支：`ui/interface-finishing-pass`。这轮不是新视觉方案，而是在 PR #88 生产骨架上做一次定点收缝，目前**尚未合并、尚未发布，也尚未把 CI / 浏览器验证写成成功事实**。

已经提交的主要改动：

- 删除交互层里的 starlight / halo / radial bloom / 同步呼吸光，把正确、错误、完成反馈收成短暂的颜色、边缘、明度变化；Reading 顶部进度改为实色细线。
- Loading 去掉大块 shimmer skeleton，只保留小型状态指示；OAuth / Mobile 等工具页去掉背景 radial glow；设置、同步、数据进度去掉额外发光与渐变。
- 暗色模式显著降低 surface / focus shadow，更多依赖纸面明度和细边界区分层级。
- `body` 恢复可选择文本；Typing Focus 区继续禁止误选，阅读、释义和以后文学材料可正常复制选择。
- 三种词义训练保留现有功能，但把 `TrainingHeader` 后的 focus surface 收成连续 work surface，减少“卡片中的卡片”。
- 900px 以下先压缩 Header 间距，直到 760px 才换成双层导航，改善桌面分屏；Gallery 长列表增加 sticky language / search strip，并适配窄窗 Header 高度。
- Today 删除无意义的副标题，11px 取代关键 10px 元信息，Smart Session 继续保持第一视觉锚点。
- Records 的“暂无拼写数据”改成局部拼写状态，不再让下面仍有词义记录的页面看起来像整页为空；错词为空同样改成安静的局部状态。
- Header 的“学习阶段”不再使用通用齿轮图标，降低与背词页“学习设置”的语义冲突；Header utility active 状态减少强调色占用。
- Practice mode 选中只保留一套主要视觉信号，快捷键字号从 9px 提高，Today / Practice 的阴影和 selected background 进一步收轻。
- 删除未发现使用点的全局 `animate.css` import；依赖本身暂未删除，避免为了清依赖扩大 lockfile 改动。

这轮明确没有修改：Learning Fact 语义、Dexie schema、owner 隔离、Cloud Plan / MCP / Smart Session 协议、Supabase Edge Function、真实学习历史。

## 下一步优先级

1. **先收口 `ui/interface-finishing-pass`。** 只做最小 lint / build / 关键浏览器 smoke；若发现回归只修本轮相关问题，通过后再 PR / merge，不再扩大视觉范围。
2. **主要研发重心转向正式 Reading Loop**：可信 private/provider → 整篇作答 → 一次提交 → immutable reading facts → 复盘 → AI interpretation → future intent。
3. Reading 稳定后，由用户明确确认是否从 `vocabulary` 切到 `mixed`；不得 AI 自动升级长期学习阶段。
4. 单独审计 Coaching Context `executionAvailability` 的 freshness / persistence 链路，避免 stale 状态长期存在。
5. 做一次定向词库数据质量扫描，定位并修复中英文夹杂等 P3 内容问题，不凭验收描述猜词修改。
6. 再依次扩展新题型、完形、翻译、写作；FSRS 与文学模块继续延后。

## 续接顺序

新会话 / Work / Astra 接手：

1. 先读远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function；
2. 再读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`AI_COACHING_LOOP_V1.md` 与两份 2026-10-12 验收报告；
3. 不重做稳定的 Typing / Dexie / OAuth / MCP / Smart Session，也不要重新开启全面 UI redesign；
4. 每个高价值阶段小批次 commit + push，GitHub 始终保持可续接状态；
5. 优先真实学习价值、历史真实性、账号隔离、恢复一致性和跨设备闭环，不继续堆零散功能。