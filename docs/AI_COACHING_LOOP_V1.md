# AI Coaching Loop v1 — 正式设计与续接依据

2026-10-08（Asia/Shanghai）。适用 Wenyan English；本合同对旧文档中阅读自动评分、阶段写权限及 inline AI 的描述具有优先级。它扩展已有 Smart Session / Learning Intent / Reading Loop，不另造编排系统。

## 1. 产品目标与非目标

**Think → Persist Intent → Execute Locally → Observe → Think Again。** ChatGPT 是周期性、按需的策略大脑；网站是事实记录者和可靠执行器。用户明年参加考研英语一，当前长期阶段 vocabulary；主词汇路线为红宝书方向的广覆盖，私人 provider 尚未提供内容时必须如实显示 unavailable，不能把现有词书进度冒充红宝书进度。考试具体日期未知；不要猜考试倒计时。文学冻结。

本次不做站内聊天、每块实时模型请求、OAuth、数据库改造、内容导入、FSRS、readiness score、UI 重构。不得为了新名字重做已有系统。

## 2. 决策记录（后续实现无需重开）

| ID | Chosen option | Rejected alternative | Reason |
| --- | --- | --- | --- |
| D01 | 提供原始口径的证据，ChatGPT 判断阶段适配 | 加权 readinessScore 或隐藏阈值判定“准备好了” | 没有校准的能力标签；伪精确不可解释，也无法取代目标/疲劳/用户偏好判断 |
| D02 | 周期性/用户按需调用 AI，保存有期限的 intent | 每个 block 等待 ChatGPT 回复 | 学习流不能依赖网络、插件会话或模型延迟；下一块必须本地可算 |
| D03 | summary-first + 有界 drill-down | 倾倒事件全史或让模型先调用十几个工具 | 先足够判断，再为具体疑问找证据；同时控制 token 与选择性取样偏差 |
| D04 | 代码保证内容、版本、预算、权限、去重与实际完成 | 模型承担硬约束 | 模型表达不是授权、内容或执行证据；边界必须可测试、重复验证 |
| D05 | 长期 stage 独立、用户确认 | generic auto-adjust 可改 stage | 阶段是用户的学习方向承诺；高信心推荐仍不能代替确认 |
| D06 | 普通未来负荷沿用自动写 intent，revision/expiry/撤销 | 每次减新词/改复习都弹确认 | 用户已明确授权，可逆调整的频繁审批会破坏用途 |
| D07 | spelling exposure / error evidence | masteryRate 或“认识了多少词” | 跟打/拼写不测义项理解；没有记录也不证明不会 |
| D08 | rationale / interpretation 独立于事实 | 把“长难句导致错误”写成事实 | 错因会改变，真实选项不会；重新分析不能改写过去 |
| D09 | deterministic eligible set 内由 ChatGPT 比较阅读 | coverage 加权总分强制选唯一赢家 | 迁移、推理训练和速度目标可能选择同一篇；覆盖仅是一维证据 |
| D10 | FSRS 延后，未来只做 item-level scheduler | 将 wrongCount 映射成 Again/Good/Easy | 当前证据不足以定义语义回忆等级；不增加虚构科学精度 |
| D11 | 扩展现有 Learning Intent 的解释 envelope | 新建平行 CoachDecision workflow/store | 现有 scope/revision/幂等已够；阶段另存只因权限与寿命不同 |
| D12 | 用户拒绝后默认等用户重开，或遵守明确 revisit preference | 每日自动重新建议或“7天科学冷却期” | 拒绝是未来偏好，不是能力不足；提醒节奏不能冒充学习规律 |

## 3. 职责与三类信息

| 层 | 内容 | 写入方 / 权威 |
| --- | --- | --- |
| Immutable fact | word_attempted；Q3 实选 B、当时答案 D；reading_completed | 网站真实执行，追加存储，UUID 与内容/答案版本；命令成功不是完成 |
| Derived evidence | 可见窗口内活跃日、重复暴露、近期拼写出错词数、候选词汇交集 | 纯函数从 facts 重算，algorithmVersion + source refs；不是新事实 |
| Interpretation | “可能复习压力大”“可考虑 mixed”“可能推理题薄弱” | ChatGPT 的 rationale；可修订、撤回，保留不确定性 |
| Future preference | stage、今天20分钟、用户拒绝阶段提醒 | 单独 future intent / user preference；不是学习能力事实 |
| Content metadata | 答案核验、题型、词汇标注、版本、预计分钟 | 可信 provider 的有版本声明；不能由 Coach 自报为可信输入 |

