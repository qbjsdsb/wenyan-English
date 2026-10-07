# 当前状态 / 续接入口

更新：2026-10-07，Smart Session设计批次。以实际main/开放PR为准。

## 已核实主线

本批恢复时远端main为b982d2d（Add device-aware Wenyan command bus），PR #10–15已合并：
- Qwerty输入核心、Dexie记录、immutable learningEvents，本地优先上传/恢复与账号隔离。
- Facts v2保留raw dictation条件和经校验的taskRun/plan/task关联；还没有正式session/pause/可靠active timing。
- 英语MCP v0.5.0源码、OAuth入口、只读证据工具、个人Cloud Plan写入。
- Cloud Plan v2 revision/幂等/完成证据规则；Today缓存并执行真实chapter任务。
- Command Bus、device heartbeat/private realtime、open_today/open_dictionary/open_chapter/start_task和执行回执。
- GitHub Pages工作流已改为本仓库main。最新PR记录了线上应用情况；本批未重新连接插件、部署或做生产验收。

旧STATUS中的“仅只读、计划只在本机、无facts v2”等说法已经过时。ARCHITECTURE/IMPLEMENTATION_PLAN/INTELLIGENCE_FOUNDATION部分阶段描述同样是历史路线，不能拿来否定当前源码。

## 本批：astra/smart-session-v1（独立分支，未合入main）

优先阅读：
1. docs/SMART_SESSION_V1.md
2. docs/AI_COACH_CONTRACT.md
3. src/smart-session/types.ts、planner.ts
4. scripts/check-smart-session.mjs

成果：
- 明确定义Plan是中期intent，Session在最新证据下生成，默认open-ended。
- 每次只承诺下一block；预算可选，hard stop与活动时间分开；无学习债、当日新词上限、去重/cooldown/稀疏回退。
- AI负责方向，planner负责具体选择，网站执行产生不可伪造事实；阅读推荐/反向诊断/能力维度/FSRS/Facts v3升级路径有正式契约。
- 纯TypeScript core无React/Dexie/Supabase/ChatGPT依赖；词汇选择已实现，reading只支持可信候选的能力/预算门控，不含阅读推荐算法或执行器。
- 无新测试框架；16组deterministic fixtures，并接到现有CI。

## 验证与限制

- 已通过：Node直接运行16组场景（纯度/重复输入、10/25分钟、hard stop、0预算、墙钟与活动时间、错误证据、跨来源去重、冲突事实拒绝、重复保护、日上限、重返、backlog、阅读整项门控、休息、旧错误、无效输入）。
- 已通过：用Yarn下载缓存中的TypeScript 4.9.5对两个core文件独立strict typecheck。
- 未完成：全项目lint/tsc/build。Yarn冻结安装停在依赖下载；offline重试明确缺npmmirror上的@svgr包，完整node_modules未建立，eslint/tsc/cross-env命令不可用。不是把命令失败当通过。
- 未运行：Playwright。没有改UI/数据接入；完整浏览器回归交给现有PR CI，尚不宣称通过。
- 本批没有新增数据库迁移、工具权限、部署或用户数据；Smart Session尚未在Today上线。

## 下一模型直接执行

1. 先核实本分支PR/CI结果；依赖可用后跑yarn lint、yarn tsc --noEmit、yarn build和既有Playwright。
2. 实现owner-safe evidence snapshot adapter，特别是events/legacy镜像去重、时间戳单位、Asia/Shanghai日计数、恢复事实与coverage。
3. 新建轻量smart execution context + checkpoint，复用Qwerty renderer，不重写打字引擎。部分词block不得借用chapter taskRun误造整章完成。
4. 在真实保存/恢复/停止语义通过后，接Today「开始今天的学习」；停止不欠债，下一block重算。
5. 增加有版本的cloud learningIntent存储/校验，沿用revision/idempotency；不要把新contract硬塞当前仅chapter的MCP写接口。
6. 接一篇来源/答案可信的阅读，先跑通词汇→推荐→真实作答→独立解释→诊断候选闭环，再扩题库/FSRS。

不要重做OAuth、Command Bus或Qwerty；不要将拼写表现叫语义掌握、将键间耗时叫回忆延迟。未同步数据仍然未知。
