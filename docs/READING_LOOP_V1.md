# Reading Loop v1

> 2026-10-08 续接：当前实现状态见 [STATUS](STATUS.md)；AI 策略、证据摘要、阶段确认及阅读候选边界以 [AI_COACHING_LOOP_V1](AI_COACHING_LOOP_V1.md) 为准。本文的旧阶段状态不代表当前部署。

更新：2026-10-07。

Reading 是 Astra `Smart Session → Block → Activity` 架构中的第二种真实 Activity。它扩展现有学习大脑，不重写 Smart Session、AI Coach、Cloud Plan 或 Qwerty。

## 1. 目标

Wenyan 的阅读闭环最终是：

`词汇 evidence → 推荐合适文章 → 真实作答 → immutable facts → AI interpretation → future intent / 下一次 Smart Session`

v1 先完成最小可信执行链：

1. 有版本号的 passage / question domain。
2. 可恢复但非权威的本地作答草稿。
3. 提交后写入真实 `question_attempted` 与 `reading_completed` facts。
4. 多设备恢复认识 source v3 facts。
5. AI 错因分析仍然只是 interpretation，不写成历史事实。

## 2. 内容边界

公开仓库不直接存放来源不清或版权受限的正式考研真题正文。

代码只依赖稳定：

- `passageId`
- `version`
- source metadata
- paragraphs
- questions/options/answer
- optional vocabulary metadata

真实私人题源后续通过 private content provider 接入。当前仓库只包含一篇 `wenyan-original` smoke-test passage，且 `recommendationEligible=false`，不得被自动推荐器当成正式考研材料。

## 3. 真实事实与解释分离

### `question_attempted` source v3

事实字段：

- reading `attemptId`
- `passageId / passageVersion`
- `questionId / questionType`
- 用户最终提交的 `selectedOptionId`，可为 null
- 当时内容版本中的 `correctOptionId`
- `answered`
- `isCorrect`，未作答为 null，不把未答伪装成答错
- `answerChangeCount`
- 内容自身的 `questionTags`

`questionTags` 描述题目，不描述用户为什么错。

### `reading_completed` source v3

事实字段：

- `attemptId`
- passage/version/source kind
- 总墙钟 `durationMs`
- question/answered/correct counts

当前 duration 只是“打开本篇到提交”的墙钟时间；不是纯阅读 active time，也不是每题耗时。后续 Facts v3+ 可以增加 visibility-aware active timing，但不能反向伪造旧记录。

## 4. 不属于 immutable fact 的内容

以下内容以后可以由 AI 推断，但必须单独存 interpretation：

- vocabulary gap
- familiar-word misinterpretation
- long-sentence parsing
- reference / pronoun
- inference
- main idea
- detail location
- logic
- time pressure
- uncertain / other

例如“Q3 选 B、正确 D”是事实；“主要因为长难句”不是事实。

## 5. 草稿与中断

未提交阅读只保存在本地草稿：

- 可以刷新后恢复已选答案；
- 不产生 learning event；
- 不算完成；
- 不算答错；
- 不进入 AI evidence。

提交是唯一把本次作答转成 immutable facts 的边界。一次提交在一个 Dexie transaction 中写入所有 question facts + reading completion。

## 6. Recommendation contract（下一批）

阅读推荐不能等价于“词越熟越优先”。候选至少应允许计算：

- `observedCoreCoverage`
- `recentExposureCoverage`
- `weakWordOverlap`
- `unobservedCoreCount`
- 是否做过 / 最近做过
- 文章预计时长
- 当前 session time budget
- 当前训练目标：迁移、速度、题型、推理等

这些指标表达 evidence / exposure / coverage，不称 mastery。

推荐输出应该是 `ReadingCandidate`：

- stable `contentId`
- estimated seconds
- deterministic eligible set + 稳定展示次序（不是适配分数）
- reason code
- evidence refs

ChatGPT 可在可信 eligible set 中选择具体文章与目的；Smart Session 只消费可信 adapter 重新校验后的 candidate，逐项执行约束仍由代码决定。

## 7. Smart Session 接入原则

Reading 是 atomic activity：第一版整篇 + 题组不可随意拆成半篇。

只有当：

1. passage 真实可加载；
2. executor 已存在；
3. 预算能容纳；
4. 当前目标允许 reading；

才把 `reading` 放入 `availableActivities`。

演示 passage 永不进入自动 candidate pool。

当前 vocabulary executor 使用 ReviewRecord；Reading 不得伪装成 ReviewRecord，也不得产生 chapter completion。后续 Smart runtime 要为 activity 类型增加独立 execution context。

## 8. 后续顺序

1. Reading Runner + v3 facts + restore（本 PR）。
2. private content provider contract。
3. vocabulary evidence → passage coverage/recommendation core。
4. Smart Session reading candidate adapter + runtime execution/resume。
5. ChatGPT 增加 reading evidence / interpretation 读取工具。
6. 第一篇可信私人考研阅读端到端验收。
7. 再扩完形、翻译、新题型、长难句。
8. Facts 更丰富后再接 item-level FSRS，不把拼写 evidence 直接冒充 semantic recall。

核心 invariant 不变：

> AI may control future learning intent, but must never rewrite past learning truth.
