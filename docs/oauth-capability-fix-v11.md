# OAuth capability fix v11

更新时间：2026-10-08

## 问题

ChatGPT 通过 OAuth 重新连接后，MCP endpoint 和 get_coaching_context 可用，但 get_learning_intents 返回通用 403；Coaching Context 将 Intent 标成 not_authorized。

## 根因

Supabase OAuth access token 已包含并由 Edge Function 验证身份字段：issuer、audience、expiry、sub、session_id、client_id，以及 authenticated role / 非匿名状态。能力没有编码在 OAuth openid scope 中，而是保存在 public.oauth_client_capabilities。

新 DCR 注册会生成新的 client_id。Capability 表按当前用户和 OAuth client 区分授权；旧 ChatGPT client 有原授权，新批准的 client 没有 capability 行。get_learning_intents 的 RPC 要求 plans:read 或 coach:auto_adjust，因此正确行为是拒绝该新 client。

另一个问题是 Edge Function 在读取 401/403 响应体之前就返回通用 NOT_AUTHORIZED，忽略了 Postgres RPC 的已知错误码，导致错误原因被隐藏。

## 修改

- OAuth token 验证后，Edge Function 使用同一 Bearer token 和 publishable key，按 token 的 sub + client_id 查询当前 client 的 capability；查询受 oauth_client_capabilities 的 RLS 保护。
- MCP tool 调用前按现有 capability 名称做预检查；RPC/RLS 中的 owner、client 和 capability 检查仍保留，Edge preflight 不构成绕过。
- capability 查询失败时，Learning Intent、计划写入和设备控制操作失败关闭；Coaching Context 仍可读取用户自己的学习事实，并把 Intent 标成 unavailable；明确无 grant 时才标成 not_authorized。
- 先解析已知 RPC 错误码，再对未知 401/403 返回通用错误。
- verify_jwt=false 保持不变：该 Edge Function 自己验证 Supabase OAuth JWT。未改历史学习事实的写权限，也未自动授权其他 client 或用户。
- 新增 capability identity / fail-closed 场景测试，并将其加入 Wenyan CI。

Capability 对应关系及当前 OAuth client 的生产 grant、v11 部署和端到端验证结果将在部署完成后补记。

## 验证状态

本地可运行的 capability 映射 / sub + client_id 查询测试与 Coaching adapter 场景已通过。GitHub CI、生产 v11 部署及当前已认证 Wenyan MCP smoke test 待完成。
