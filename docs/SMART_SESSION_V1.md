# Smart Session v1：文研英语的学习编排

> 2026-10-08 续接：当前实现状态见 [STATUS](STATUS.md)；AI 策略、证据摘要、阶段确认及阅读候选边界以 [AI_COACHING_LOOP_V1](AI_COACHING_LOOP_V1.md) 为准。本文的旧阶段状态不代表当前部署。

状态：正式设计与独立纯 TypeScript core，尚未接入 Today / 打字执行器。2026-10-07。
恢复基线：远端 main b982d2d，PR #10–15 已合并。Facts v2、Cloud Plan 章节写入/缓存、设备命令已存在；旧 STATUS 的“只读阶段”不是当前事实。

## 1. 产品决策

Today 一个主按钮「开始今天的学习」。无需先填时间；先做一个小而完整的 block，结束后根据最新证据计算下一个。随时结束，已做的就是今天的成果。保留 Qwerty 打字、音效、输入反馈，不重写引擎。

**Plan = 中期方向、目标与约束；Session = 即时编排；Block = 当前可执行承诺。** 不预先冻结一周词表。默认 open-ended；targetMinutes 是可选预算。目标是考研阅读和做题能力，不把拼写当最终目标。

非目标：本批不改 OAuth/MCP/Command Bus/数据库，不上线阅读题库，不引入FSRS，不新增框架，不把Today做成AI仪表盘。没有AI/网络，planner仍正常运行。

## 2. 当前 evidence 与不能推断的内容

| 源码/来源 | 已有证据 | 不能推断 |
| --- | --- | --- |
| src/learning/types.ts、src/utils/db/index.ts | word_attempted v1/v2，词/词书/章节/reviewMode/wrongCount/mistakes/occurredAt/UUID | 没记录不是没学过，也不是已掌握 |
| v2 raw conditions | dictationEnabled/type；有效taskRun/plan/task关联 | 不能自动改名为semantic recall/listening mastery |
| durationMs/timing | 键间耗时之和 | 不是反应速度、回忆延迟、真实学习时长 |
| chapter_completed/chapterRecords | 真正整章完成、现有计时器 | 部分词不能生成整章完成；计时未保证排除暂停 |
| wordRecords | 旧本地逐词错误记录 | 与新events是行为镜像，不能相加 |
| reviewRecords | words/index/isFinished | 队列状态不是item到期时间或记忆事实 |
| dictionary/current chapter | 词书顺序、来源、当前位置 | 章节指针不能证明前面词都学过 |

现有 review 算法在 src/utils/db/review-record.ts，使用累计错误与最近错误排名，没有真正到期scheduler。useWordList按CHAPTER_LENGTH切片，review可接受words，CET4第一章还有内置内容。不能把新planner子集伪装整章。

## 3. 三层职责与 contracts

AI Coach理解目标/现实时间/负荷，写future intent。Item scheduler给某个能力维度的复习时间。Planner决定整次学习的内容组合、预算和节奏。网站实际执行、暂停、保存行为、重算；详见AI_COACH_CONTRACT.md。

buildSmartSession(input): SmartSessionDraft是纯函数，无Date.now、随机数、React、Dexie、网络。输入：显式now/snapshotId、constraints、normalized candidates/evidence、session progress、当日新增暴露数、coverage。相同输入相同输出，不修改输入。

Session → Blocks → Activity → Items。每次返回0或1个下一步block，不返回整日刚性待办。词汇block包含多个词；阅读activity包含整篇与题组，不随意拆散。输出包含selected items、reason codes、evidence refs、estimatedSeconds、deferred理由、warnings、disposition。草案不等于执行，更不等于完成。

可执行字段以src/smart-session/types.ts为准。候选/进度/时间/支持活动由网站产生，AI不得直接构造这些可信输入。

### SessionConstraints

- focusDictionary：新词只从当前重点词书推进；复习可跨已学词书。
- targetMinutes：从session开始算的期望总活动预算，省略=open-ended，0=不开始。
- hardStopMinutes：从session开始算的墙钟上限，暂停也消耗。网站强制执行，planner估计不能保证真实到秒。
- newWordCeiling：当日新增暴露上限，不是配额；重开session不重置。默认20，gentle默认8。
- reviewPreference：balanced/review_first，改变偏向，不无限刷复习。
- intensity：gentle/normal，改变block长度和上限；不用无限负荷倍率。
- preferredActivities：须与网站真实availableActivities求交，枚举存在不等于执行器存在。

