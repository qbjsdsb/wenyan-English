# 当前状态 / 续接入口

更新：2026-10-11。

本页只记录**当前已核实的生产事实、不可破坏边界、开放中的收口工作和下一步高价值缺口**。历史阶段请看 Git history；不要把旧聊天里的 SHA、CI 或 migration 状态当作当前生产事实。

## 当前生产基线

- 仓库：`qbjsdsb/wenyan-English`
- 当前生产 `main`：`6fc0d534ffbd5af80e53f81f6c90a4310ab1e1ba`（PR #77，Dictionary registry integrity closure）。
- main CI run `38126442220`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、Chromium 浏览器流程、production Pages build 与 Pages recovery checks 全部通过。
- GitHub Pages run `38126442230`：**success**，部署源码同为 `6fc0d534…`。
- Supabase：`cmjhxvpkdeheujuteqoi`。
- 生产 Edge Function：`wenyan-english-mcp` **v15 ACTIVE**；#63–#74 当前工作均未修改 MCP/Edge tool contract。
- MCP server contract：0.8.x；Coaching Context：`coaching-context-v1.5`。

## Existing Experience Closure 已进入主干

- #63：Smart spelling owner-bound cursor / stable order / fail-closed；ErrorBook、Analysis、词库进度重新对齐 immutable facts 与 legacy compatibility。
- #64：Vite build fallback、Docker/Yarn 可复现构建、Wenyan backup 命名。
- #65：Dexie v9 owner-aware Learning Event 索引；Today / Practice / Smart Session 高频读取按 owner 收敛。
- #66：正常章节统一使用唯一词书内容源，删除 CET4 第一章硬编码双真相。
- #67：只有真实存在 executor 的学习阶段可确认；Reading / Exam 保持 roadmap，不假装上线。
- #68：Smart Session 样式不再依赖中文 aria 文案。
- #69：Realtime presence 首次连接发布最新设备状态，不发布订阅开始时的旧闭包状态。
- #70：Today 专项快捷入口显式携带并展示上次词池/数量；Today 当日事实使用 owner + time 索引；Reading 入口明确标为“阅读实验”。
- #71：Workspace State v1；显式保存 / 恢复当前词书、章节和专项偏好，账号切换 / stale read / ambiguous save / 本机部分写失败均 fail closed。
- #72：Learning Event browser upload / pull 在数据库 RPC 边界绑定 captured owner；启动 auth 初始化有 generation guard；in-flight sync 按 owner 隔离。
- #74：Cloud Plan browser cache 与 Learning Preferences read / confirm 在 RPC 边界绑定 captured owner；偏好确认同时绑定已加载 snapshot owner；generic MCP/OAuth RPC 保持不变；已合并到生产 main。
- #77：内置词书 registry 已收口：超频 level 2/3 使用独立稳定 ID；Oxford5000 仅保留 canonical 注册项；`idDictionaryMap` 为 null-prototype 且 duplicate ID fail fast；focused regression 已进入 CI。

## Workspace State v1：已上线

Workspace State 只承担跨设备工作区连续性，不是 Learning Fact，也不属于长期 Learning Preference。

- migration `workspace_state_v1` 已应用，生产 version `20261010185505`；
- 每个用户最多一条 `wenyan_workspace_state`；仅保存 `dictId / chapterIndex / practiceMode / practicePool / practiceLimit`；
- Sync 页提供明确的 **“保存本机位置” / “恢复云端位置”**；v1 不做自动 last-write-wins；
- browser-native session 通过 `p_expected_user_id = auth.uid()` 绑定 owner；OAuth client 不允许写 workspace；
- restore 前验证词书 / 章节 / 专项偏好；本机部分持久化失败会回滚；
- mounted `SyncPage` 浏览器回归覆盖账号切换、TOKEN_REFRESHED、旧读取晚到、保存结果不确定后重读以及本机回滚；
- 上线验收时 workspace 表为 0 行，没有测试数据污染生产；相关 RLS / RPC 未被 Supabase advisor 报新增问题。

