# Wenyan English

Wenyan English 是一个只面向个人长期使用的考研英语学习工具。当前以 Qwerty Learner 的成熟打字背词体验为交互基线，在不破坏本地学习手感的前提下，逐步加入本地优先的数据层、Supabase 云同步，以及面向 ChatGPT / MCP 的可解释学习分析能力。

## 开发计划与续接

- [AI Coaching Loop v1：正式策略与证据合同](docs/AI_COACHING_LOOP_V1.md)
- [详细产品与实施计划](docs/IMPLEMENTATION_PLAN.md)
- [ChatGPT / MCP 智能闭环](docs/INTELLIGENCE_FOUNDATION.md)
- [当前进度与下一步](docs/STATUS.md)
- [OAuth capability 修复 v11](docs/oauth-capability-fix-v11.md)
- [AI 工作约定](AGENTS.md)

## 当前路线

1. 保留 Qwerty Learner 已验证的背词、听写、错词和统计体验。
2. IndexedDB / Dexie 继续作为学习时的第一写入点，断网也能正常使用。
3. 新增不可变的 Learning Events，记录真实学习事实，而不是只同步 UI 状态。
4. Supabase 负责跨设备同步、长期历史、RLS 与分析 RPC。
5. ChatGPT / MCP 可读取 owner-scoped 学习证据，并按当前 OAuth client 的显式 capability 创建未来 Learning Intent / Cloud Plan 或排队有限网页命令；历史学习事实不可写。

## 上游基线

本仓库以 `RealKai42/qwerty-learner` 的提交 `1182426f2bd0a28c95302c33f9e19136b1262a70`（2026-09-08）为初始代码基线。基线导入时根 Git tree 与上游保持一致。详细策略见 [UPSTREAM.md](./UPSTREAM.md)。

## 开发原则

- Local-first：网络、Supabase 或 ChatGPT 不可用时，背词本身仍应可用。
- Facts first：原始学习事件追加写入，分析状态可以重算，历史事实不由 AI 随意修改。
- Privacy first：Wenyan 版本不启用原项目的 Mixpanel / Vercel Analytics 行为埋点。
- Capability-gated AI：MCP 先提供 owner-scoped 查询，再按 OAuth client 显式 grant 开放未来意图、计划和受限导航写入；历史事实始终不可写。
- Small and maintainable：不为了“架构漂亮”拆成复杂 monorepo。

## 本地开发

项目继续沿用上游的 Yarn 1 lockfile：

```bash
yarn install --frozen-lockfile
yarn dev
yarn lint
yarn build
```

## 环境变量

复制 `.env.example` 后再填入自己的 Supabase URL 和 publishable key。不要把 secret/service-role key 放进浏览器端环境变量。

## License

本项目继承上游 Qwerty Learner 的 GPL-3.0 许可证，原 `LICENSE` 保留。
