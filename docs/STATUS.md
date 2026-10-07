# 当前状态 / 续接入口

更新：2026-10-08（Asia/Shanghai）。开始续接仍须核对远端 main、开放 PR、CI，不能把本页 SHA 当永久最新状态。

## 已核实基线

本次读取的 main：`7591bb33092d7c57008ceaa3735c4ff6af4f0f16`；最近合并 #22 Reading Loop、#21 Today 主入口、#20 Intent 消费、#19 MCP Intent tools、#18 Intent 存储。
PR #23 `feature/learning-stage-policy` 为无冲突 Draft，原来只有 EXAM_PREP_STRATEGY。本次沿用该 PR，不改 main、不发布网站。
#22 最后 head `8a747681` 的 Wenyan CI run 80 success；main 查询接口只列 PR 触发 runs，返回空不能证明 main 无 CI。

已存在：本地不可变 word/chapter/source-v3 question/reading facts、同步/恢复与所有权隔离；Smart Session 纯 planner、Today 主入口与可恢复 vocabulary block；MCP 0.6.0 Learning Intent read/revise/clear；ongoing/day/session intent → vocabulary planner；Reading Runner、草稿及真实提交事实。

## 本次实际成果：AI Coaching Loop v1

- 正式合同：[AI_COACHING_LOOP_V1.md](AI_COACHING_LOOP_V1.md)。12 项 decision records、Fact/Derived/Interpretation、summary-first/drill-down、MCP schema、stage 确认、拒绝提醒抑制、离线规则、未来 Reading/题型/FSRS 分层、迁移与 invariants。
- `src/coaching/types.ts`、`context.ts`：纯 context builder、可信候选预筛、fresh selection guard、提醒 reconsideration 判断。无 React/网络/数据库/隐式时钟。
- 真实口径：7/14 个用户时区日历日、首次可见暴露、原始 reviewMode 与重复暴露分开、近期拼写出错词数量；未测 due/interruptions 返回 null。
- 重复 fact UUID 去重，冲突拒绝；未来时间隔离；稳定排序；小型 evidence sample + 聚合 query refs。现有事件/阅读/SessionConstraints 类型复用。
- 阅读必须 metadata 与结构有效、答案核验、版本匹配、repeat policy 明确；assessment 可见不代表可执行；预算/阶段/执行器/历史未知仍锁住自动执行。
- 合成场景脚本 `scripts/check-coaching.mjs` 接入已有 CI，不引入测试框架；公开仓库不含真实学习数据或受限材料。
- 旧文档加正式合同入口，修正阅读推荐归属，替换已经严重落后的本进度文件。

**纯核心不是线上接线。** 未修改/部署 Supabase/MCP；没有新的正式工具、stage 持久化或用户确认 UI；没有把 reading 放入 Smart Session 自动执行集合。不得把类型接口当鉴权保证。

## 验证与限制

- 新 Coaching 合成场景 16 组通过；原 Smart Session 16 组通过。
- 新 coaching core 独立 strict TypeScript 检查通过（仓库 lockfile 对应 TS 4.9.5）。
- 全量 lint/typecheck/build 已尝试，但依赖安装在 fetching 阶段未完成：eslint/cross-env 与项目 type dependencies 不可用。不能声称本地全量检查通过。保留 yarn.lock，不升级依赖、不改框架规避。
- GitHub CI 新增 coaching gate；本次提交最终 CI 状态以 PR checks 为准，不引用旧提交绿灯作为新提交证据。
- 未做浏览器 E2E、真实 OAuth mutation smoke、私有 provider/内容验收。本次没有 UI/runtime 行为修改。

## 已识别的现有缺口（不要误称实现）

1. Intent 网络失败目前直接用 defaults，没有持久 owner-scoped last-valid envelope cache。
2. session intent 当前主要靠时效，未正式绑定 runtime sessionId；day 的48小时是 RPC 上限，不等于“今天”。
3. 当前合并是 scope 字段覆盖，旧文档“所有 ceiling 取更紧”尚非现有完整实现。
4. Planner 的预算 admission 不等于 runner 已有精确 hard-stop enforcement；active timing 仍有估计语义。
5. 原 adapter 尚需更严格的一致快照/未来时间/分页审计，不能直接作为全局 CoachingContext 的完整数据层。
6. Core input 是可信 adapter contract；未实现云端 snapshot manifest/replay、输出字节预算服务校验或读取 RPC，不能用类型断言接受 AI 伪造 evidence。
7. Context v1 activeDays 只观察 word_attempted，不涵盖 reading 活跃日；reviewPressure 未实现 scheduler 汇总；红宝书 observedProgress=null。
8. Reading guard 是未接线纯函数；安全关键的 fresh catalog 重读、version pinning、owner/license、实际加载及当前预算必须由未来 runtime adapter 完成。

## 下一步（按小批次直接执行）

1. 读本次正式合同与测试。先接 owner-safe context adapter：现有恢复 parser/事件为来源，完整分页、received watermark、manifest、缺失口径与 bounded response；不要造 readiness score。
2. 再接 `get_coaching_context`。只有这步需要 Supabase 时才先读最新 skill/changelog，migration + RLS + SECURITY INVOKER；复用现有认证，不做 OAuth 重建。
3. 独立 stage preference / confirmation provenance / reminder suppression。generic revise_learning_intent 继续禁止改 stage；没有可信用户确认 receipt 就只保存 pending proposal，经第一方用户确认。
4. 补 intent cache、日界和 session binding、hard-stop 执行，保持断网 defaults 可学。
5. 私人 provider + eligible reading candidates + versioned recommendedContent，再接 runtime fresh guard；确认 mixed 前自动执行仍只 vocabulary。
6. 内容验收后才考虑新题型；FSRS 延后到有可靠 semantic/contextual evidence。

恢复命令：

```bash
git fetch origin
git checkout feature/learning-stage-policy
yarn install --frozen-lockfile
node --experimental-strip-types scripts/check-coaching.mjs
node --experimental-strip-types scripts/check-smart-session.mjs
yarn lint
yarn tsc --noEmit
yarn build
```

GitHub 是成果持久化来源。此次正常 git push 缺 HTTPS 凭据，使用已授权 GitHub connector 创建 tree/commit 并推进同一分支；没有绕过权限，也没有 force push。以 PR #23 的实际 head 与 git log 核对提交。

> AI controls future intent, never past truth. Only the user confirms long-term stage. ChatGPT reasons; deterministic code guards. Wenyan works without AI.
