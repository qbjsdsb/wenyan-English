# Wenyan English

Wenyan English 是一个只面向个人长期使用的考研英语学习工具。当前以 Qwerty Learner 的成熟打字背词体验为交互基线，在不破坏本地学习手感的前提下，逐步加入本地优先的数据层、Supabase 云同步，以及面向 ChatGPT / MCP 的可解释学习分析能力。

## 当前路线

1. 保留 Qwerty Learner 已验证的背词、听写、错词和统计体验。
2. IndexedDB / Dexie 继续作为学习时的第一写入点，断网也能正常使用。
3. 新增不可变的 Learning Events，记录真实学习事实，而不是只同步 UI 状态。
4. Supabase 负责跨设备同步、长期历史、RLS 与分析 RPC。
5. ChatGPT / MCP 第一阶段只读学习数据，后续再逐步开放创建复习计划等有限写操作。

## 上游基线

本仓库以 `RealKai42/qwerty-learner` 的提交 `1182426f2bd0a28c95302c33f9e19136b1262a70`（2026-09-08）为初始代码基线。基线导入时根 Git tree 与上游保持一致。详细策略见 [UPSTREAM.md](./UPSTREAM.md)。

## 开发原则

- Local-first：网络、Supabase 或 ChatGPT 不可用时，背词本身仍应可用。
- Facts first：原始学习事件追加写入，分析状态可以重算，历史事实不由 AI 随意修改。
- Privacy first：Wenyan 版本不启用原项目的 Mixpanel / Vercel Analytics 行为埋点。
- Read-only AI first：MCP 先提供查询与解释，再评估写操作。
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