所有聚合放在 `derived`，不把聚合包装成 `facts`。概要通常无需携带原始事实；`evidence` 给可追溯窗口及少量示例 ID。Interpretation 只放现有 intent.rationale 或独立读取的分析里，builder 不生成解释。

强制语言：spelling evidence ≠ semantic mastery；unobserved ≠ unknown；durationMs ≠ recall latency；缺记录 ≠ 没学习；阅读 overlap ≠ 阅读能力。null 表示未测量/缺输入，0 只表示声明的可见范围内观察到零。`complete` 只描述读取覆盖，不描述完整人生学习史。

## 4. Coaching Context 合同

`buildCoachingContext(input)` 是纯 TypeScript 核心：显式 now / snapshotId / timezone；不调用模型、网络、React、数据库或随机数。Adapter 负责一次一致性快照、owner 验证、运行时 schema 校验、分页完整读取。Core 仍拒绝冲突 UUID，隔离未来时间；排列输入不能改变结果。

规范结构（具体已实现字段以 src/coaching/types.ts 为准）：

```ts
{
  schemaVersion: 1,
  snapshot: { id, generatedAt, timezone, algorithmVersion, coverageQuality, warnings },
  preferences: {
    exam: { type: '考研英语一', targetYear: 2027, date: null },
    learningStage: { current, revision, provenance },
    vocabularyRoute: { desiredSource: '红宝书', providerStatus, providerRef },
    currentIntent: { ongoing, day, session } // 引用 + revision，按需展开
  },
  derived: {
    recentLearning: { activeDays7, activeDays14, wordAttempts7,
      firstObservedWords7, reviewModeAttempts7, repeatedExposureAttempts7,
      recentSpellingErrorWordCount, interruptions: null },
    reviewPressure: { scheduledDueCount: null, basis: 'not_measured' },
    readingCandidates: { items, eligibleCount, truncated, order: 'content_id' }
  },
  dataCoverage: { historyCompleteness, historyFrom, cloudReceivedThrough,
    localOnlyPossible, wordHistoryTruncated },
  executionCapabilities: { vocabulary: true, reading: false },
  evidence: { window, refs, sampleFactIds },
  uncertainty: [/* 固定口径、当前真实缺口 */]
}
```

计数定义：

- 7/14 天为指定 IANA 时区的“今天及此前6/13个日历日”，今日截止 snapshot.now；不是任意 168 小时。计数包含窗口边界，排除未来事件。
- activeDays v1 仅由有效 word_attempted 观察，必须标记 `activityBasis=word_attempted`；不是全站出勤。阅读扩展后另升 algorithmVersion，不静默换口径。
- firstObservedWords7 = 在所给可见历史里首次出现于窗口的规范化词形数，不叫“新学会”；截断历史只能称所见历史首次。
- reviewModeAttempts7 是原始 reviewMode=true；repeatedExposureAttempts7 是该词存在更早可见 attempt；两者不是 scheduler due，也不相加。
- recentSpellingErrorWordCount = 近14日有任一 wrongCount>0 的唯一词形数；并不复刻 planner 的 weak 阈值，不叫弱词能力总数。
- 未收集正式 interruptions / semantic recall / reliable active time，返回 null + 原因。不得从页面离开、没有事件或键间时间猜测。
- 不把全词库未见词当 backlog。reviewPressure 暂不输出 high/low：现有 scheduler 未提供可信 due 概要；近期拼写错误是独立描述性证据。
- 红宝书进度只有 provider 明确给出版本、分母、稳定 item mapping 后才增加，当前 null；其他词书暴露不等价于该词表推进。

`snapshotId` 由 adapter 根据 owner + 数据读取 revision/watermark + 显式时间 + algorithmVersion 生成，不由 Coach 提供。生成时间不等于同步水位；latest occurredAt 更不等于 cloud received watermark。迟到事件使下一快照变化，不改旧解释所引用快照。

## 5. Token budget 与追溯

常规概要目标 1,500–2,500 tokens，硬传输上限 24 KiB UTF-8（不是假称等于某个固定 token 数）。最多5篇候选、5个词/题型示例、每组最多3条 sample event ID、全局最多6条 sample ID；摘要理由≤400字符、uncertainties≤5条。实现 core 返回固定小数组；服务接入必须另做字节预算校验，不返回被 JSON 截断的响应。

