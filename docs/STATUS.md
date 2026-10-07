# 当前状态 / 续接入口

更新：2026-10-07。

## 已确认

- 当前正式主线已合并 P0 和 P1 第二批同步恢复：main merge `bcf20a7`。
- 已有 Qwerty 学习引擎、Dexie 学习事件、Today 学习工作台与 Supabase 双端学习事实同步。
- 本地学习计划支持受校验 JSON 导入、IndexedDB 持久化、指定词书/章节启动、真实章节完成证据与计划导出。
- 上传端具备本机账号归属保护、未归属历史显式认领、跨账号待上传隔离和指数退避。
- 云端恢复已进入 main：`pull_learning_events` 使用 `(created_at, id)` 游标；客户端按账号保存独立 pull cursor，并在同一 Dexie 事务写入恢复事实与推进游标。
- 重复恢复 UUID 幂等；跨账号 UUID 冲突、未知来源/版本会中止页面且不推进游标。
- P1 restore 的 lint / type / build / Playwright CI 已通过。
- `public.get_learning_overview`、`public.get_weak_words`、`public.pull_learning_events` 均为 `SECURITY INVOKER`，且仅向 `authenticated` 授权执行。
- `feature/intelligence-foundation` 已把英语专用只读 MCP 源码写入本仓库，并部署独立 Supabase Edge Function `wenyan-english-mcp` v1；旧 `wenyan-mcp` 未修改。
- 详细产品与实施路线以 `docs/IMPLEMENTATION_PLAN.md` 与 `docs/INTELLIGENCE_FOUNDATION.md` 为准。

## 当前阶段：Wenyan Intelligence Foundation

当前批次目标：

1. 以 `wenyan-English` 为英语 Plugin/MCP 唯一源码真相，停止线上 Edge Function 与 GitHub 源码漂移。
2. 先完成只读 ChatGPT 数据链路，不开放写学习历史或写计划。
3. 首批只读工具：`get_learning_overview`、`get_weak_words`。
4. 所有工具返回数据覆盖范围与解释口径，避免把拼写表现、键间耗时误称为词义掌握或回忆速度。
5. 下一步完成真实 ChatGPT Plugin 安装/OAuth 握手验收，再增加词级历史和 session 查询。

随后继续：

- 学习事实 v2：正式 session / task 关联、practiceMode、`firstKeyLatencyMs`、hint、`word_skipped`、暂停/中断等；
- `get_word_history`、`get_recent_sessions`、`get_review_pressure`；
- 可恢复的 mutable user state（当前词书/章节/必要设置）；
- 云端 `study_plans / plan_tasks / revisions`；
- 只读 Plugin 稳定后才开放 `create_study_plan / revise_study_plan / archive_study_plan`；
- Today 页面直接消费云端计划并一键启动对应学习模式。

## 当前明确边界

- `wenyan-english-mcp` 已部署，但尚未完成真实 ChatGPT Plugin 安装和 OAuth 握手；不能描述为“ChatGPT 已连接”。
- 当前首批 MCP 工具只读同步到云端的 `learning_events`；其他设备尚未上传的历史未知。
- 本地学习计划目前仍只保存在本机，尚未进入 Supabase 云计划表。
- 当前事件 v1 只有 `word_attempted / chapter_completed`，不能可靠区分拼写、词义回忆、听写等能力，也没有真正首键回忆延迟。
- 当前云端恢复只覆盖 Wenyan 不可变学习事实，不会伪造或重建旧 Qwerty `wordRecords/chapterRecords/reviewRecords`。
- 当前词书、章节和必要设置的跨设备恢复尚未实现，因此还不能宣称“新电脑完全接着旧电脑状态”。
- Supabase 中更早的 `wenyan_private` / `wenyan-mcp` 仍存在；其中若干 `SECURITY DEFINER` RPC 已被 Advisor 标记需要审计。英语写插件不得直接复用，除非权限边界逐个验收。
- GitHub Pages 旧部署 workflow 仍需在正式发布前单独清理与重新配置；不要把当前仓库状态描述为已公开部署。

## 续接

1. 检查远端 `main`、开放 PR 与 active Supabase Edge Function，以最新真实状态为准。
2. 阅读 `AGENTS.md`、`docs/IMPLEMENTATION_PLAN.md`、`docs/INTELLIGENCE_FOUNDATION.md`、本文件与 `docs/MCP_TOOLS.md`。
3. 先完成 `feature/intelligence-foundation` 的 CI 与真实 Plugin/OAuth 验收，再进入 facts v2；不要重新设计 Qwerty 学习引擎。
