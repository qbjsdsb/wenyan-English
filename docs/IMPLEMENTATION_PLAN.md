# Wenyan English：产品与实施计划

更新：2026-10-07。适用仓库：qbjsdsb/wenyan-English。

## 1. 目标与优先级

面向个人、电脑优先的考研学习网站。先做好英语，再接现代文学与当代文学。复用 Qwerty Learner 的打字、听写、词库与错词体验，不重写学习引擎。

最终闭环：网站记录学习事实 → Supabase 保存个人长期历史 → ChatGPT 通过专用 MCP 查询细节和分析 → 写入有依据的学习计划 → 网站展示并启动对应练习 → 真实完成记录回流 → 下次调整计划。

用户明确要求可写计划，因此旧文档的只读限制是上线次序，不是永久产品边界。优先级：数据可信与计划闭环 > 每天使用舒服 > 更多题型 > 文学扩展。首批不接模型 API、不做聊天框、不自动购买服务。

## 2. 实际基线与缺口

检查基线：main `c6b1c7a`（Merge Supabase sync v1），上游 Qwerty `1182426f2bd0a28c95302c33f9e19136b1262a70`。

| 已有代码 | 实际边界 |
| --- | --- |
| React 18 + Vite 4 + TS + Tailwind + Jotai | 保留工具链和 yarn.lock，不搭 monorepo |
| Dexie v4：词、章节、复习和 learningEvents | 旧表不能破坏；新增表递增版本 |
| word_attempted、chapter_completed | 没有正式 session、任务关联、首次反应时间、跳过/暂停事实 |
| Supabase Auth + 每 30 秒上传最多 100 条 | 当前是上传队列，不是完整双向恢复；本机数据尚未按账号分区 |
| SQL：RLS、幂等 ingest、overview、weak words | 仓库有 SQL 不等于远端已部署或已验收 |
| docs/MCP_TOOLS.md | 有工具设计，尚无可连接的 MCP 服务 |
| 页面：练习、词库、错词、统计、云同步 | 缺安静的学习主页、计划列表与执行反馈 |
| Playwright | 原配置指向上游生产站；本项目验证必须改为本地站 |
| GitHub Pages workflow | 仍监听 master 且含上游 Gitee 镜像；不能作为本项目已发布的证据 |

仓库绑定的 publishable key 不是 secret，但不能由此推断远端配置、用户身份或权限已核实。现有上传队列还需要处理未捕获异常、账号切换隔离、大队列追赶和下拉恢复。

## 3. 每日使用与界面

### 信息结构

- 今日学习：继续上次词书/章节、当日真实练习概况、待执行计划。
- 词库：保持成熟选词/选章节流程，考研词书易找到，不擅自更改用户已选词书。
- 错词与回顾：错误字母、重复错误、近期变化；区分拼写错误与不会词义。
- 学习记录：逐次、逐词记录，筛选时间/词书/模式/任务，显示数据范围与同步新鲜度。
- 同步与连接：邮箱登录、待上传数、失败状态、最近成功时间、ChatGPT 授权与撤销。

### 视觉规则

暖白或浅灰背景、深灰文字、单一克制的强调色；内容宽度约 1080–1200px。中文正文 14–16px，阅读行高 1.6；练习单词仍是视觉中心。减少巨大 logo、漂浮阴影、推广弹窗和无关社交入口；保留 LICENSE、上游归属和来源入口。暗色支持、可见键盘焦点、空状态/失败态与窄桌面都必须可用。

主页主要行动只有“继续学习”，计划按今天和之后排列。没有记录就显示没有记录，不填样例数据，不显示虚构掌握率。计划来源标为“手动 / 导入 / ChatGPT”；未接服务时明确说明，不把 JSON 导入包装成自动连接。

第一批保留 `/` 练习路由兼容已有返回链接，新增 `/today` 入口；迁移默认首页前统一检查旧页面的返回路径。文学暂不显示空模块。

## 4. 数据：让 ChatGPT 看到什么

### 已有事实口径

- word_attempted：完成的一次单词输入，包括词书、章节、错误次数、错键位置、键间耗时。
- 其 durationMs 是键间耗时之和，不含首键前思考，不能称为反应速度或记忆速度。
- chapter_completed：章节完成与现有计时器秒数；单词数/按键数分开。
- 首次无错率描述拼写表现，不等于词义掌握、不等于考试正确率。
- 未埋点的历史细节无法事后还原；旧记录导入必须标记来源和缺失字段。

### v2 事件（下一阶段）

公共字段：id、schemaVersion、subject、activityType、occurredAt、receivedAt、userId（服务端确定）、deviceId、sessionId、planId/taskId（可空）、source。