省略正文、答案文本、逐词历史、设备信息、完整 intent 修订日志。不要为了压缩去掉 coverage / warnings / schema / provenance。超限先减少候选/示例，返回 omitted counts；最低 envelope 都超限则返回结构化 error，不谎称完整概要。

聚合 evidence ref = snapshotId + metric/window + algorithmVersion + owner-scoped query descriptor。sample IDs **不是完整分子证明**；drill-down 必须能重新取该窗口，或返回 snapshot_unavailable。不得凭任意字符串声称已支持快照重放。Core 只构造 descriptor；未来 adapter 保留 cursor/manifest 后才可承诺重放。写入 rationale 保留 input snapshot + coverage；历史已压缩/权限撤回则证据 unavailable，而非编造细节。

| 情况 | 概要内 | 需要时钻取 |
| --- | --- | --- |
| 最近怎么样 | 7/14日计数、当前偏好、覆盖缺口 | get_weak_words；get_word_history |
| 要不要降低新词 | 重复暴露、拼写错误变化的计数及口径 | 特定词历史/两相同口径窗口；不自动诊断疲劳 |
| 是否开始阅读 | stage、提醒偏好、少量候选 exposure | get_passage_evidence（未来），不倾倒文章 |
| 推理题是不是薄弱 | 未来按题型 answered/correct/未答数及分母 | get_reading_attempt（未来）逐题原始选择 |
| 为什么之前这么安排 | intent id/revision、rationale 引用 | 当前已有 get_learning_intents；未来 revision 详情 |

不存在的 drill-down 工具标明 planned，不能告诉 ChatGPT 已可调用。详细查询也要 cursor/limit/owner；重复读取相同快照可复用，事实变化才重算。

## 6. 窄 MCP 合同（本 PR 不宣称上线）

`get_coaching_context`，readOnlyHint=true；无 userId、SQL、任意 filter 或客户端写入的事实。

```json
{
  "type": "object", "additionalProperties": false,
  "properties": {
    "includeReadingCandidates": { "type": "boolean", "default": false },
    "candidatePurpose": { "enum": ["execution", "stage_assessment"], "default": "stage_assessment" },
    "candidateLimit": { "type": "integer", "minimum": 1, "maximum": 5, "default": 3 }
  }
}
```

输出 schemaVersion=1 的 CoachingContext（上述 TS 是规范输出合同），不接收 now/timezone/owner；服务端取 now，timezone 从用户 profile（当前 Asia/Shanghai），身份来自现有认证。成功响应还须 `toolVersion`、`requestId`；错误 `unauthorized | unsupported_schema | snapshot_unavailable | budget_exceeded | invalid_input`。无同步数据仍成功返回 sparse/unknown，不能 404 当无学习。

可选 `get_reading_candidates({purpose, limit<=5, cursor?})` 与相同快照构建器共用逻辑，返回稳定 candidate refs + catalog revision + bounded cursor。分页顺序不是推荐排名。预算从有效 intent/本地 runtime 可信进度求剩余量；云端不了解当前剩余预算时 executableNow=false，不能把 targetMinutes 当 remainingMinutes。

MCP 接入必须读最新 Supabase skill/changelog，再采用既有 SECURITY INVOKER / RLS；不能为了 builder 增设 service-role 全权读取。当前只读数据库并不能看见离线设备；必须 localOnlyPossible=true，不能输出“所有设备已齐”。

## 7. Reading 候选：可见不等于可执行

Provider 校验内容真实存在且可加载、owner/license、当前版本、正文/题目/选项完整、答案逐项已核验、recommendationEligible。Core 信任的是经 adapter 验证的 provider metadata，不是 AI 输入。

内容不真实、版本不匹配、demo、缺内容/答案的材料，在任何目的下都不进入可信候选。Repeat policy 显式为 never_same_version / after_cooldown / allowed；缺 policy 拒绝。Cooldown 是产品偏好，不是记忆科学常数；未知做题历史不能声称“未做过”，默认阻止自动执行，阶段评估可以带不确定性展示。

**execution**：还需阶段、真实自动执行能力、剩余预算、repeat/cooldown 全通过。预算为可用于 atomic passage 的净剩余秒数（调用者已扣 hard stop、收束/休息余量）。未知预算不自动启动。网站无法离线加载也不能进入离线执行集合。

