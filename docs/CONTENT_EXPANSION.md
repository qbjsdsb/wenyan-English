# 内容接入与下一阶段 · 2026-10-13

本轮承接 PR #97 分支；不合并、不部署、不跑测试。已实现的代码和待做能力分别记录，不把题库文件的存在等同于可用功能。

## 当前交付

- `/reading` 是独立题库入口，支持 Wenyan Reading Pack v1 JSON 的预览、导入、搜索、年份/英一英二筛选、导出及示例下载。
- 每篇按 `(owner, passageId, version)` 保存。相同内容重复导入跳过；同一版本修改题干、选项或答案会使整批导入回滚。修订应增加内容版本。
- `/reading/:contentId?v=...` 固定打开对应版本；本机刷新能恢复该版本未提交草稿。完成记录保留 passageVersion。
- 新增 Dexie v10 `readingPassages`；题库正文仅在本机当前账号范围内，匿名资料不自动归入登录账号。可导出匿名题包后在目标账号显式导入。
- 完整数据库备份会包含题库；题库单独导出不含个人作答。超过单包限制自动分包，逐个下载。
- 未同步私人正文到 Supabase；另一台电脑需要导入同样版本题包。学习事实仍沿用既有同步协议，不附文章正文。
- 导入不会升级学习阶段，不生成完成事实，不把私人内容自动加入 Smart Session 候选池。

## Reading Pack v1

页面“下载示例题包”提供可直接改写的结构，外层是：

```json
{
  "format": "wenyan-reading-pack",
  "schemaVersion": 1,
  "title": "2020 英语一 · 阅读",
  "passages": []
}
```

上面的空数组仅用于说明结构，正式包需 1–200 篇且小于 8 MiB。
每篇完整字段参见 `src/reading/types.ts`、`src/reading/pack.ts`。
必需：id、version、title、source.label、paragraphs、estimatedMinutes、questions。
每道题：id、type=single_choice、stem、options[{id,text}]、correctOptionId；可有 explanation。
可选 exam={paper:english-1|english-2,year}；source 可记录 reference / license / revision。

当前内容只渲染纯文本，不支持 HTML、图片题、表格题、音频。导入解析器将 source.kind 设为 private-import，推荐资格固定 false。题包中的推荐标志、AI 标签、未经支持的扩展字段不会变成学习证据。

## 首个来源：ESQ

已读取并检查：

- 仓库：https://github.com/wssfk12138/english-multiple-choice-practice-machine
- 检查 commit：`9bff34a4a83330bb44afe25bd06230ee61afc3c8`
- 结构：`docs/question-bank-format.md`、`examples/demo-bank/`。
- 题源：`examples/bundled-banks/postgraduate-english-one.esq`。
- 本次实际读取该英一包 manifest：18 个 paper entries（2002、2010–2026），contentVersion 1.1.0。这里只确认容器元信息和一份样本的字段，不声明全部答案已经校对。
- NOTICE 明确代码 GPL-3.0-only 与内容许可分开；英一包 license=NOASSERTION，声明仅在已获授权的个人或局域网范围内使用。公开仓库不复制整套正文。
- 原创 demo 声明 CC0，但其样例含 table；当前转换器会整篇跳过，不静默丢掉表格再当完整题使用。

转换器 `scripts/convert-esq-reading.py` 是本项目独立实现，没有复制上游应用代码，不访问网络、不安装依赖、不改源包：

```bash
python scripts/convert-esq-reading.py /path/to/english-one.esq /path/to/new-output \
  --paper english-1 \
  --source-url https://github.com/wssfk12138/english-multiple-choice-practice-machine \
  --source-revision 9bff34a4a83330bb44afe25bd06230ee61afc3c8 \
  --year 2020
```

不传 --year 则转换包内全部年份；完成后把逐年 JSON 导入阅读题库，conversion-report.json 是转换报告，不是题包。
仅接 `reading / reading_a` + 单选 + 完整标准答案。完形、新题型、多媒体、缺答案内容逐项记录跳过原因；不借转换生成或猜测答案。忽略源包 AI 标签，避免当作正式解析或错误归因。
来源 URL 应保持稳定；revision 记录实际 Git commit。篇目 ID 来自来源 URL + unitKey，版本来自正文/题目/答案内容哈希，重排导入顺序不改变身份。
预计 18 分钟是暂定展示值，不是用户实际速度，也不参与自动安排。
本轮按用户要求未执行转换器或测试，不宣称已生产导入整套真题。

## 其他 GitHub 候选

| 来源 | 本次观察 | 后续用途 |
| --- | --- | --- |
| https://github.com/YLXDXX/EN201-kaoyan | LaTeX 原文、PDF；README 提醒可能存在文字错误 | ESQ 缺年份时的文本比对候选 |
| https://github.com/pfoocc/201_204_kaoyan | 英一/英二完形阅读；明确标记未校对 | 只能作为候选，不能直接标成已验证答案 |
| https://github.com/ShawnYou1/english-zhenti-online | 当前页面主要是说明、截图与外站入口 | 不把展示站误当可直接导入的开源题库 |

候选观察来自 2026-10-13 GitHub 页面；除 ESQ 外未完成本地全库检查，不锁定内容范围或可再分发许可。

## 下一批英语：按题型完成，不做空入口

1. **阅读正式闭环**：提交幂等、刷新复盘、按题错题复习、原文定位。现在 submitted summary 只在页面内；不要声称刷新已能恢复复盘。
2. **完形**：正文空号与问题一一关联、整篇提交。可以复用选项组件，但记录独立活动类型；不能把 cloze 冒充 reading_completed。
3. **新题型**：分别实现段落匹配、排序、选句。选项池共享和复用约束依题型定义，不能当成若干独立四选一。
4. **翻译与写作**：保存用户原答、开始/提交时间、参考答案版本；用户自评和 AI 反馈单列，不能生成虚构客观分数。AI 评语不能改写用户原答。
5. **整卷训练**：各活动都稳定后再加整卷计时/答题卡/分值，不先建空试卷框架。
6. 每引入新 activity，必须一起更新本地事件解析、同步接收、服务端允许类型、MCP 证据解释。内容可以先导入，能力未接通前不伪装成可执行任务。

## 文学：等用户提供购买后处理的资料

课程稳定键：

| 课程 | subject key | 内容组织 |
| --- | --- | --- |
| 中国古代文学 | chinese_ancient_literature | 时代 → 作家/作品/文体 |
| 中国现当代文学 | chinese_modern_contemporary_literature | 现代/当代 → 时期 → 作家/作品/思潮 |
| 外国文学 | foreign_literature | 地域/时代 → 作家/作品/流派 |
| 文学理论 | literary_theory | 范畴 → 观点 → 理论家/著作 |

这些是下一版题包的约定，不是已经支持导入的字段。当前 Reading Pack 只接受英语阅读，不提前做文学空页面。

购买资料保留书名、作者/编者、出版社、版次、年份、页码、原件引用、录入/人工核对状态；私有内容不进入公开仓库。内部正文与题目分开，引用版本固定，修订增加版本。

第一批文学只做资料阅读、背诵卡、名词解释、简答、论述。背诵卡区分“看过/自评记住/闭卷作答”；开放题保留原答与参考要点，不把关键词命中或 AI 评价当作掌握率。来源里缺失的信息留空待核对，不补造。

届时先收一小章真实资料，贯通导入→学习→原答保存→复盘→MCP 可读摘要，再批量导入。免登录本地模式继续可用，私有正文跨设备方案需独立实现，不能借学习事件夹带整本书。