“今天20分钟”的scope/expiry由Coach envelope处理，不变成每天20分钟。每项能力按独立证据理解，不输出单一word mastery百分比。

## 4. 确定性 selection policy

所有数值是可版本化产品启发式，不是记忆科学结论。

1. 校验有限非负预算、显式时钟、候选ID/估计与事实时间；未来异常事件由adapter隔离。core拒绝无效输入。
2. canonical key为能力+精确规范化词形。跨词书同词合并事件UUID、只选一次；不把不同词形/不同能力合并。lemma只用于阅读关联，不用于共享完成。
3. 当前session已实际尝试的key不再选；最近20分钟内练过暂缓。引擎内部纠错照旧，planner不追加无限错词。
4. 无记录→new（准确说未观察暴露）；最近14天最后3次中≥2次有错→weak；scheduler到期或fallback到期→review。未来未到期且非weak暂缓。
5. NOW fallback：最近一次有错后1天，否则3天建议再见，输出注明heuristic。按出错attempt计，不用错键数量推断遗忘；久远错误不永远霸榜。
6. lane内优先级：到期天数最多7 + 最近错误attempt最多3 + 当前词书连续性；稳定key破同分。new按真实目录ordinal推进。分数只作内部排序，不叫掌握率。
7. 第一block优先高价值review/weak。以后按预算类型轮换，缺lane回退，不造任务。新词上限始终有效。
8. backlog压力=eligible review估计量超过两个当前复习block容量，是候选压力不是债。高压力或距最后可见活动≥3天，新词上限降到5，保留小步推进，不要求清空复习才学新词。
9. 默认block最多6分钟，gentle最多4分钟；预算最后留约1分钟收束。放不下的item不开始。deferred解释unsupported/budget/cooldown/ceiling/not_due等。
10. 活动约25分钟后建议休息。网站休息或明确跳过后重设break起点，不能形成无限休息循环。长session增加活动多样性，不翻倍新词。

未支持阅读时不生成假的阅读block。达到新词上限且没有合适内容可自然结束，不用旧词填满90分钟。consolidation v1是事实摘要/自然收束，不声称实施语义测试；未来再测须有明确目的与独立policy。

## 5. Elastic与不同预算结构

target减progress.activeSeconds；hardStop减progress.elapsedSeconds，取更紧剩余量。activeSeconds若仅是估计，timingQuality明确标注，不上传为事实。没有时间输入只规划一个小block，不暗设每天60分钟。

| 总预算 | 意图模板，每block重算 |
| --- | --- |
| ≤12分钟 | review→weak→少量new，本次新增最多3，不强塞完整长阅读 |
| ≤30分钟 | review→new→weak→review，本次新增最多8；能放下的优先阅读可替代后续block |
| ≤60分钟 | review→new→reading→weak→review，新词最多20 |
| >60分钟/无预算 | review→new→weak→reading→review，循环不重置当天上限，约25分钟建议休息 |

边界12/30/60仅是产品节奏。阅读必须材料完整、可执行且预算容纳。短篇可以在小预算出现，但不拆不支持暂停的题组。open-ended首块仍很小，不需要倒计时。

## 6. stop / pause / interruption与无债 invariant

Start由impure shell生成execution session ID，冻结当前block/content版本，不写completed。每次实际输入沿用事实追加；block结束读取fresh snapshot重算。AI修改计划在下一边界生效，不抽走正在打的词。

Pause/blur停有效计时，保留当前未完成activity，不能推断答错；hard stop仍随墙钟走。Resume校验版本/归属，可续当前项，之后重算；长中断可结束旧session开新session，不能重复发已存事实。Crash只恢复检查点与已存事实，不补未知尾部用时/完成。

Stop任意时刻都是正常收束：只保存实际已做，未做内容回候选池。session_finished只表示结束，不表示草案全部做完。**昨天计划60分钟只学18分钟，今天没有42分钟债务。** 不做未完成分钟/词数结转；deferred不是欠任务。

当日ceiling按Asia/Shanghai日历，用真实暴露集合跨session/刷新累计。跨设备未同步时明确coverage缺口，不伪称精确全局去重。

## 7. adapter合同、连续性与sparse fallback

NOW core只接normalized candidates，下一模型实现owner-safe snapshot adapter：