英语事实补充：itemId（词书+单词）、practiceMode（展示/听写）、hintUsed、firstKeyLatencyMs、activeDurationMs、wrongCount、mistakes、outcome（完成/跳过）、interruptions。不记录网站以外键盘、不录屏。暂停/切后台排除有效学习时间；时钟异常标为低可信。

`session_started / session_paused / session_finished / word_attempted / word_skipped` 追加写入。任务完成来自这些事实；AI 不能创建用户“已经学会”或“已经做完”的记录。

数据库先落本地并入 outbox，同一事务保证事实与待同步状态一致。UUID 幂等；分页使用时间+UUID游标；下拉依服务端 received_at，不能只看客户端时间。重复上传不增加计数。

### 持久化边界

| 数据 | 写入方 | 冲突策略 |
| --- | --- | --- |
| learning_events | 网站学习行为 | 不可变、UUID去重 |
| study_plans / plan_tasks | 用户或受限 MCP | revision 乐观锁、幂等请求键、来源与理由 |
| task_progress | 由事实推导 | 唯一事件关联，不能只靠点击开始 |
| word_state | 可重算服务 | algorithmVersion + evidenceIds，非权威事实 |
| integration_audit | 服务端 | 记录工具、请求ID和对象ID，禁记令牌 |

账号切换：匿名本地历史要用户认领后才能上传；已绑定账户的数据不能发给另一账户。计划缓存需按 userId 分区，退出即清除当前展示。首批本地计划只宣称“本机保存”，后续云同步迁移必须显式认领。

## 5. 学习计划契约与执行

计划含：id、schemaVersion、subject、title、origin、timezone、revision、createdAt、evidenceWindow、reason、tasks。任务含：id、kind、dueDate、title、target、estimatedMinutes、completionRule。v1 target 是现有词书和零基章节；后续支持限定单词列表与真题组。

状态：draft → active → completed / archived；任务 pending → in_progress → completed，支持 skipped/deferred，保留原因。计划修订保留已经完成的证据，不覆盖历史。

首批最小实现：结构化 JSON 导入并校验、存入 IndexedDB、首页按日期展示、按钮准确切换到指定词书和章节、完成该次章节后关联事实。用户可导出计划备份。导入只是 MCP 之前的过渡通路，不声称联网。

执行约束：

1. 校验词书存在、章节范围、日期、文本长度、任务数量、ID唯一性、协议版本；拒绝未知的执行类型/URL/脚本。
2. “开始任务”只激活任务。切到别的词书/章节不得误记完成；完成后回到主页可见状态。
3. 同一章节关联一个明确激活的任务，重复回调不能重复计数。复习模式不误算为指定章节任务。
4. 本地进度在刷新后保留；保存失败显式报错。导入已有ID不得静默覆盖完成记录。
5. ChatGPT 工具未来返回保存成功的 planId、revision 和网站链接；文字建议未落库不能声称创建成功。

排计划策略：先获取最近 7/30 天和数据完整性，询问或读取可用时间，再安排有依据的复习和适量新学；留弹性，不预设每天固定高强度。计划可行性依据用户目标与历史实际用时。FSRS 等算法先比较适配性，不把拼写次数硬套记忆评分。

## 6. ChatGPT 插件方案

采用远程 MCP 的 Streamable HTTP `/mcp`，使用现成 SDK。ChatGPT 中对话进行分析和计划生成，网站消费结构化计划。本阶段无须网站自行调用 OpenAI 模型 API；未来站内自动分析是独立的成本/鉴权决策。

### 认证与托管

优先验证 Supabase OAuth 2.1 Server 作为授权服务器，MCP 为资源服务器。需要 OAuth 发现、PKCE、受保护资源元数据、合适的客户端注册方式、令牌签名/issuer/audience/expiry验证。不能只解码 JWT、不能公开无鉴权个人学习数据、不能把 Supabase 管理 MCP 当学习插件。

Supabase 官方文档的 OAuth 示例不代表其 resource/audience/custom scopes 已完全满足 OpenAI 的最新要求。先做小型握手验证；核实实际支持的 claims、注册及刷新流程。如果使用应用权限表区分 read/write，必须服务端执行，不能把未经支持的 scope 写进计划当已实现。

个人单账号：网站仍需持久登录身份（邮箱链接），无需多租户后台。MCP 用经过验证的用户令牌调用 RLS 保护的数据；禁止共享 service_role 给浏览器或 ChatGPT。不开放任意 SQL、文件写入或历史事件修改。

静态前端和 MCP 后端分开部署；GitHub Pages 不能运行 MCP。选已有可用托管、兼容 HTTPS/OAuth 回调、低运维方案；实际免费额度和休眠策略部署时再查。不默认新增付费实例。用户账户是否能添加自定义 MCP 以实际界面与工作区限制为准。

### 工具分批开放