## Learning Facts owner binding：已上线

目的：浏览器可能先捕获账号 A，再在 RPC 真正执行前切到账号 B；Learning Facts 是历史真相，不能只靠响应后的 UI 检查防串号。

### 生产实现

- web upload：`ingest_learning_events_for_owner(p_expected_user_id, p_events)`；
- web pull：`pull_learning_events_for_owner(p_expected_user_id, ...)`；
- 两个 wrapper 均为 `SECURITY INVOKER`，要求 `p_expected_user_id = auth.uid()` 且只允许 direct Wenyan browser session；
- 原 generic Learning Event RPC 保留，避免破坏 MCP / OAuth read contract；
- sync batch 先解析同一个稳定 session/user snapshot；session 与 `getUser()` 不一致时 fail closed；
- in-flight upload / data sync 按 owner 分桶；账号切换不共享全局 Promise；
- owner mismatch 不把原账号的 immutable local facts 标成网络失败，也不增加 retry backoff；事实保持 pending，等待原 owner 下次重试；
- 初始 `getSession()` 通过 auth generation gate 防止晚到结果覆盖新的本机 owner marker。

### 生产 rollout 与验收

- migration `learning_sync_owner_binding` 已应用，生产 version `20261011000645`；
- PR #72 最终 head `17ac6a78…` 的完整 CI `38097612376`：**success**；最终 Codex review：**no major issues**；
- 合并后 main `c4235a66…` 的 CI `38098193313`：**success**；Pages `38098193330`：**success**；
- 两个新函数均为 `SECURITY INVOKER`，authenticated execute=true，anon/public=false；
- `supabase/verification/learning_sync_owner_binding.sql` 与生产回滚验收共验证六项，全部 PASS：
  1. direct session + matching owner：允许 owner-bound ingest；
  2. ingest owner A + expected B：`learning_owner_changed`；
  3. pull owner A + expected B：`learning_owner_changed`；
  4. OAuth-shaped token 调 ingest wrapper：`direct_wenyan_session_required`；
  5. OAuth-shaped token 调 pull wrapper：`direct_wenyan_session_required`；
  6. 旧 generic `pull_learning_events` 在 OAuth-shaped claims 下仍可调用；
- Supabase security / performance advisor 对 000026 没有新增 finding。

现有 advisor 仍提示项目早期 private 表无 policy、三个旧 `SECURITY DEFINER` RPC 可由 authenticated 执行、leaked-password protection 未开启以及若干 unused index；这些不是 #72 引入，后续单独审计，不能为了“清警告”盲删旧索引或改旧基础设施。

## 当前真实学习能力

### 词汇执行

- 正常章节拼写；
- owner-bound Smart / manual / correction spelling，顺序冻结、cursor 权威、刷新可恢复；
- 专项：拼写 / 词义回想 / 选择词义；
- 词池：当前章节 / 已练过 / 拼写错词 / 词义模糊；
- 未完成专项 run 可恢复；Today 快捷入口明确显示并携带当前专项范围。

### 学习证据

- `word_attempted`：真实拼写事实；零错误不等于语义掌握；
- `semantic_recall_attempted` sourceVersion 4：英文 → 词义主动回想，自评仅是独立 evidence；
- `semantic_discrimination_attempted` sourceVersion 5：真实版本化词书释义的客观辨认；正确不等于 free recall / contextual comprehension / mastery。

Coaching Context v1.5 必须继续把 spelling / recall self-report / objective discrimination 分开，不合成没有证据的“总掌握率”。

### Smart Session / AI Coach

- Smart Session：`elastic-v2`；
- Learning Intent precedence：`session > day > ongoing > local defaults`；
- 当前稳定编排 review / correction / weak / new / semantic recall，并遵守 cooldown、budget、hard stop、new-word ceiling 与真实 executor availability；
- objective discrimination 主要仍是 direct practice / follow-up，不假装已经是独立 planner purpose。

