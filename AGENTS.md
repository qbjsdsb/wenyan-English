# Wenyan English 工作约定

- 开始先读 README.md、docs/STATUS.md、docs/IMPLEMENTATION_PLAN.md，再检查远端 main、git status、现有实现。
- 目标：电脑优先、英语优先、个人长期使用。保留 Qwerty 学习引擎；文学后续扩展。
- 尽量复用依赖与现有成果，不重做架构。使用 Yarn Classic 和 yarn.lock。
- 学习事实与建议分开。不能伪造完成记录、掌握率、联网状态或验证结果。
- 本地优先；网络失败不阻塞打字。保护旧 Dexie 数据。导入需运行时校验。
- Supabase 启用RLS并限制所有权；浏览器只能有publishable key。禁止提交secret、token、用户学习历史。
- MCP 先真实验证只读，再开放有约束的计划写入；用户当前已要求最终支持写计划，不是永远只读。
- 任务关联和完成必须可追溯。测试要覆盖误算、重复、失败与刷新，而不是只有截图。
- 文档和代码按小批次提交并推送。不要让长会话以未保存代码结束。
- 每次收尾更新 docs/STATUS.md：实际成果、验证、未完成、下一步和阻塞。提交SHA可由git log核对，不填写虚假成功。
- 不自动公开发布网站、不引入付费资源。保留 GPL-3.0 与上游归属。
