# 当前状态 / 续接入口

更新：2026-10-07。

## 已确认

- 当前正式主线已合并 P0：main `49cc836`（Wenyan Today + 可执行本地学习计划）。
- 已有 Qwerty 学习引擎、Dexie 学习事件、Supabase 上传队列，以及 Today 学习工作台。
- 本地学习计划支持受校验 JSON 导入、IndexedDB 持久化、指定词书/章节启动、真实章节完成证据与计划导出。
- P0 已通过 Yarn 安装、lint、TypeScript type check、生产构建和 Playwright 浏览器流程；关键用例覆盖虚假完成、错误章节、跳词、刷新持久化和深色模式。
- 详细产品与实施路线以 `docs/IMPLEMENTATION_PLAN.md` 为准。

## 当前阶段：P1 事实与同步加固

优先处理：

1. 为学习事件补正式 session / task 关联与首键反应时间等事实，不把现有键间耗时误称为反应速度。
2. 加固上传队列：未捕获异常、合理重试、较大待上传队列追赶。
3. 处理账号切换隔离：已绑定账户的数据不能上传到另一账户；匿名历史需要显式认领。
4. 实现并验证跨设备下拉恢复，避免只上传不恢复。
5. 在真实双浏览器/双设备场景验证幂等、不丢失、不串号。

## 尚未完成

- MCP 服务、ChatGPT 真实连接和计划云端写入尚未实现。
- 本地计划目前只保存在本机，尚未进入 Supabase `study_plans / plan_tasks`。
- session、`firstKeyLatencyMs`、`word_skipped`、暂停/中断事实尚未落地。
- 账号切换隔离和跨设备下载恢复尚未完成正式验收。
- GitHub Pages 旧部署 workflow 仍需在正式发布前单独清理与重新配置；不要把当前仓库状态描述为已公开部署。

## 续接

1. 先检查远端 `main` 与开放 PR，以最新代码为准。
2. 阅读 `AGENTS.md`、`docs/IMPLEMENTATION_PLAN.md`、本文件，以及对应阶段的同步/数据文档。
3. 从 P1 小批次推进并及时提交；先验证再进入 P2，不重建 Qwerty 学习引擎。