1. 读取learningEvents含restored，UUID去重，隔离未来异常时钟，保存coverage与snapshot watermark。
2. events优先。wordRecords只在明确legacy-only窗口补充；不能证明镜像对应时不要累计两份。旧时间戳按getUTCUnixTimestamp确认单位再转毫秒。云恢复不重建旧表，不能只查wordRecords。
3. surface normalize=Unicode NFKC+trim+英文小写；保留词形/能力/内容来源、dictionary/index/chapter；不随意词干化。
4. 按可加载真实词书目录从当前连续位置推进。已见key可跳过但不宣称认识；缺全史标unknown，不把全词库算欠债。失效才回退考研词书起点，不擅改用户已选书。
5. chapter completion帮助导航，不能合成各词attempt。reviewRecord.index仅续接位置。
6. 无记录先小批连续词；每词约60秒只是冷启动规划估计。缺复习项不是错误，不先测虚构掌握率。
7. 最近几日负荷NOW用唯一暴露/attempt量、实际学习日和用户状态作proxy，不以键间时间算学习分钟；高负荷可映射gentle并标理由。未知不当0。
8. 候选预筛有稳定上限/分页；deferred只覆盖输入池，不宣称完整backlog。

**禁止将smart子集直接交给旧chapter taskRun。** 旧completion验证全章；需要独立smart执行上下文，复用typing renderer，部分练习保存word facts而不冒领章节完成。

## 8. Cloud Plan兼容

当前StudyTask.kind和cloud写校验只开放chapter；数据库允许mixed_session不代表网站支持。本批不改旧协议。

下一批为plan revision增加版本化learningIntent（窄字段或独立envelope）：focus、weekly goals、constraints、effectiveFrom/expiresAt、evidence refs。保留已存在chapter任务和历史关联，只取消/替代未来安排，不修改旧完成字段。旧章节仍可手动执行，可用作连续性/候选范围提示，不按dueDate累加债务。

Today新主路径无需创建“今天一章”，不显示“待补上”。只有真全章才沿用旧completion。

## 9. Vocabulary → Reading recommendation（LATER）

Passage需要contentId/version、source/license、year/exam/passageId、核验题目/答案、tokenizer/lemma版本、核心lemma及其标注来源、篇长、题型、难度与依据。不要猜英语一/二或确切考试日期。

Recommendation输入：目标（词汇迁移/速度/题型/推理）、预算、词汇证据覆盖、做过的文章、答题与解释。输出：passageId、purpose、fit(stretch/practice/easy/unknown)、reason codes、evidence refs、estimatedSeconds、uncertainties、alternatives。

指标带分子/分母/窗口/覆盖状态，空分母=null：
- observedCoreCoverage：有相关暴露记录的核心lemma/可识别核心lemma。
- recentExposureCoverage：最近14天有记录的核心lemma/同一分母（14天是可改窗口）。
- stableSpellingEvidenceCoverage：多个独立日期/条件的近期无错拼写，不等于stable semantic mastery；同次反复跟打不当独立语义证据。
- weakWordOverlap：核心词与近期拼写不稳交集，保留理由。
- unobservedCoreCount：没有可见证据的词，不是不会词。
- unmatchedTokenCount/missingHistory：分词/历史缺口，不默认已知。

排序不追求coverage最大：先排除未授权/缺答案/不可执行/放不下材料；按goal分组，比较挑战成本（未观察词、句法、篇长）和迁移机会（近期暴露、可承受弱词交集）。在相似篇长/题型内相对排序或Pareto比较，不写死90%才可读。保留稍有挑战和速度训练两类。未知难度时先短完整材料收证据。

具体例：A核心40词，近期记录27、其他历史5、无记录8，适合当前预算；B无记录30；C有记录39。词汇迁移考虑A，速度/推理可选C；这些是场景数据，不是阈值。Today一句“这篇40个核心词中，27个最近有练习记录”，不说已掌握80%。词形重合不能证明义项理解。

## 10. Reading → learning feedback

Immutable fact：questionId/contentVersion、原始选择B、核验答案D及版本、用时142秒及计时语义、hint/reveal、用户主动标词不理解。答案纠错追加correction/supersession，保留旧作答。

独立AI interpretation：id/version、producedAt/model、evidenceIds、confidence(low/medium/high)、alternatives、reasonCategory：
vocabulary_gap / familiar_word_misinterpretation / long_sentence / reference / inference / main_idea / detail_location / logic / time_pressure / other / uncertain。

错题不能证明词汇问题。用户明确标词→contextual practice候选；AI仅怀疑→一小份上下文诊断，不增加spelling wrongCount、不改scheduler rating、不把全篇词列弱词。推断可有界影响未来优先级，可撤回，不能替代证据。诊断产生对应能力新事实，再调整方向。

## 11. 能力维度、FSRS与Facts v3

