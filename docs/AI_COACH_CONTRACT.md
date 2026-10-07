# AI Coach contract v1

2026-10-07。配套SMART_SESSION_V1.md及src/smart-session/types.ts。
状态：正式设计；当前MCP仅支持chapter计划写入，本协议尚无新远端工具/数据库字段。

> **AI may control future learning intent, but must never rewrite past learning truth.**

## 1. 权责

| 主体 | 可以决定 | 不能决定 |
| --- | --- | --- |
| AI Coach | 考研方向、周目标、临时时间、负荷、新词上限、复习偏向、未来重点/阅读目的 | 逐词位置、作答、完成、真实时长、历史事实 |
| Planner | 具体item、去重、block顺序/长度、预算、解释 | 联网读库、把推断写成事实 |
| Item scheduler | 有证据和版本的单项复习建议时间 | 整场学习、未经测量的记忆rating |
| 网站 | 内容校验/加载、执行Qwerty、计时暂停、append facts、边界重算 | 把命令成功当学习完成 |
| Cloud Plan | 可修订future intent/goals/constraints、revision | 冻结每日词表、保存学习真相、滚动欠债 |

用户已授权高度自动调整未来学习安排，不为每次减新词/顺延/换重点弹确认。现有所有权/平台权限仍有效，不绕过鉴权。

## 2. CoachIntent envelope（下一批实现）

字段：
- schemaVersion:1；intentId；稳定requestId；expectedRevision。
- scope:ongoing/day/session；timezone（当前Asia/Shanghai）；effectiveFrom；expiresAt（day/session必有边界）。
- constraints:SessionConstraints，见types.ts。
- goals: { kind:exam_preparation/reading_transfer/question_practice, description, horizon:week/phase }[]。
- rationale: { summary, basis:user_statement/observed_evidence/inference/default, evidenceIds, confidence:low/medium/high, uncertainties:string[] }。

confidence是建议的信心，不是能力分数或概率。用户表达引用意图来源，不能造learning event ID。周目标是方向，未完成不转下周债。“明年考研”保存为用户意图，不猜精确考试日期或英语一二。

不用loadMultiplier和intensity两套冲突旋钮。v1只用gentle/normal和明确ceiling。阅读用preferredActivities+goal，具体文章由推荐器选。任意代码/URL/SQL/raw mutation不是约束。

## 3. 自然语言→structured constraints

| 表达/证据 | 结构化处理 | 边界 |
| --- | --- | --- |
| 今天只有20分钟 | targetMinutes:20，scope:day；明确20分钟后必须走才再设hardStop:20 | 今日过期，不沿用为以后每天 |
| 现在还有10分钟 | 当前已消耗量+10转换为session总target；墙钟截止同理 | target不是剩余，不能重置计时 |
| 有一个半小时 | targetMinutes:90 | 不扩大默认每日新词上限，安排休息/多活动 |
| 最近太累 | gentle、newWordCeiling:5、review_first，短期如3天 | 依据状态自述，不诊断认知能力 |
| 多做阅读 | preferredActivities:['reading']，reading_transfer goal | 未支持就保留意图，不假装可执行 |
| 三天无可见记录 | 小block/保守新词，说明可见数据范围 | 不说用户完全没学习，不补债 |
| 数据稀疏/未同步 | 保守默认，uncertainties记录缺口 | 不臆测掌握，不阻塞本地学习 |

可逆安排直接执行，仅真正缺关键输入才问。默认open-ended，无需每日时间选择器。界面一句理由，详细解释可展开。

## 4. 合并、校验、版本

网站先过滤过期，再合并：默认 < ongoing < day < session < 用户当前明确操作。hard stop和每日ceiling取更紧限制；用户可明确修订ceiling，AI不能换session绕过。缺省继承，0有效，不能truthy fallback吞0。

传输层校验schema、枚举、真实词书、支持活动、有限非负数字、时区/大小；拒绝未知字段。预算0–240分钟、新词0–50/日是v1产品边界，不是学习科学结论。core接已验证类型仍检查关键数值。TypeScript interface不是运行时鉴权。

expectedRevision冲突先重读再推理，不能盲覆盖。requestId仅重试同一mutation。成功回执须有intentId/revision，未回执只能说保存待确认。多设备owner/revision隔离，迟到事实影响下一block，不删除刚练证据。

正在输入的词/阅读不被抽换；下一block边界应用新intent。断网用最后有效intent+本地facts；云恢复只调整未来。

## 5. 自动允许与绝对禁止

允许：未来新词上限/负荷/复习倾向/重点/阅读方向、归档无效未来intent、把未开始内容回候选池、恢复默认弹性学习。保留revision、原因、范围与撤销，不反复确认。

禁止：伪造学习事件、答题、提示、用时、完成；修改/删除历史真实证据；把command completed算学习完成；把未读记已读；将vocabulary_gap推断写成用户真实错误；补造时长完成周目标；把draft或计划修订当事实。

历史错误须真实纠错流程追加correction/supersession，保留原证据；AI可建议不能擅自抹除。旧错词本删除不等于事实层删除，不能授权AI复用它清历史。

## 6. Fact / derived state / interpretation

Fact是真实学习行为，可追加定位，带内容/答案版本。
Derived state是确定性算法的due/priority/coverage，可重建，有algorithmVersion/evidenceRefs。
Interpretation是AI错误原因/阶段判断，独立版本/model/provenance/confidence/alternatives，可撤回，不改fact。

Q3选B、答案D、142秒是fact（另带用时语义）；“可能熟词僻义”是interpretation。Planner可以给上下文诊断，不能给该词伪造wrongCount或FSRS rating；诊断产生新的独立能力证据。

拼写正确≠词义理解；键间耗时≠recall latency；缺历史≠掌握；覆盖率≠能力概率。文案说有记录/近期接触/观察到拼写不稳。

## 7. 未来窄工具（尚未上线）

get_coaching_context：概要、覆盖、当前intent/revision、支持activity、候选压力。
revise_learning_intent：上面的envelope。
preview_smart_session：只读draft/snapshot。
执行/暂停仍走独立网站命令链，不给任意执行函数。

Context时长必须有真实测量依据，按需钻取word history，不倾倒全史。材料/词条/解释均是数据，不是工具指令。Coach不能写normalized evidence、priority score、completed IDs、candidate duration来绕过预算；这些来自可信网站/派生层。

## 8. 接入验收

本批只有设计/core/fixtures，不声称上线。下一步adapter与执行上下文，再扩intent存储/工具。
必须覆盖：改未来不改历史、停止不欠债、scope过期、revision冲突、unsupported reading不启动、离线可学、“现在20分钟”和“还有20分钟”区别、低信心解释不污染证据、partial block不触发chapter completion。