**stage_assessment**：允许在 vocabulary 阶段、自动执行器尚未接好时展示合格内容特征；`executableNow=false` 及 blockers 必须显式。不得把评估候选直接传 planner。已知超预算/cooldown 的文章只在明确评估目的展示，注明限制；不能称可执行候选。

每项：contentId + contentVersion + provider/catalog reference、预计分钟及 estimateBasis、core 分母、observed/recent exposure 分子、近期 spelling-error overlap、unobservedCore、同版本已完成次数或 null、topic/question tags、uncertainties、executableNow/blockers。v1 core 用精确 surface 的 trim + 小写交集，**不根据 lemma 自动等同屈折词形/义项**；未标核心词 denominator=null，而非0%掌握。阅读完成本身不生成逐词 exposure。

先稳定 contentId/version 排序分页；顺序不是推荐质量。后续可按显式 topic/question type/purpose 过滤、分组轮转，仍不加 weighted suitability score。ChatGPT 可以因推理训练选择词较熟的文章；不得把最高 lexical overlap 当必须最优。

## 8. Future Intent / Coach Decision

**不建第二个 CoachDecision 状态机**。普通建议继续写现有 `revise_learning_intent`：scope、constraints、goals、effectiveFrom/expiresAt、rationale、expectedRevision、requestId。本次不扩现有 DB whitelist；未支持字段不能塞入现有 RPC 假装保存成功。

未来唯一小扩展：版本化解释 envelope，可选 `contextRef`、`recommendedContent: {contentId, contentVersion, purpose}`、`stageRecommendation: {target, rationale}`。它们都不授予 execution 权限；stageRecommendation 不等于 stage。confidence 保留 low/medium/high，仅代表解释信心，不是能力概率。evidenceRefs 必须解析为已读 snapshot/fact/user-preference ref；不能伪造 learning event。rationale 中用户自述“累”引用用户偏好来源，不创建疲劳 fact。

已有 newWordCeiling/reviewPreference/intensity/focusDictionary/targetMinutes 足够表达大多数调整，避免重复 loadMultiplier/focus DSL。优先保持短期建议有期限；低风险普通调整无需再次确认。撤销新建 revision 或 clear 后回到 defaults；不得删除解释修订史。

推荐内容在开始时重新 join 可信 catalog，从中取估时/版本/校验信息。未知 contentId、变更版本、撤销内容、过期 intent、stage locked 或不够预算 → 拒绝该推荐 + 原因，回退词汇；不能直接把 AI JSON cast 成 ReadingCandidate。现有 recommendationRank 只作为兼容字段：经过验证的 AI 选择排前，其余稳定次序；不是新的数值能力评分。尚未接线时不要放行 reading。

## 9. Stage 确认与提醒

Stage 是独立的长期用户偏好，**不是 ongoing constraints 的任意字段**。revise_learning_intent 必须继续拒绝 learningStage（包含嵌套绕行）；preferredActivities=['reading'] 永远不能解除 vocabulary gate。

未来窄 `confirm_learning_stage`：expectedRevision、previousStage、newStage、requestId、reason、confirmationRef。服务记录 timestamp、actor、confirmed intent revision、confirmation provenance；只有当前用户明确指定/认可目标 stage 的确认可用。“随便安排”“今天一篇阅读”“昨天曾说以后开始”都不足以转换长期阶段。回退到 vocabulary 也属于用户长期选择，走相同流程。

**安全实情**：LLM 传 `confirmedByUser=true`、复制一句话或 conversationId 都不是服务端可验证的用户确认。MCP 若没有可信平台提供的用户确认 receipt，先创建 pending proposal，由第一方网站确认（仅阶段转换需要一次点击），或保持纯建议；不能仅凭工具命名宣称技术上保证用户确认。未来若平台提供绑定用户/目标/时效的 authenticated interaction receipt，可直接消费当前对话确认。读取输出区分 product_default 与 user_confirmation；缺 stage row 默认 vocabulary，不伪造确认时间。

“今天想做阅读”：vocabulary 下可手动进入已验证 runner，作为独立一次性用户动作；自动 Smart Session 仍只背词。v1 不增加让 AI 自行声称“用户想做”的 bypass 字段。用户已在 mixed/exam_practice 时临时 day/session 偏好可自动生效，不修改 stage。显式今天只背词限制活动集合，不是降低长期阶段。