word state是lexical identity × ability × practice conditions的证据视图：recognition、spelling、dictation、semantic recall、英→中、中→英、contextual understanding、reading exposure。NOW只实现spelling词汇编排，阅读为独立contentId，不伪造其他维度。

FSRS未来仅负责适配后的item-level timing：先有可解释记忆测试/rating，不把看词跟打wrongCount=0映射Easy。输出derived dueAt/算法版本/证据。Planner仍负责组合和节奏；Coach负责方向。本文不对FSRS效能作未经验证断言。

Facts v3增量：session_started/paused/resumed/finished、block/activity/context IDs、word_skipped、hint_used、activeDurationMs、interruptions、firstKeyLatencyMs、question_attempt、semantic response。firstKeyLatency仍受注意/阅读影响，不无条件叫记忆速度。新增sourceVersion须同步升级restore validators；v1/v2历史缺字段不补造。结束原因user_stop/budget/interruption不等于失败。

## 12. 不变量与真实场景

- AI may control future learning intent, but must never rewrite past learning truth.
- 选择/导航/暂停/结束不制造作答；draft不完成；估计不是事实。
- 同输入同输出，不改输入，所有选择可解释，跨source/lane去重。
- 缺预算照常运行；预算累计扣减；新词按日累计；停止不欠债。
- 未支持activity不启动；未知证据明确未知。

| 场景 | 预期 |
| --- | --- |
| 今天10分钟 | 小块高价值review/weak；剩余能放下才给最多3新词，不塞长阅读 |
| 今天25分钟 | review→new→weak；新词最多8，预算不足收束 |
| 今天45/60分钟 | 可插完整阅读/变换活动，25分钟左右休息；没有执行器不造任务 |
| 今天90分钟以上 | 多block与休息，新词默认仍≤20；无合适候选可提前自然结束 |
| 没告诉时间 | 直接4–6分钟block，逐块重算，无虚构60分钟倒计时 |
| 三天没学再打开 | 小份高价值复习，新词最多5；不补三天债 |
| backlog很高 | 复习优先、有容量上限，保留小步推进，不扩大预算 |
| backlog很低 | 当前词书连续new，不随机错词凑数 |
| 最近学过A篇很多核心词 | 按目标/预算推荐迁移阅读，理由仅为接触证据 |
| 计划60只做18分钟 | 摘要只显示真实结果；次日没有42分钟待补 |
| 多来源同词/同事件 | 合并引用，仅选一次，镜像不双算 |
| AI不确定Q3是否词汇错 | 保存推断，给小诊断，不改历史wrongCount |

## 13. 交接顺序

先core fixtures→owner-safe adapter→独立执行上下文/恢复/停止→Today一个入口→Cloud learningIntent窄协议→一篇可信阅读及反向诊断→再扩题库和FSRS。
本批不硬接Today：旧整章completion语义必须先解决，不能用错误glue code假装上线。

## 14. 本批实现与验证命令

实现范围：types.ts与planner.ts（next-block纯函数），reading仅接收未来推荐器的有序候选并检查执行能力/预算。未实现adapter、reading recommender、scheduler持久化、Coach JSON runtime validator、Today/typing glue。

轻量回归：Node 22.6+运行 node --experimental-strip-types scripts/check-smart-session.mjs。当前环境Node24运行16组通过；现有CI使用Node22并已加入同一命令。不引入测试框架。独立strict typecheck已通过；完整lint/type/build因依赖下载未完成，见STATUS。

core的candidate池须已由adapter校验归属/内容与来源，不能把MCP任意JSON直接断言成SmartSessionInput。跨来源相同canonical key合并UUID；冲突事实/冲突schedule会拒绝，交给adapter诊断而不是默默篡改。

## Next-generation extension: semantic_recall

elastic-v2 retains vocabulary selection and adds one separately typed SemanticCandidate lane. Candidates require an actual spelling observation plus a nonempty reference; this prerequisite means prior exposure, never semantic competence. Semantic evidence/keys do not merge with spelling evidence/keys. Max six words, budget reserve and hard-stop apply, completed keys cannot repeat in the same session. Balanced sessions may interleave after a spelling block; explicit semantic intent is preferred when available. No candidate means no invented activity. Vocabulary-only input retains its previous selection behavior.

Provider work is bounded to 120 observed candidates, oldest semantic observation first. This is a bounded candidate view, not the full backlog. Raw definitions are frozen in a dedicated local run with exact content hash; no live content mutation during execution. Semantic persistence is distinct from legacy review/chapter records. Target estimates stay estimates. Long-term Reading stage gates are unchanged.