### Cloud Plan

当前真实可执行 task kind **只有 `chapter`**。

Cloud Plan run 捕获 owner / planRevision / taskFingerprint；chapter fingerprint 为 `chapter:<dictId>:<chapterIndex>`。标题、理由、预计时长、截止日期变化不作废同一真实章节目标；目标章节变化则旧 run 不能误完成新 task。Plan completion 只能由 matching immutable learning fact 推导。

## 架构边界

主闭环：

`真实学习行为 → Immutable Learning Facts → Derived Evidence / Coaching Context → ChatGPT 判断 → bounded Learning Intent → deterministic Smart Session → 本地执行 → 新事实回流`

职责保持分开：

- **Learning Fact**：真实历史，只能由实际学习执行追加产生；
- **Evidence / Coaching Context**：从 facts 可重算的证据；
- **Learning Intent**：未来一段学习的策略约束；
- **Smart Session**：根据最新事实与 Intent 即时计算下一小段；
- **Cloud Plan**：少量明确、持久、可追踪的 explicit commitment；
- **Command**：页面/动作控制；command completed != learning completed；
- **Workspace State**：非证据的设备连续性状态；workspace restored != learning happened。

> **AI controls future intent, never past truth.**

## 同步 / 本机边界

- Learning Events local-first；只有明确 owner 的事实进入对应账号上传队列；云端 pull 可恢复缺失事实；
- 未归属旧本机事实需要显式认领；
- ErrorBook / Analysis / 已练章节从当前账号可见事实重新派生；
- Dexie v9 已有 owner-aware Learning Event 索引；
- 普通章节和 owner-bound review 都有明确恢复边界；保存失败不会静默推进；
- 词书有校验后的 last-known-good CacheStorage fallback；不是完整 PWA；
- 本地备份先 staging validate 再覆盖真实 DB；
- Workspace State 与 Learning Event browser sync 都已在数据库 RPC 边界绑定 captured owner。

## 当前开放的收口工作

### Dictionary registry integrity：已进入主干

- PR #77 已 squash merge 为生产 `main` `6fc0d534…`；旧 #73 已关闭为 superseded；
- `/dicts/frequently_used_word02.json` 使用独立稳定 ID `frequently_used_words02`；level 3 保持 `frequently_used_words03`；
- 重复的“中国考试 / 其他” `Oxford5000` 注册项已删除，保留同一真实来源的 canonical “国际考试 / 牛津版”条目；
- `idDictionaryMap` 使用 null-prototype registry，并在未来出现重复 ID 时 fail fast，不再静默覆盖；
- focused Playwright 覆盖 duplicate ID、Level 2/3 identity、Oxford 唯一性和 prototype-chain alias；
- PR #77 最终 head `66caade…` 的完整 CI run `38126189959`：**success**；最终 Codex review：**no major issues**；
- 合并后 main CI `38126442220`：**success**；Pages `38126442230`：**success**。

### PR #78：Remote Control captured-owner closure（进行中）

#78 从已含 #77 的最新生产 `main` 重建；旧 #76 暂不合并，待 #78 完成生产 rollout 后关闭为 superseded。

