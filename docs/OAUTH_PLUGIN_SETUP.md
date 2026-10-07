# ChatGPT Plugin / OAuth acceptance

更新：2026-10-07。

Wenyan English 已完成第一次真实 ChatGPT Plugin / OAuth 2.1 / DCR 接入。本文件保留当前生产配置、已验收事实和后续复核要点，不再把已完成步骤写成待办。

## 生产端点

- Wenyan Pages：`https://qbjsdsb.github.io/wenyan-English/`
- OAuth consent：`/oauth/consent`
- MCP：`https://cmjhxvpkdeheujuteqoi.supabase.co/functions/v1/wenyan-english-mcp`
- Transport：MCP Streamable HTTP
- Auth：Supabase OAuth 2.1 + PKCE + Dynamic Client Registration

## 已完成验收

2026-10-07 已确认：

- GitHub Pages build/deploy success，OAuth 深链接可用于真实授权流程；
- Supabase OAuth 2.1 Server / DCR / Authorization Path 已配置；
- ChatGPT 通过 DCR 动态注册为 public OAuth client；
- 用户完成 Wenyan consent；
- Supabase 产生绑定该 ChatGPT client 的 OAuth session；
- ChatGPT 中 `@wenyan` 已真实调用 `get_learning_overview` 并取得该账号的 Wenyan 数据；
- 因此“插件已创建”“OAuth 已授权”“MCP 已真实可调用”均已成立，而不只是端点部署成功。

不要把数据库中的 user/client/session 标识写进仓库或文档。

## Access-token 校验

Supabase OAuth access token 默认使用标准 `aud = authenticated`。MCP URL 是 protected-resource discovery/challenge 标识，不假定为 JWT audience。

Edge Function 校验：

- Supabase JWKS 非对称签名；
- 正确 issuer；
- `aud` 包含 `authenticated`；
- `role=authenticated`；
- 必须有真实 `sub / session_id / client_id`；
- 禁止 anonymous user；
- 数据层继续使用 `auth.uid()`、RLS、SECURITY INVOKER RPC 和 client capability。

Edge Function `verify_jwt=false` 是因为函数自己执行上述 OAuth resource-server 校验，不代表匿名开放。函数不读取 `service_role`。

验证 token 后，MCP 使用同一 Bearer token 查询 `public.oauth_client_capabilities`，并同时按签名 token 的 `sub` 与 `client_id` 过滤；RLS 再次限制为当前用户自己的 grant。`session_id` 必须存在并通过签名校验，但现有 capability 表以 user/client 为授权键，不伪称逐 session 授权。

OAuth `openid` scope 只证明身份，不代表 Wenyan capability。Dynamic Client Registration 每创建一个新的 client ID，都必须由用户为这个具体 client 显式授予能力；新 client 不继承旧 client 的权限。Edge preflight 和 SECURITY INVOKER RPC 双重检查，capability 查询故障时受限工具失败关闭。没有自动管理员授权或历史事实写权限。

## 当前 MCP 能力

只读：

- `get_learning_overview`
- `get_weak_words`
- `get_word_history`
- `get_plan_status`

计划写入：

- `create_study_plan`
- `revise_study_plan`
- `archive_study_plan`

当前第一批计划写工具只接受网站已经能执行的 `chapter` 任务。Smart Review、弱词、听写和混合 session 类型保留在 Cloud Plan v2 数据模型中，等对应执行器接入后再通过 MCP schema 放开。

## 个人客户端 capability

Wenyan capability grant 绑定到具体 OAuth client，而不是 ChatGPT 名称；当前个人授权集包括以下 capability。新 DCR client 不继承旧 client 的 grant：

- `plans:read`
- `plans:write`
- `navigation:control`
- `session:control`
- `preferences:write`
- `coach:auto_adjust`

注意：capability 不是任意数据库权限。当前 `plans:write` 仍必须通过 Wenyan 的窄写 RPC；OAuth token 不能直接绕过 RLS 写计划表。

`navigation:control / session:control / preferences:write / coach:auto_adjust` 是下一阶段授权基础，对应 MCP/Command Bus 工具尚未全部实现。

## 不变的安全规则

无论个人模式权限多高，都保持：

- ChatGPT 不能插入、修改或删除历史 `learning_events`；
- 不能凭计划状态伪造“已完成”；
- 只有真实匹配的不可变学习事实产生 `completionEventId / completedAt`；
- 不开放任意 SQL；
- 不开放任意 JavaScript/DOM 控制；
- 不把 service-role/secret 放进浏览器或插件；
- revise 使用 revision 乐观锁，已完成任务不可被计划修改重写；
- mutation 使用 requestId + receipt 保证重试幂等。

## 重新验收时的测试提示

1. `@wenyan 看看我最近 7 天英语学得怎么样。`
2. `@wenyan 哪些词最近比较容易出错？`
3. `@wenyan 我现在有什么云端计划？`
4. 在新的 write-tool catalog 可见后，让 Wenyan 创建一个短 chapter 计划，再用 `get_plan_status` 回读确认。
5. 计划同步到网站 Today 后，点击任务实际学习；只有练完整章才应出现 completion evidence。

若插件工具 schema 更新后 ChatGPT 仍只显示旧工具，优先在插件详情页执行 Rescan / reconnect，而不是重新创建 Supabase OAuth client。