| 工具 | 目的 | 关键限制 |
| --- | --- | --- |
| get_learning_overview | 时间窗口总览 | 时区、数据起止、缺失范围、最后同步时间 |
| list_learning_events | 逐次学习细节 | 游标、最大100条、类型/词书/日期筛选 |
| get_word_history | 单词历次表现 | 确定 itemId，返回事实ID |
| get_weak_words | 错词排序及理由 | 最多100词，非“不会”的定论 |
| get_recent_sessions | 连续学习过程 | v2 session 数据到位后开放 |
| get_study_plan | 当前计划与进度 | 用户身份、revision |
| create_study_plan | 保存可执行计划 | 幂等键、完整schema、词书校验、来源 |
| revise_study_plan | 调整未来任务 | expectedRevision；冲突拒绝，不覆盖已完成 |
| archive_study_plan | 取消后续安排 | 可恢复；不删除学习事实 |

先只读连接通过真实验收，再开放 create/revise。readOnlyHint/destructiveHint/idempotentHint 准确填写，它们是提示，不能代替鉴权。任何写工具都不能伪造用户完成事实。

数据可按需读全，不在每次请求灌入全部历史。先看概要，再钻取某个词/某次学习，节约上下文。词条、材料、计划理由都作为数据处理，不能成为额外工具执行指令。

## 7. 分阶段实施和验收

| 阶段 | 交付 | 验收 | 依赖 |
| --- | --- | --- | --- |
| P0 本次 | 本计划、续接文件、今日入口、本地计划执行与导出 | 编译/lint；导入→启动→真实完成→刷新保留；无假数据 | 已有仓库 |
| P1 事实与同步加固 | session/任务事件、失败重试、账号隔离、下拉恢复 | 离线、重复上传、双浏览器、账号切换、不丢不串 | Supabase访问与测试账户 |
| P2 只读插件 | OAuth、MCP、逐词查询、总览 | ChatGPT真实连接；跨账户拒绝、过期拒绝；与网页统计一致 | HTTPS部署、身份配置 |
| P3 云计划闭环 | 计划表/RLS/RPC、网站计划同步、受限写工具 | ChatGPT创建→网站显示→练习→事实反馈→调整 | P1/P2 |
| P4 英语深化 | 听写反馈、可解释复习、长难句/阅读/完形/翻译 | 题源授权与答案证据、可复盘、长期使用 | 稳定数据模型 |
| P5 文学 | 作家/作品/流派、名词解释/简答/论述、背诵 | 来源回链、人工核对、背诵与客观题评分区分 | 英语闭环稳定 |

不承诺未经估算的日历工期；以可验证交付推进，每阶段拆小提交。P0不包含已经上线插件的承诺。

## 8. 为文学扩展留的空间

以 subject（english / modern_literature / contemporary_literature）与 activityType 扩展，不把所有学习单位命名为 word。以后抽出内容适配器：内容ID、展示、作答、评分、复习建议。英语先用现有词书和章节；文学内容建独立表，保留作者、版本、页码、来源、授权与人工审核状态。不要现在提前造通用 CMS、知识图谱或向量数据库。

## 9. 测试、风险与额度

- 先修 Playwright 指向本地；关键用例只覆盖计划执行、事实数据和权限边界。
- 构建不等于类型检查；分别运行 lint、tsc、build。
- 本地 E2E 不伪称远端 Supabase/OAuth 通过；真实账号联调单独记录。
- 远端部署前跑 RLS/advisors；匿名、另一用户、OAuth读客户端写事实均应被拒绝。
- GPL-3.0、原 LICENSE 和上游归属保留；未来题源单独审核，不把开源软件许可等同词库/试题版权授权。
- 优先复用现有依赖。按主题提交并立即推送，避免大型未提交改动；每次记录“已完成/未完成/下一条命令/验证结果”。
- 会话开始先读 AGENTS.md、docs/STATUS.md、本文，再核对远端 head 与实际代码。不能只相信上次总结。

## 10. 调研依据（2026-10-07 阅读）

1. [上游 Qwerty Learner](https://github.com/RealKai42/qwerty-learner)：现有仓库的 UPSTREAM.md、源代码、LICENSE 是复用依据。
2. [OpenAI 自定义 MCP](https://developers.openai.com/api/docs/guides/custom-mcp-server)：支持读写工具及远程连接；实际可用性依账户/工作区。
3. [OpenAI 插件认证](https://developers.openai.com/plugins/build/auth)：OAuth 2.1、资源元数据、PKCE与服务端令牌校验。
4. [Supabase OAuth Server](https://supabase.com/docs/guides/auth/oauth-server)：身份服务与RLS集成。
5. [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)：发现、注册与认证接入参考。
6. [Supabase changelog](https://supabase.com/changelog)：实现前复核；Markdown索引抓取不支持，已读取HTML入口。

以上为架构选择依据，不代表当前仓库已拥有这些线上能力。具体代码/API以实施当时官方文档、安装版本和真实验证为准。