- device ID：`localStorage → sessionStorage → document memory` 降级；localStorage 被阻止时，同一 tab reload 仍保持稳定 ID；
- auth 初始化复用 generation gate，晚到的 `getSession()` 不能覆盖更新的 auth callback；
- heartbeat / pending / claim / finish 使用 owner-bound browser RPC，并携带 captured owner；
- command 在 claim 返回后以及 `start_task` 的异步边界后重新检查 owner + generation；账号切换时 fail closed，不允许 A 的 command 修改 B 的页面状态；
- cloud `start_task` 在执行前再次要求 plan owner 与 captured owner 一致；底层 `startStudyTask` 仍保留自己的 owner 检查；
- blocked-localStorage 回归覆盖刷新后 device ID 稳定；该 focused regression 已接入 PR CI；
- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；command tool 名称、capability 与 payload shape 保持兼容；`get_action_status` 仅补强 expired executing 的 `effectiveStatus=expired`，同 owner/device 轮询会在 120 秒租约后把仍未过期的 abandoned claim 重新排队；
- 当前下一步：#78 完整 CI + Codex/security review → 000028 生产 preflight / apply / fail-closed verification → 更新本页真实生产结果 → merge → main / Pages 复验 → 关闭旧 #76。

## 产品真实性

- Vocabulary 是当前正式主阶段；
- Reading 主闭环尚未完成，只保留 **阅读实验**；
- Exam Practice 尚未开放；
- 设置页可以展示未来路线，但不会允许把不存在的 executor 当作已上线能力；
- 文学专业课继续冻结，当前只把英语现有体验做深做稳。

## 不可破坏原则

- Historical learning truth immutable；
- Only the user confirms long-term strategic stage changes；
- ChatGPT reasons; deterministic code guards；
- No evidence != mastery；
- Spelling != semantic mastery；
- Objective discrimination != free recall / contextual comprehension / mastery；
- Command completion != learning completion；
- Workspace State != Learning Fact；
- Wenyan works without AI；
- Wenyan should continue without cloud whenever possible；
- 不增加万能 `run_sql / execute_js / control_wenyan` 一类工具；
- 不再无休止叠加 CSS polish。

## 下一阶段高价值缺口

1. 完成 #78 Remote Control closure：CI / security review → production 000028 → fail-closed verification → merge，并关闭旧 #76；
2. 修复 Reading 实验在 passage id / version SPA 切换时的草稿、计时和答案状态重置；
3. 提升“选择词义”干扰项质量：只使用真实版本化词书释义，优先选择结构更接近、较不容易一眼排除的选项，同时继续明确 recognition != mastery；
4. 现有训练可用率：选择词义扩展到**同词书、真实版本化释义**的有界 distractor pool，不让 AI 编造假释义；
5. Reading 实验：passage id / version 在 SPA 切换时重置对应草稿、计时和答案状态；
6. owner-bound review origin 规则抽成统一 helper，避免 manual / smart / correction 在不同文件继续漂移；
7. 长期性能：Analysis / ErrorBook 安全利用 owner-aware index；legacy 去重需要跨 owner companion facts，不能为了快重新制造跨账号泄漏；
8. 真实用户 semantic recall / objective discrimination → sync → MCP v1.5 回流验收；禁止制造 synthetic personal history；
9. 自然出现新的 chapter Cloud Plan 时，再做一次真实 owner / revision / fingerprint → 真练习 → sync → completion smoke；
10. 更高质量语义测量（contextual meaning、熟词僻义、collocation / phrase、Chinese→English production）和 Reading 主闭环继续后置，直到现有词汇系统收口完成。

## 续接顺序

新会话 / Work / Astra 接手时：

1. 重新读取远端 `main`、开放 PR、最新 CI / Pages、Supabase migrations 与 Edge Function 版本；
2. 阅读本页、`ARCHITECTURE.md`、`DATA_MODEL.md`、`MCP_TOOLS.md`、`CLOUD_PLAN_V2.md`、`OBJECTIVE_SEMANTIC_EVIDENCE_V1.md`；
3. 不重新设计已经稳定的 Typing / Dexie / OAuth / MCP / Smart Session；
4. 日常编排沿 `Learning Intent → Smart Session` 演进；Cloud Plan 只承载 explicit commitment；
5. 优先历史真实性、账号隔离、恢复一致性、长期可用性和真实纵向学习价值链，不继续堆零散功能；
6. 每个高价值阶段小批次 commit + push，GitHub 必须始终保留可续接状态。