拒绝 mixed 保存为 future preference：targetStage、declinedAt、provenance、revisit policy。默认 `user_reopens`；次日、数据刷新、新的 AI 会话均不解除。用户可明确同意“再过一段时间/再练若干天提醒”：记录 notBefore + additionalObservedActiveDays，**两者同时满足**才允许 AI 再评估，不自动弹提醒。阈值是协商的提醒节奏；缺可信增量历史时继续 suppress。用户主动询问“现在适合了吗”可以就该问题回答，不代表自动永久清除拒绝偏好。到期 ≠ 必须提醒，仍须新证据和 AI 判断。

## 10. 执行、离线与过期

优先级：本地 defaults < ongoing < day < session；现有实现字段覆盖合并。这里不能声称它已实现旧文档说的“所有 ceiling 自动取最小”；扩 reading 前需明确区分硬限制与软偏好。hard stop、每日新词累计、当前已做项绝不能被新 session 重置；UI 当前明确停止是最终权威。

今天20分钟：day expiresAt 为用户时区下一午夜（若期望当前 session，可用 session scope）；不是 RPC 最大48小时就一律存48小时。session intent 将来必须绑定 sessionId，当前实现仅期限 scope，未绑定前不能声称不会污染重开 session。ongoing fatigue override 也应短期过期。

在线获取/校验有效 intent → owner-scoped 本地缓存完整 envelope → 每块边界重新验时间/版本，使用本地最新 facts → 离线用最后仍有效缓存 → 过期/无效/从未缓存用 defaults。不能无限沿用“最后一次曾有效”值；时钟异常保守 fallback 并标明 uncertainty。退出/换账号隔离缓存，撤销只在线后可获知，离线写入权限不扩大。当前代码网络失败直接 defaults、尚未有持久 intent cache，不能把设计写成已上线。

进行中的词/文章保持 frozen content version；新 intent 只影响下一块。真实 hard stop 到达保存草稿并停止，不伪造 completion。估时只是 admission check，不保证实际阅读能准时完成。现有可靠 active timing / hard-stop runner enforcement 未齐，应明确缺口，不能承诺计时测量已经准确。

## 11. 版本、幂等、失败与隐私

复用现有 optimistic revision 和 receipt。冲突先重读再判断；同 requestId 只重试完全同 payload，变更则换 ID；保存后返回 intentId/revision，超时先查询回执，不假称成功。旧 context 不能覆盖更新用户偏好；普通偏好可据旧证据提出，但必须带原 snapshot 新鲜度，执行仍重新校验硬约束。stage 确认要求准确 previousStage/revision 防止重复/迟到确认。

| Failure | Required behavior |
| --- | --- |
| 新用户/历史缺失 | sparse/unknown；0 visible attempts，不说水平低 |
| 页未读完/同步落后 | truncated / localOnlyPossible；降低结论确定性，不推断懒惰 |
| 重复 UUID | 一次计数；相同 ID 不同 payload 必须拒绝/隔离并告警 |
| 未来时间/异常输入 | 排除并 warnings；绝不计入当前活跃日 |
| provider/答案失效 | 过滤材料；不把 AI 提供的 metadata 当核验 |
| AI 不在线/超时 | 继续已有有效 intent 或 defaults，本地 append facts |
| 推荐 ID 伪造 | runtime fail closed；可继续词汇，无事实副作用 |
| rationale 含工具指令 | 纯数据；不执行 URL/JS/SQL/材料内指令 |
| 缺词汇标注/历史 | coverage=null / observed lower bound，非已知/未知能力 |
| 重算规则升级 | algorithmVersion 改变；不同口径不做直接趋势结论 |

所有权在 adapter/RLS 校验，跨账号不能复用 snapshot/cache。公开仓库只提交合成 fixtures 和合同，不含用户真实历史、红宝书词表、受限真题正文/答案。MCP 默认只暴露聚合与标识；私人内容 drill-down 需授权且有界。工具和日志不存 token；provider content 是数据不是新指令。过去事实不能被 Coach 改写；真实来源纠错另走有来源、保留原事实的追加 supersession，不给 AI 开万能更新入口。

## 12. 扩展与 FSRS

