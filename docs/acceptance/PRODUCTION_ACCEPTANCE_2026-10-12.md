# Wenyan English 生产版本产品验收报告

**验收结论：PASS WITH ISSUES**

## 1. Executive Summary

截至 2026-10-12，生产网站可用于日常本机词汇学习。拼写、词义回想、词义辨认、看义写词、Today/Smart Session 的开始与恢复、错词本、记录分析、同步和 MCP 的主要真实用户路径均已在生产环境实测。看义写词是 Practice 中可直接选择的独立入口；未加入 Smart Session。

本轮未发现阻止本机继续学习的 P0/P1 问题。存在一个 Today 云端任务更新权限错误、窄屏专项入口横向溢出，以及一条释义含未翻译英文片段。已修复默写模式的屏幕阅读标签泄漏，并在生产站复核。整体适合日常使用，但云端任务更新和窄屏操作仍有改进空间。

本报告区分实际页面验收、CI 回归和未测试边界。未将回想自评解释为客观正确率，也未生成总 mastery score。测试通过正常界面创建的记录是真实学习事实；没有直接写库伪造事实，也没有把原有未归属本机记录认领给账号。

## 2. Test Environment

| 项目 | 实际环境 |
|---|---|
| 日期 | 2026-10-12 |
| 被测 main 代码 SHA（报告提交前） | `60ba1ce7e8c34d00281e6e72409ee0005de21614` |
| Pages 生产网站 | [https://qbjsdsb.github.io/wenyan-English/](https://qbjsdsb.github.io/wenyan-English/) |
| Pages 部署 | GitHub Actions `Deploy Wenyan Pages`，run `38209510256`，success；部署 SHA 与被测代码 SHA 相同 |
| CI | GitHub Actions `Wenyan CI`，run `38209510205`，success；55 条 Chromium 浏览器用例通过，Pages 词库与失败恢复验证 7 条通过 |
| 浏览器 | Chrome Cloud Browser；约 490 CSS px 宽视口；页面时区 Asia/Shanghai |
| 登录状态 | 同步与 MCP 纵向验收期间登录现有账号；浏览器会话重置后，本机恢复和最后的默写无障碍复核在未登录状态进行 |
| Supabase Edge Function | `wenyan-english-mcp` ACTIVE version 16；部署源码 pin 到 GitHub commit `5d8ac1fe13a89e58fbdaa2f115a8087e1f2f496d` |
| Coaching Context | 实际调用返回 `coaching-context-v1.6` |
| 个人学习数据 | 使用真实账号和正常 UI 操作；本轮通过界面产生并同步的 v6 看义写词记录为 6 条（5 对、1 错），另有真实回想与辨认事实；报告不包含词头、事件 ID 或账号标识 |
| GitHub 主线 | 当前生产 UI 对应本轮修复后的代码；MCP Edge Function 单独 pin 到上述已验证的 v1.6 后端提交 |

## 3. Tested User Journeys

状态说明：PASS = 已按实际流程通过；PARTIAL = 部分通过或有实际限制；NOT TESTED = 未在生产浏览器中验证。

| 用户旅程 | 状态 | 实际证据与限制 |
|---|---|---|
| 拼写训练 | PARTIAL | 选择考研词书和章节；在错词池中完成连续多词，验证正确、错误、Enter、完成结果和记录入口。按字符逐键训练，Backspace 未能删除已输入字符；刷新可恢复到当前词位置，但未保留该词未提交的临时字符。音频按钮可见，Cloud Browser 无法确认实际扬声器输出。 |
| 专项入口与题池 | PARTIAL | Practice 页面提供拼写、英文→中文回想、英文→中文辨认、中文释义→英文词头四个独立入口；每段 6/12 词，范围含当前章节、练过、拼写错词、词义模糊。空的“词义模糊”池显示“这一组暂时没有可练内容”并提供“练当前章节”返回入口；选择恢复为当前章节。约 490 px 窄视口下入口卡片被裁切，需横向滚动；模式本身可启动。 |
| 词义回想 | PASS | 完成 1 题错词池与 6 题章节练习；使用“显示释义→自评”流程。刷新后可从相同阶段和 cursor 恢复；离开后从 Practice 的“继续上次”恢复。结果呈现为自评分类，不宣称客观正确率。6 题结果为 4“想起”、2“部分”、0“没想起”。 |
| 词义辨认 | PASS | 完成章节 1 的 6 题和最后章节（336）的 5 题；最后章节只有 5 个词时仍为每题生成四个选项。测试了键盘 1–4、正确/错误反馈、下一题及最后一题反馈后再进入结果。两组结果分别为 5/6、5/5；未观察到答案位置或选项格式提前泄露答案。 |
| 看义写词 | PASS | 从独立 Practice 入口启动 6 题。开始页未显示词头；提交前逐题检查可见文本和 DOM，未发现标准词头；提交后才显示本词书参考词头。一次错答有清楚反馈；刷新后恢复到第 2/6 题，没有重复生成已提交题目的事实；最后一题先显示反馈，再进入结果。结果为写对 5、写错 1。 |
| Today / Smart Session | PARTIAL | Today 显示今日任务数量、估时、词书/章节与开始入口；Smart Session 可开始错词复习并继续。生产页实际出现云端任务错误 `permission denied for function wenyan_completion_matches_chapter_task`，页面暴露了内部 RPC 名称；本机学习仍可继续。看义写词没有出现在 Smart Session。 |
| Continue / Resume | PASS | Today 中断后显示继续入口，恢复到相同章节任务与词 cursor；回想练习可恢复题目阶段与 cursor。未把“启动/恢复命令”记作学习完成。 |
| 错词本 | PASS | 页面加载真实错词、释义与近期错题；练习入口和 CSV/XLSX 导出菜单可见。报告不披露个人词表。 |
| Analysis / 学习证据 | PASS | 拼写、语义回想、语义辨认、看义写词分别展示。页面明确区分回想自评与按当前参考释义评分；未发现把拼写事实合并成语义掌握率的总分。 |
| 词书与章节 | PASS | 可选择实际词书并打开章节；章节 336 的 5 词小题池成功用于辨认和 production 边界检查。 |
| Preferences / 学习阶段 | PASS | 查看学习阶段与未开放阶段说明；没有更改长期学习阶段。 |
| 训练设置 / 发音 | PARTIAL | 美音、默写开关及其他快捷设置可见；启用默写后词头视觉隐藏。发音实际声音未能由 Cloud Browser 验证。修复后生产 DOM/无障碍树中的发音按钮名称为“播放当前单词的发音”。 |
| Sync | PARTIAL | 登录后执行真实本地→云端同步，UI 显示上传成功；原有未归属本机记录保持未认领。未在生产浏览器里注入离线网络或模拟 Supabase 写入失败，因此不能据此宣称所有离线/失败路径均通过。 |
| Backup / Restore | PARTIAL | 通过生产设置导出本机备份，选择同一快照导入后收到“备份已恢复”提示并刷新载入。备份恢复面向本机数据；此次导入后回到默认词书/第 1 章，没有恢复登录态或当前学习位置，未验证损坏文件拒绝和云端历史恢复。不要把本机备份当成云端账号迁移。 |
| ChatGPT / MCP | PASS | 真实调用 `get_coaching_context`。返回 `coaching-context-v1.6`；`semanticEvidence`（回想）、`semanticDiscriminationEvidence`、`semanticProductionEvidence` 均可独立识别，拼写仍由 `word_attempted` 学习证据承载。v6 production 事实经本地→sync→Supabase→MCP 可见。 |

## 4. Bugs

| ID / 严重度 | 页面 | 复现步骤 | 预期 | 实际 | 稳定性 / 状态 |
|---|---|---|---|---|---|
| B1 · P2 | Today / 云端任务 | 登录后打开 Today，等待云端任务加载/更新 | 任务状态成功更新；失败时给普通用户可理解的错误，不显示内部函数名；本机学习继续 | 显示 `permission denied for function wenyan_completion_matches_chapter_task`；本机练习仍可用 | 本轮生产环境实际观察到 1 次，未连续重复验证。未修。 |
| B2 · P2 | Practice / 小视口 | 在约 490 CSS px 宽视口打开 Practice | 四种专项模式入口在小屏可发现、可直接操作 | 卡片区横向溢出，部分入口需横向滚动才可见 | 在该视口稳定复现。未修。 |
| B3 · P2 · 已修 | 拼写 / 默写 | 开启默写模式，检查词头隐藏时的无障碍树 | 发音按钮不暴露隐藏词头 | 修复前按钮名称包含目标词，屏幕阅读访问可绕过默写；已改为“播放当前单词的发音” | 修复前在生产页复现；修复后生产页 AX 树确认通用名称。代码提交 `524459593d9f602d2f88b8c8c769cc5da060983d`，针对性回归用例随后提交。 |
| B4 · P3 | 词书释义 / 语义练习 | 做章节回想、辨认或 production，查看对应释义 | 释义语言一致，不夹杂无解释英文片段 | 一条中文释义包含未翻译英文 token；它不是本题参考词头，但会打断理解并可能影响题目质量 | 单条数据稳定观察到。未修，未把它误报为目标词泄漏。 |

没有发现 P0/P1 问题。B1 的云端任务刷新存在问题，但没有阻断本地词汇练习。

## 5. UX Findings

1. 拼写训练按顺序接收字符；输错后 Backspace 不修正当前输入。刷新会保留词 cursor，但会丢弃当前词的临时字符。适合继续作答，但“删除重输”不符合常见输入预期；本轮只记录为体验建议，未更改训练规则。
2. 专项入口在窄视口需要横向滚动，用户初次进入可能看不到全部四种模式。桌面视口入口层级明确。
3. Today 的云端任务错误展示内部 RPC 名称，像开发日志；其余本机专项仍能继续。
4. 自评、选义、写词的结果语义区分清楚；各专项反馈后再进入结果，完成感与数据解释一致。
5. 生产页面短暂出现章节准备状态，随后进入可练习状态；本轮未观察到长时间 loading 或空页面。没有对所有章节列表加载延迟做穷尽检查。
6. 训练设置开关可在主页面找到；音频按钮可见，但实际发声不能通过此 Cloud Browser 验证。

## 6. Data / Evidence Integrity

- 本轮完成操作通过 UI 生成记录；没有直接 INSERT/UPDATE 历史事件，也没有将工作区/命令状态当成学习事实。
- 拼写对应 `word_attempted`；语义回想是带版本的自评；辨认仅代表当前版本参考释义辨认；production 仅代表带版本的释义→当前词书参考词头。
- 章节回想 6 题中的“4/2/0”是学习者自评分类，不是客观准确率。辨认与 production 的客观分数也只代表该次题组，不是 mastery。
- Production 测试自然产生 6 条 sourceVersion 6 事实（5 对、1 错）。刷新后本地 cursor 从第 2 题恢复；在 Supabase 聚合检查中，测试窗口内不同事实 ID 数与事件数一致，owner 一致；未见重复 production event。Sync UI 未认领既有未归属记录。
- MCP live snapshot 返回三个独立语义 channel，未将 spelling 冒充 semantic evidence。MCP 同时标记覆盖为 partial，并返回 `execution_availability_stale`、`multi_source_snapshot_not_atomic`、`snapshot_descriptor_not_server_persisted`、`visible_history_is_not_all_learning` 等限制；因此 Coaching Context 是有界的可见历史快照，不是全部历史的原子视图。
- 未发现总掌握率或“命令完成即学习完成”的误导性表达。

## 7. Remaining Risks

- Today 云端任务更新权限错误尚未修复；错词/专项本机练习可以继续，任务状态更新能力不能按通过处理。
- 生产浏览器没有做离线网络开关和 Supabase 写失败注入；CI 有本地失败恢复回归，但这不等于生产网络故障实测。
- 本机备份恢复未覆盖登录态、云端历史或当前学习位置；损坏备份恢复路径仅有 CI 回归，本轮生产导入只验证有效备份。
- Practice 小视口入口溢出和单条释义质量问题未修复。

## 8. Recommended Next Step

1. 修复 Today 云端任务 RPC 的生产权限，并将错误提示改成面向学习者的文案。
2. 调整 Practice 窄屏入口，让四种专项模式无需猜测横向滚动即可发现。
3. 清理包含未翻译 token 的词库释义，并检查附近释义的语义题质量。
4. 在下一轮专项验收中实测离线/同步失败恢复，并明确本机备份与云端同步、学习位置的边界。

---

### 报告与范围说明

本报告记录的是 2026-10-12 生产页面验收；报告文件本身将作为仅文档变更追加到 main。浏览器登录期间执行的练习会在用户账号中留下真实记录，这些记录没有被回滚。报告没有记录个人邮箱、学习词头或事件 ID。
