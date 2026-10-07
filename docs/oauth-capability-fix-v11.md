# OAuth capability fix v11

更新时间：2026-10-08

## 问题与根因

ChatGPT 通过 OAuth 重新连接后，MCP endpoint 和 `get_coaching_context` 可用，但 `get_learning_intents` 返回未授权，Coaching Context 中的 `adapter.intentReadStatus` 为 `not_authorized`。

当前 OAuth token 的身份校验包含 issuer、audience、expiry、sub、session_id、client_id、authenticated role 和非匿名状态。Wenyan capability 不在 OAuth `openid` scope 中，而是保存在 `public.oauth_client_capabilities`，按 `user_id + client_id` 授权。

新 DCR 注册产生新的 ChatGPT `client_id`。生产核验确认这个已批准 client 没有 capability 行；旧 ChatGPT client 的授权不会自动继承。RPC 对 `get_learning_intents` 的 `plans:read` / `coach:auto_adjust` 检查正常，因此它拒绝了新 client。另一个问题是 Edge Function 先将 401/403 转成通用错误，没有优先解析已知 RPC 错误码。

## 修改内容

- token 验证后，Edge Function 从当前 token 的 `sub` 和 `client_id` 加载 capability；查询使用同一个 Bearer token 和 publishable key，受表的 owner RLS 约束，并禁用缓存。
- MCP 工具执行前做 capability 预检查；RPC/RLS 的 owner、client 和 capability 校验继续作为最终权限边界。
- capability 查询失败时，Intent、计划写入和设备控制失败关闭。Coaching Context 仍可读取 owner-scoped 学习事实，并将 Intent 状态区分为 `not_authorized` 或 `unavailable`。
- 先解析已知 RPC 错误码，再处理未知 401/403。
- `verify_jwt=false` 保持不变；Edge Function 仍自行验证 Supabase OAuth JWT。

### 工具能力映射

| MCP 操作 | Wenyan capability |
| --- | --- |
| `get_learning_intents` | `plans:read` 或 `coach:auto_adjust` |
| `revise_learning_intent`、`clear_learning_intent` | `coach:auto_adjust` |
| Study Plan 创建、修改、归档 | `plans:write` |
| `get_active_devices` | `navigation:control` 或 `session:control` |
| `open_today` 路由控制 | `navigation:control` |
| `start_task` 会话控制 | `session:control` |

已为本次确认的单个 ChatGPT 用户/client 补上上述流程所需的五项 capability：`plans:read`、`plans:write`、`coach:auto_adjust`、`navigation:control`、`session:control`。未授权其他用户或 client，也未授予此 MCP 闭环不需要的 `preferences:write`。Capability 表当前以用户和 OAuth client 为授权边界；token 中的 `session_id` 仍会验证，但不会被误称为独立的 session grant。

## 部署与验证

生产 Supabase 项目 `cmjhxvpkdeheujuteqoi` 的 `wenyan-english-mcp` 已部署为 **v11 ACTIVE**，`verify_jwt=false`。

验证结果：

- GitHub Actions Wenyan CI run #98（代码提交 `75a71bad476cb47eb27d2ba392cf9e726051dd71`）成功，覆盖 lint、typecheck、Smart Session / Coaching / adapter / OAuth capability 场景、build 与 Chromium browser flows。
- Pages workflow 路径过滤提交 `3a3e77982d259f68971aa81d3425eaa32c7f47c4` 的 CI run #99 成功。
- 使用当前已认证 OAuth 会话，`get_learning_intents` 成功；`get_coaching_context` 成功且 `adapter.intentReadStatus=available`。
- 写入并重新读取了一个当日 Learning Intent：revision 1，`targetMinutes=30`、`hardStopMinutes=30`，按 Asia/Shanghai 时区当日到期。
- 创建并重新读取了一个 active Cloud Plan：1 个章节任务、30 分钟、due date 为 2026-10-08。任务使用 Wenyan 设备最后记录的词书与章节位置；设备在验收时处于 offline，因此该位置是 last-known checkpoint。计划尚未执行，也不代表完成学习或生成学习事实。

之前的 GitHub Pages workflow 会对所有 `main` push 触发。此次 Pages run #20 已成功，但本批没有前端文件变更，构建内容与原前端一致。现已将 `.github/**`、`docs/**`、`scripts/**`、`supabase/**` 和根目录 Markdown 加入 `paths-ignore`，文档 / 后端改动不会再自动重发网站；手动 `workflow_dispatch` 仍保留。

本次没有数据库 migration、service-role 使用、历史学习事实写入，也没有自动授予未来 DCR client。
