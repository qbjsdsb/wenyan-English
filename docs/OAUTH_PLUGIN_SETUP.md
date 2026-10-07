# ChatGPT Plugin / OAuth acceptance checklist

更新：2026-10-07。

本文件只记录 Wenyan English 第一次真实 ChatGPT Plugin 连接所需的人工配置与验收。代码侧 OAuth consent 页面、MCP protected-resource metadata 和只读工具由仓库管理。

## 代码侧已准备

- MCP URL：`https://cmjhxvpkdeheujuteqoi.supabase.co/functions/v1/wenyan-english-mcp`
- MCP transport：Streamable HTTP
- 认证：Supabase Auth OAuth 2.1
- Protected Resource Metadata：MCP URL + `/.well-known/oauth-protected-resource`
- Consent route：`/oauth/consent`
- 当前工具全部只读：
  - `get_learning_overview`
  - `get_weak_words`
  - `get_word_history`
- Edge Function 自己验证 issuer / JWKS / Supabase `authenticated` audience / session / client claims；不读取 service-role key。

### Access-token audience 说明

Supabase OAuth access token 默认仍使用标准 `aud = authenticated`。MCP URL 是 OAuth protected resource 的发现/挑战标识，但 Supabase 不会因为客户端传入 resource 就自动把 JWT `aud` 改成 MCP URL。

因此第一版只读 MCP 校验：

- 签名来自 Supabase JWKS；
- `iss` 必须是当前项目 Auth issuer；
- `aud` 必须包含 `authenticated`；
- `role=authenticated`；
- 必须带真实 `sub / session_id / client_id`；
- 禁止匿名用户；
- 数据层继续由 `auth.uid()` + RLS / 窄 RPC 限定。

如果以后写计划阶段需要资源专用 audience，可再用 Supabase Custom Access Token Hook 对已批准的 ChatGPT client 定向改写 `aud`，而不是在只读阶段假定默认 token 已经具有该 audience。写能力开放前仍必须增加明确的 ChatGPT `client_id` allow policy。

## Supabase Dashboard 一次性配置

在项目 `cmjhxvpkdeheujuteqoi`：

1. **Authentication → URL Configuration**
   - Site URL 设置为 Wenyan 的正式 HTTPS 站点 origin。
   - Magic Link 允许的 Redirect URL 覆盖正式站点的 `/oauth/consent`，确保未登录授权时可以回到原授权页。
2. **Authentication → OAuth Server**
   - Enable OAuth 2.1 server。
   - Authorization Path：`/oauth/consent`。
   - Enable dynamic client registration（第一次接 ChatGPT 使用 DCR）。
3. **JWT Signing Keys**
   - 使用 ES256 或 RS256 非对称签名键；MCP/OIDC 不应依赖旧 HS256 secret。
4. 保存后确认 OAuth discovery endpoint 可以公开读取：
   - `https://cmjhxvpkdeheujuteqoi.supabase.co/.well-known/oauth-authorization-server/auth/v1`
5. 第一次连接前确认 Wenyan 正式站点可直接打开 `/oauth/consent` 深链接，而不是只在站内导航后可达。

## ChatGPT Web 第一次连接

当前 OpenAI Plugin 流程需要用户本人完成连接动作：

1. 在 ChatGPT Web 打开 Plugins。
2. `+` → `Create custom MCP server`。
3. 名称可填 `Wenyan English`。
4. Server URL 填上面的 `wenyan-english-mcp` URL。
5. Authentication 选择 OAuth；让 ChatGPT 使用 OAuth discovery / dynamic client registration。
6. 阅读风险提示并创建为个人 Plugin。
7. 安装该 Plugin。
8. 浏览器应跳转至 Wenyan `/oauth/consent?authorization_id=...`。
9. 页面必须显示请求客户端、OAuth scope 和“当前只读”的权限说明。
10. 用户点击“允许只读访问”后应返回 ChatGPT。

## 首次真实验收

连接成功后在 ChatGPT Work 中验证：

1. “看看我最近 7 天 Wenyan 英语学得怎么样。”
   - 应调用 `get_learning_overview`。
   - 数据不足时必须明确说数据不足。
2. “哪些词最近比较容易出错？”
   - 应调用 `get_weak_words`。
3. “为什么你认为 `<word>` 值得复习？把证据给我。”
   - 应继续调用 `get_word_history`，而不是凭印象解释。
4. 确认 Plugin 工具列表里没有任何写工具、任意 SQL 或删除历史能力。
5. Supabase `auth.oauth_clients / auth.oauth_consents / auth.oauth_authorizations` 应出现本次真实连接记录。
6. 撤销授权后，旧 token 不应继续取得 Wenyan 学习数据。

## 暂不开放写计划

完成以上验收前，不实现或暴露：

- `create_study_plan`
- `revise_study_plan`
- `archive_study_plan`

真正开放写计划前还需要：

- Cloud Plan v2 schema + revision + idempotency；
- plan/task 与真实 session/fact 关联；
- 明确 ChatGPT OAuth client allow policy；
- 对旧 `wenyan_private` SECURITY DEFINER RPC 完成独立审计；
- 写工具准确标注 read/write/destructive/idempotent annotations；
- 用户确认后才能写入未来计划，永远不能写历史“已完成”。
