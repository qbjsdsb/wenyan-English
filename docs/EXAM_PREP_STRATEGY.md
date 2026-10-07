# Wenyan English：考研英语一备考策略

> 2026-10-08 续接：当前实现状态见 [STATUS](STATUS.md)；AI 策略、证据摘要、阶段确认及阅读候选边界以 [AI_COACHING_LOOP_V1](AI_COACHING_LOOP_V1.md) 为准。本文的旧阶段状态不代表当前部署。

更新：2026-10-07。

本文件记录已经由用户明确确认、后续模型不应反复重开的产品决策。它建立在 `SMART_SESSION_V1.md`、`AI_COACH_CONTRACT.md` 与 `READING_LOOP_V1.md` 之上，不替代这些底层合同。

## 1. 考试目标

- 目标考试：**考研英语一**。
- 当前产品主线：English-first，现当代文学模块继续冻结。
- Wenyan 的目标不是“把词拼对”，而是逐步提升词汇、阅读理解、真题做题能力与整体英语能力。

## 2. 主词汇路线

用户希望以 **《考研英语红宝书》方向的较大词汇覆盖** 作为主要词汇路线，而不是只追求最小高频词表。

产品原则：

- 一个主推进词源，避免多套主词表同时制造重复进度。
- 真题中暴露的高价值词、熟词僻义、词组作为动态补充层，不反向打乱主词表顺序。
- 公开 GitHub 不提交来源不明或版权受限的整套红宝书词表。
- 后续建立 private vocabulary provider contract；用户合法持有/提供的词汇内容可放在私人 Supabase 或本地私有内容层，代码只依赖稳定 content/item ID 与版本。
- 在私有红宝书内容尚未接入前，不伪称当前词书就是“红宝书”。

## 3. 学习阶段（Learning Stage）

长期学习阶段是高层 future intent，不是学习事实。

### `vocabulary`

当前默认阶段。

- Smart Session 只自动安排词汇相关 Activity。
- 可以有 new / review / weak / dictation 等词汇内部变化。
- Reading Runner 可以继续开发、测试和手动访问，但不得自动插入当前 Smart Session。

### `mixed`

用户确认“可以开始做题”之后进入。

- 词汇与阅读/真题共同进入 Smart Session。
- Reading recommendation 可以利用近期词汇 evidence、时间预算、文章难度与训练目标选择合适 passage。
- 词汇仍持续推进，不因开始做题而被清零或完全停止。

### `exam_practice`

临近考试后的后续阶段。

- 真题与题型训练占主要比重。
- 词汇更偏向由做题暴露的问题驱动，同时保留必要的到期复习。
- 后续按英语一题型逐步覆盖阅读、新题型、完形、翻译、写作。

## 4. 阶段切换权限

AI 可以根据真实 evidence **提醒/建议** 切换阶段，但不能擅自修改长期阶段。

例如 AI 可以说：

> 最近词汇推进和复习已经比较稳定，可以考虑开始加入少量阅读。要切到混合阶段吗？

只有用户明确确认后，才把长期阶段从 `vocabulary` 改为 `mixed`。

短期 override 不属于长期阶段切换，例如：

- “今天只背词” → day/session scope 只允许 vocabulary。
- “今天想做两篇阅读” → 当前 day/session 临时提高 reading 优先级（前提是长期阶段和执行器允许）。

长期阶段改变属于需要用户确认的高层 product decision；日常负荷、复习比例、新词上限等仍可由 AI 自动调整。

## 5. AI 提醒切阶段时看什么

不要用单一“掌握率百分比”触发。

提醒可以综合：

- 主词表实际推进量与覆盖范围；
- 最近若干学习日的稳定性；
- 弱词/复习 backlog 是否受控；
- 已有词汇 evidence 与候选英语一 passage 核心词的 observed/recent exposure overlap；
- 用户最近实际学习时长与完成节奏；
- 距离考试阶段目标。

这些都只是决策证据。AI 应说明不确定性，不能把拼写 evidence 称作 semantic mastery。

## 6. 阅读 / 真题内容

用户同意真实考研材料放在其私人 Supabase 内容层。

公开仓库保留：

- schema / TypeScript contracts；
- provider / loader；
- stable `contentId + version`；
- tokenizer / vocabulary metadata contract；
- smoke-test 自有内容。

私人 Supabase 可保存用户合法使用的：

- 英语一 passage；
- 题目、选项、答案；
- 来源/年份/题型元数据；
- 解析或用户自己的学习标注；
- passage vocabulary metadata。

Smart Session 永远只消费已经通过 provider 校验、真实可加载、版本稳定且 `recommendationEligible=true` 的内容。

## 7. 做题体验

阅读默认：**整篇作答 → 统一提交 → 再复盘**。

不在每答一道题后立即泄露正确答案。

提交后的 immutable facts 与 AI interpretation 分开：

- Fact：选择、正确答案、是否正确、答案修改次数、整篇墙钟耗时等。
- Interpretation：词汇障碍、熟词误解、长难句、推理、主旨、细节定位、逻辑、时间压力等。

AI 先给简短诊断；需要时再展开逐题、逐句和词汇解释。

## 8. 题型实现优先级

1. 阅读理解
2. 新题型
3. 完形
4. 翻译
5. 写作

不要并行堆五套执行器。先让 Reading Loop 形成真实闭环，再复用事实/内容/AI 分析架构扩展其他题型。

## 9. FSRS 决策

当前暂不接 FSRS。

原因：现有主要词汇 evidence 是拼写 attempt；把拼写正确/错误直接映射成 semantic recall 的 Again/Hard/Good/Easy 会制造伪精确调度。

未来先补更可靠的 semantic/contextual evidence，再考虑把 FSRS 放在 item-level scheduler：

- FSRS / item scheduler：某个 item 什么时候值得再出现；
- Smart Session：这一段学习应该组合哪些 Activity；
- AI Coach：阶段、目标、负荷和宏观方向。

这个分层沿用 Astra 的学习大脑，不重新设计。

## 10. 当前实施顺序

1. Reading Loop v1 runner + source-v3 facts 收口并合并。
2. 独立用户确认的 `learningStage` preference / Activity Policy（不加入 generic auto-adjust whitelist）；当前默认 `vocabulary`。
3. 建立 private vocabulary provider 与 private reading content provider contract。
4. 接用户合法持有的红宝书主词汇内容；保持较大的词汇覆盖。
5. 实现 deterministic Reading candidate prefilter；ChatGPT 在候选中做高层选择。
6. Smart Session 接 ReadingCandidate，但严格受 `learningStage` gate：`vocabulary` 阶段不自动推荐 Reading。
7. AI 增加“是否适合进入 mixed 阶段”的解释型提醒；未经确认不切换。
8. 用户确认后进入 mixed，跑第一篇真实英语一阅读端到端。
9. Reading evidence → AI interpretation → future intent / 下一次 Smart Session。
10. 证据足够后再评估 semantic recall 与 FSRS。

核心 invariant 继续保持：

> AI may control future learning intent, but must never rewrite past learning truth.

新增阶段 invariant：

> AI may recommend a long-term learning-stage transition, but only the user may confirm it.