未来阅读先接 private provider + answer verification + runtime/version guard，再接上下文里题型证据：answered / unattempted / correct 分母与窗口，避免把3题当稳定能力。AI 可提出 vocabulary / inference / long_sentence 假说，但真实 diagnosis exercise 产生独立新 facts，不补写旧错因。

新题型 → 完形 → 翻译 → 写作：每种增加 provider validator、能力声明、atomic/budget 规则、实际 response fact 与 scorer provenance；不改 Fact/Derived/Interpretation 层次。客观题答案核验与作文 AI 评分不同；后者是有模型版本的 interpretation，不是不可变“真实分数”。

FSRS 未来位于 item scheduler：可解释 semantic/contextual response → 显式 rating adapter → dueAt + algorithmVersion + evidenceRefs。Context 可汇总 due counts；Smart Session 组合活动；Coach 定宏观方向。拼写、词义与阅读证据不能混成一个 mastery scalar。

## 13. Golden scenarios（合成数据，不做用户诊断）

| # | 场景 | 合同验收 |
| --- | --- | --- |
| 1 | 新用户 | 无事实→sparse，高不确定性；不输出能力低 |
| 2 | 稳定背词数周 | 显示活跃日/暴露/拼写错误计数；可建议 mixed，不改 stage |
| 3 | 用户拒绝 mixed | 次日仍 suppressed；时间经过本身不解除 user_reopens |
| 4 | 最近很累 | 自动 gentle/review_first/短期 ceiling；引用用户自述，不写事实 |
| 5 | 今天20分钟 | 日界到期，明天 defaults/ongoing；不继承 day 时间 |
| 6 | A exposure 高于 B | 返回分子/分母/窗口；从未输出“已掌握” |
| 7 | A词熟而推理薄弱 | ChatGPT可因 question tags 选A；无 coverage 最优化约束；诊断需题目证据 |
| 8 | 数据未同步 | localOnlyPossible/incompleteHistory；总量是可见下界 |
| 9 | AI不可用 | 不调用AI也能 deterministic plan + 保存 word facts |
| 10 | 不存在 contentId | 选择校验返回 content_not_eligible；不执行不造事实 |
| 11 | 同UUID重传/冲突 | 重传不双算；冲突拒绝，输入顺序不改变输出 |
| 12 | stage评估/预算不足/版本变更 | 可见候选与执行集合不同；开始时重新校验 |

## 14. 从真实代码迁移（截至本次检查）

main 7591bb3 已合并 #22 Reading Loop；#23 只有 EXAM_PREP_STRATEGY，本次在该 Draft PR 延续。#22 最后 CI success，不能据此声称新提交 CI 成功。

1. 本 PR：锁定本合同/Decision Record，新增纯 context + candidate core 与合成场景；无 DB/MCP 部署，无自动阅读解锁。
2. 下一小步：owner-safe 本地/云 adapter，一致分页与 snapshot manifest；现有事件解析/恢复优先复用。Core 不是鉴权层。接 get_coaching_context，保持 source watermark 与 unknown 明确。
3. 单独小步：stage preference 持久化 + 确认 provenance + suppression；generic auto-adjust whitelist 继续不含 stage。服务端可验证确认没接好就不开放阶段写工具。
4. Intent envelope cache/日界/session 绑定 + 低风险 constraints 向后兼容，补强实际 hard-stop enforcement；继续无 AI 可学习。
5. Private reading provider 校验 + get_reading_candidates + 推荐内容 version intent + runtime admission，最后才把 reading 加入 availableActivities。保留原 Qwerty 引擎。
6. 真实授权内容端到端、真实 OAuth 读取和 intent mutation smoke，再考虑上线。未来 FSRS 不进入这批。

## 15. 不变量清单

- AI may control future learning intent, but must never rewrite past learning truth.
- AI may recommend a long-term learning-stage transition, but only the user may confirm it.
- Deterministic code provides trusted evidence, candidates and hard constraints; ChatGPT provides high-level judgment.
- Wenyan remains usable without ChatGPT; no per-block synchronous AI dependency.
- Spelling evidence is evidence, not semantic mastery; unobserved does not mean unknown.
- 无复杂 readiness/阅读 suitability 分数；可解释原始计数优先。
- visible-to-coach ≠ executable-now；推荐 ≠ 执行，开始 ≠ 完成。
- 解释可变，事实不可改；停止不欠债；scope 到期不可继续影响未来。
