# 当前状态 / 续接入口

更新：2026-10-12。

> 本页只记录已经核实的生产事实、不可破坏边界和下一步高价值工作。新会话接手时仍必须重新读取远端 `main`、开放 PR、最新 CI / Pages 与 Supabase Edge Function；不要把这里的 SHA 当永久真相。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`。
- 当前功能代码基线：`8c93ab39d2bb536bfa916fdd91041aacd0184f26`，PR #87 `Fix acceptance follow-ups for Cloud Plan and narrow Practice` 已 squash merge 到 `main`。
- #87 合并后 `main` CI run `38224363222`：**success**。
- #87 合并后 Pages deploy run `38224363200`：**success**。
- PR #87 合并前最终 CI run `38223857144`：**success**；两个 P1 review thread 均已修复并 resolved。
- Supabase project：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v20 ACTIVE**。
- v20 部署入口固定 pin 到已验证的 GitHub main commit `8c93ab39d2bb536bfa916fdd91041aacd0184f26`；不是随 `main` 漂移。
- Edge Function 继续 `verify_jwt=false`，这是既有有意配置；函数本身验证 Supabase OAuth/JWT issuer、audience、subject、session/client identity 与 capability，不代表匿名开放。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.6`。
- Reading 仍是实验入口；文学专业课继续冻结。

## 2026-10-12 生产验收收口

正式实机验收报告在：

- `docs/acceptance/PRODUCTION_ACCEPTANCE_2026-10-12.md`
- `docs/acceptance/PLUGIN_MCP_ACCEPTANCE_2026-10-12.md`

本轮已经收掉的主要问题：

1. **Today / Cloud Plan helper 权限回归**：恢复 authenticated 对纯 helper 的执行权，`anon` 仍拒绝；前端不再把原始 Postgres/RPC 错误直接暴露给用户。
2. **MCP `plans:read` 授权边界**：外部 OAuth `get_plan_status` 最终由 Postgres fail closed；无 `plans:read` 时返回 `42501 plans_read_not_granted`。
3. **`plans:write` 内部响应兼容**：create/revise/archive RPC 已有的事务级 `wenyan.plan_write_rpc=1` 标记允许写 RPC 在通过 `plans:write` 后内部调用 `get_plan_status`，不会被额外的 `plans:read` 误伤；外部读取边界不放宽。
4. **Practice 窄屏发现性**：640px 以下四个专项入口改为 2×2，可直接发现，不再依赖横向滚动；对应 Playwright 回归已进 CI。
5. **默写无障碍答案泄漏**：发音按钮不再在 accessible name 中暴露隐藏词头，已在前一轮生产修复并回归。

生产数据库已应用并记录：

- `20261012062110 plan_status_helper_execute`
- `20261012064210 plan_status_plans_read_boundary`
- `20261012082800 plan_status_write_internal_boundary`

生产只读/事务回滚探针已经确认：

- first-party / authenticated helper 路径可执行；
- `anon` 无 helper execute；
- 外部 OAuth 无 `plans:read` 时 fail closed；
- 已通过 `plans:write` 的写 RPC 内部响应路径可继续读取刚写入的 plan status；
- 未修改真实学习历史或完成记录。

### 仍保留的非阻塞项

- 验收中发现一条词书释义夹有未翻译英文 token，但报告没有记录精确词条。为避免猜测修改词库，目前保留为 **P3 数据质量项**，后续应做定向词库质量扫描后修复。
- 插件验收曾观测到 Coaching Context `executionAvailability` 为 stale / unknown。历史/语义证据读取仍可用，但代理不得把该字段解释为“当前候选池已经实时完整评估”。这不是本轮为了收口而仓促改写 planner/runtime 的理由；后续应单独审计 availability 刷新链路。
- 当前会话没有暴露 `$wenyan` 自定义工具，因此 PR #87 / Edge v20 部署后没有在本会话再做一次真实消费端 `get_plan_status` 调用。数据库 capability 边界、MCP capability regression、CI 与部署均已验证，但不要把这一点伪称为消费端 E2E。

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

因此现在已经验证：

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

## 下一步优先级

