# Wenyan English 验收问题收口记录 — 2026-10-12

## 状态

本文件记录 2026-10-12 生产验收后已明确修复的收口项。结论以合并后的 CI、Pages 与 MCP 生产部署为最终准绳。

### 已处理

- Today / Cloud Plan `wenyan_completion_matches_chapter_task` helper 权限回归：恢复 `authenticated` 对纯计算 helper 的 EXECUTE，`anon` 仍无权限。
- Cloud Plan 读取授权边界：OAuth 外部读取 `get_plan_status` 必须持有 owner/client 匹配的 `plans:read`；第一方浏览器仍走 owner-bound wrapper + RLS。
- 计划写入兼容性：`plans:write` RPC 在完成自身 OAuth 与 capability 校验后，通过既有事务级 `wenyan.plan_write_rpc = 1` 标记调用内部 `get_plan_status` 构造响应，不额外要求 `plans:read`。外部读取边界不放宽。
- Today 错误文案：不再直接向普通用户暴露 Supabase/Postgres RPC 内部错误文本。
- Practice 窄窗口：约 490px 宽度下四个专项模式改为 2×2，可直接发现，无需横向滚动；桌面布局保持四列。
- 对应 MCP capability 与 Playwright 回归已加入 CI。

### 有意未改

- 验收报告提到的一条“中文释义含未翻译英文 token”没有记录具体词条。为了避免猜测并误改词典内容，本轮不做无证据修正，留给后续有明确样本的词典数据质量检查。
- Coaching Context `executionAvailability` 的 stale/unknown 是独立运行时刷新议题，不与本轮 Cloud Plan 权限修复混在一起。
- Smart Session、学习阶段和 Learning Fact 语义均未改变；看义写词仍是手动专项训练，不加入 Smart Session。

## 数据边界

本轮数据库迁移只调整函数授权和调用边界，没有插入、修改或删除历史学习事实，也没有伪造个人学习记录。
