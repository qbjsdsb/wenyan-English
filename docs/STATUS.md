# 当前状态 / 续接入口

更新：2026-10-07。

## 已确认

- 当前正式主线 `73ecf3f` 已合并 P0（Wenyan Today + 可执行本地学习计划）和 P1 第一批同步加固。
- 已有 Qwerty 学习引擎、Dexie 学习事件、Today 学习工作台与 Supabase 双端同步基础。
- 本地学习计划支持受校验 JSON 导入、IndexedDB 持久化、指定词书/章节启动、真实章节完成证据与计划导出。
- 上传端已具备本机账号归属保护、未归属历史显式认领、跨账号待上传隔离和指数退避；对应 lint/type/build/Playwright 已通过。
- P1 第二批正在实现云端学习事实恢复：远端已增加 `pull_learning_events`（SECURITY INVOKER）和 `(user_id, created_at, id)` 游标索引；客户端按用户保存独立恢复游标。
- Supabase Advisor 没有为本批新增对象报告新的安全问题；现存 Advisor 项仍来自更早的 `wenyan_private` / 旧 RPC 与 Auth 配置，不在本批擅自修改。
- 详细产品与实施路线以 `docs/IMPLEMENTATION_PLAN.md` 为准。

## 当前阶段：P1 事实与同步加固

当前批次目标：

1. 用服务端 `(created_at, id)` 游标分页恢复当前账号的不可变 `learning_events`。
2. 本地 Dexie 同事务写入事实和推进每账号 pull cursor；失败、未知版本或跨账号 UUID 冲突时不推进游标。
3. 重复恢复同一 UUID 不产生重复事实；已上传但本地未确认的同账号事件可被云端事实重新确认成 `synced`。
4. 后台同步和“同步并恢复”手动入口都执行 upload + pull。
5. 浏览器测试覆盖重复恢复、游标原子性、跨账号冲突和未知版本保护。

随后继续：

- 正式 session / task 关联、`firstKeyLatencyMs`、`word_skipped`、暂停/中断等事实；
- 可恢复的 mutable user state（当前词书/章节/必要设置），实现“换设备继续上次位置”；
- 真实双浏览器/双设备端到端验证。

## 尚未完成

- MCP 服务、ChatGPT 真实连接和计划云端写入尚未实现。
- 本地学习计划目前只保存在本机，尚未进入 Supabase `study_plans / plan_tasks`。
- session、`firstKeyLatencyMs`、`word_skipped`、暂停/中断事实尚未落地。
- 当前云端恢复只覆盖 Wenyan 不可变学习事实，不会伪造或重建旧 Qwerty `wordRecords/chapterRecords/reviewRecords`。
- 当前词书、章节和必要设置的跨设备恢复尚未实现，因此还不能宣称“新电脑完全接着旧电脑状态”。
- GitHub Pages 旧部署 workflow 仍需在正式发布前单独清理与重新配置；不要把当前仓库状态描述为已公开部署。

## 续接

1. 先检查远端 `main` 与开放 PR，以最新代码为准。
2. 阅读 `AGENTS.md`、`docs/IMPLEMENTATION_PLAN.md`、本文件，以及对应阶段的同步/数据文档。
3. 先完成并验收当前 event restore 批次，再继续 mutable state 与事实 v2；不重建 Qwerty 学习引擎。