1. **主要研发重心转向正式 Reading Loop**：可信 private/provider → 整篇作答 → 一次提交 → immutable reading facts → 复盘 → AI interpretation → future intent。
2. Reading 稳定后，由用户明确确认是否从 `vocabulary` 切到 `mixed`；不得 AI 自动升级长期学习阶段。
3. 单独审计 Coaching Context `executionAvailability` 的 freshness / persistence 链路，避免 stale 状态长期存在。
4. 做一次定向词库数据质量扫描，定位并修复中英文夹杂等 P3 内容问题，不凭验收描述猜词修改。
5. 再依次扩展新题型、完形、翻译、写作；FSRS 与文学模块继续延后。

## 续接顺序

新会话 / Work / Astra 接手：

1. 先读远端 `main`、开放 PR、最新 CI / Pages、Supabase migration 与 Edge Function；
2. 再读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`AI_COACHING_LOOP_V1.md` 与两份 2026-10-12 验收报告；
3. 不重做稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 每个高价值阶段小批次 commit + push，GitHub 始终保持可续接状态；
5. 优先真实学习价值、历史真实性、账号隔离、恢复一致性和跨设备闭环，不继续堆零散功能。

## 2026-10-13 界面统一与纸面微光（开发分支，尚未发布）

用户本轮要求优先界面整体性、减少冗余和打磨细节；采用小批次提交，减少验证开销。

第一批：
- 七个主要页面使用共用标题/辅助操作布局；导航在错词、词义子页面保留所属栏目状态，记录与错词可直接切换。
- 今日快捷入口与统计补齐看义写词；移除与拼写并列的无错数，四种练习口径仍独立。
- 纸面使用暖白/炭灰层次、细线和轻阴影；删除常驻聚光、按钮扫光、完成页星点以及旧任务重播光效。
- 输入正确短暂发光后归于墨色；错误用短暂暖色和下划线，降低整词抖动幅度；尊重减少动态效果设置。
- 切页保留导航和内容占位；去掉页面祖先 transform 动画，避免影响 fixed / sticky 定位。
- 取消 641–1023px 窗口仍被强制撑到 1024px 的限制，补导航、专项、词库和设置的窄窗布局。

验证：本批 `tsc --noEmit` 通过（共用标题/导航与主要样式调整后）；未跑完整测试，未发布网站，未修改学习事实/计划执行/同步协议。下一批继续打磨练习准备与结果操作层级。

第二批：
- 拼写结果页只保留一个主操作（纠错 / 下一章 / 返回所属流程），Enter 与主按钮一致；默写、重练、词义训练收进可展开区域。关闭结果也回到所属专项或错词页。
- 练习准备栏改为有文字的快捷设置，去掉与主导航重复的统计/错词图标；补齐开关可访问名称、设置页键盘焦点、嵌套弹层边界与短窗口高度。
- 统一词义回想、选择词义、看义写词的练习页顶栏；补齐此前缺失的 kicker 样式及输入焦点变量；正确答案只短暂照亮边缘。
- 固定桌面拼写开始/暂停时的顶栏、工具栏和提示占位，减少单词位置跳动；平板说明改为非阻塞文字。
- 专项空候选增加切换到词义回想的操作；同步页正确标注看义写词；导出失败显示可见提示。
- 随输入提示文案更新已有测试定位文本，未增加测试套件。

本轮验证：最终 `tsc --noEmit`、生产 `vite build --base=./`、`git diff --check` 均通过；已改动 TS/TSX 的 ESLint 为 0 errors、5 条既有模式警告。构建仍有大 chunk 提醒，本轮没有为此改动打包架构。未运行单元或 E2E 套件。实机视觉检查未完成：本地 Playwright 缺浏览器二进制，Cloud Browser 无法连接容器的本地服务；未追加安装和反复验证。

保存/发布：用户于 2026-10-13 明确授权上传到公开仓库并创建 PR。两批改动已通过已连接的 GitHub 接口保存到 `polish/luminous-paper-coherence`，对应提交 `9bb20fa`、`83a1463`，文件树与本地两批提交完全一致。PR：[#88](https://github.com/qbjsdsb/wenyan-English/pull/88)。**尚未合并或发布**。

下一步：在可用浏览器中快速查看 Today / Practice / Typing / Settings 的浅深色及窄窗，检查 PR 必要检查结果，再决定合并。学习事实、数据隔离、AI 编排与后端协议均未改动。
