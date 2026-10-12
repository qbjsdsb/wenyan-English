# Wenyan Interface Audit · 2026-10-13

> 目标不是再做一轮视觉换皮，而是把已经上线的 Wenyan 收成一个长期耐用、安静、精确、具有自身性格的学习工作区。

## 0. 审计基线

- PR #89 已 squash merge 到 `main`。
- 当前 UI 生产基线：`a31a79eee0fef012acbd0adb1f1f2a634c61d14e`。
- PR #89 最终 CI：`38293529135` success。
- 合并后的 main CI：`38294313784` success。
- 合并后的 Pages deploy：`38294313622` success。
- 本轮审计不改变 Learning Fact、Dexie schema、owner isolation、Cloud Plan / MCP / Smart Session contract 或 Edge Function。

## 1. 最终视觉判断

Wenyan 已经不需要重新设计。现在真正需要的是 **coherence / craft pass**：把视觉规则、信息权重、交互反馈和页面节奏变得像同一套成熟工具，而不是继续增加设计元素。

核心设计法则继续保持：

- **Paper holds**：页面是稳定工作面，不靠纸纹、暖黄、阴影和卡片去证明“纸”。
- **Ink remembers**：稳定知识、记录、结果最终都回到普通墨色。
- **Light happens**：微光只属于认知发生的一瞬，不成为背景装饰或持续状态。
- **One event, one signal**：一次认知事件尽量只改变一个主要视觉变量，不同时叠加颜色、缩放、光晕、位移和粒子。
- **Content wins**：当前要读、要想、要输入的对象必须始终拥有最高视觉权力。
- **Different spaces may look different**：Today、Focus、Reading、Index 不必套同一种卡片模板；统一来自字体、间距、边线、墨色和运动物理。

一句话目标：

> 第一眼只是一个异常舒服、精确的学习工具；使用几天后才感觉到它会非常轻地回应注意力。

## 2. 研究校准

本轮继续用成熟生产工具而不是“学习 App 视觉趋势”校准判断：

- iA Writer Focus Mode：通过降低周围内容对比度突出当前句 / 段，而不是给焦点对象增加强光。
- Things Slim Mode：在专注和分屏场景主动撤走导航，把空间还给当前任务。
- Linear 2026 UI refresh：降低导航权重，让主工作区更突出，并统一跨页面 header / controls。
- Readwise Reader：长阅读模式减少操作性 UI；宽屏注释自然进入右侧 margin；字号、行距、行宽是独立阅读参数。
- Raycast：用少量稳定空间原型（List / Detail / Form）和一致快捷键建立成熟感，而不是为每个功能造新组件。
- Apple HIG：动效应短、精确、有目的；高频交互不应反复要求用户注意动画；排版层级首先靠字号、字重和颜色；不要让“delight”变成装饰。

这些参考不是要复制外观，只用于判断 Wenyan 哪些设计应该留下、哪些应该退场。

## 3. 系统级问题，优先级高于单页美化

### P0 · CSS 视觉真相仍然分散

当前视觉结果由 `index.css` → `wenyan.css` → `composition-polish.css` → `delight-polish.css` → `experience-polish.css` → `responsive-polish.css` 叠加形成。多个 selector 在后层覆盖前层，例如 focus surface、dark shadow、practice controls。

短期没有功能问题，但它是下一阶段最大的协调风险：后续改一个 token 或基础组件，很容易被另一层历史 override 悄悄改回去。

**方向：** 不做大重构，逐步把“已经稳定的最终规则”上移到一个明确的视觉 source of truth；polish 文件只保留真正属于页面组合、interaction 和 responsive 的规则。

### P0 · 动效仍有一层“页面在表演”

PR #89 已删除星点、halo、bloom 和同步呼吸光，但仍存在：

- 全页面 `wenyan-page-arrive` opacity entrance；
- report section entrance；
- Reading 提交后逐题 stagger reveal；
- 部分 auth / library arrival。

单看都很轻，但高频使用后会形成“每个界面都要表演一下”的感觉。

**方向：** 保留真正表达状态变化的动效，删除纯出现动画。优先保留：正确 / 错误反馈、progress、dialog、真实展开收起；优先删除：page entrance、报表 stagger、阅读逐题 stagger。

### P0 · 小字号需要建立下限

当前少量 9–10px metadata / shortcut 仍存在。它们在截图里显得精巧，但长期桌面使用容易变成“设计师式小字”，尤其中文比拉丁字母更吃像素。

**方向：** 正文 / 控件辅助信息以 12–13px 为常态；真正 tertiary metadata 原则上不低于 11px；10px 只给极短数字 / shortcut mark，9px 退出主界面。

### P1 · selection grammar 还没有完全统一

目前不同 selected 状态分别使用 underline、accent-soft background、border、text color、shadow 等组合。

**方向：** 按组件语义固定一种主要信号：

- top navigation / tabs：文字 + underline；
- chip / segmented choice：纸面明度或轻边界；
- current row：单侧 ink mark / subtle tone；
- correctness：correct / wrong 各只保留一个主信号 + 必要文字；
- primary action：唯一稳定 filled control。

## 4. 页面级审计

### Today / Desk

**当前优点：** Smart Session 已经是真正第一视觉锚点；专项入口、当前词书和今日数据被收进同一工作阶段，逻辑清晰。

**还可以精修：**

1. Smart Session 左上“小圆点 + accent + 现在适合做”仍稍像状态 badge。可研究改为纯 typographic kicker，减少一个彩色符号。
2. 主卡下面的专项 / 当前词书 / 今日统计已经接近工作台，但仍有“完整卡片组件”感。下一步只调边界和节奏，不拆结构。
3. 今日统计更适合像 margin metadata，而不是四个并列 KPI。避免继续放大数字。
4. 任务区如果长期很少有计划，应进一步降低视觉权力；有计划时再自然上升。

**结论：** Today 不重构，只做 5–10% 的层级收束。

### Typing / Focus

**当前优点：** 学习时已经主动撤掉完整 Header，词本身仍是视觉中心，这是整站最正确的空间之一。

**还可以精修：**

1. 非学习态 setup bar 仍有一点“浮动设置条”感；可改成更接近页面中的 control strip，进一步减轻 shadow。
2. 学习态顶部信息较密：词书、章节 / 模式、进度、词表、暂停 / 开始、跳过都挤在一条线。可按“总是可见 / hover-or-keyboard 才出现”分层，但必须保持键盘可发现性。
3. 正确输入继续使用 accent→ink 的短暂 settle；不要增加字母星点或背景光。
4. 错误反馈可只保留色调 + underline，研究删除 0.5px 位移，避免文字亚像素模糊。
5. 完成页继续维持一个主下一步，不再增加庆祝动画。

**结论：** Typing 只允许微调，不允许重新排学习核心。

### Practice / 专项

**当前优点：** 四种 measurement 已经并列清楚，范围、数量、预览和开始动作在一张连续 desk 上。

**还可以精修：**

1. 快捷键提示和部分 kicker 仍过小；统一到新的 metadata 下限。
2. 四个 mode tab 同时含 icon、title、hint、shortcut，信息略满。保留 title + hint，icon 应更低权重，不让四个 pictogram 先于文字跳出来。
3. pool / count 的 selected 状态与 tab 不同是合理的，但要遵守固定 grammar，不再同时 border + tinted bg + accent text。
4. “怎么选？”是帮助，不应参与主流程视觉；保持折叠是正确的。

**结论：** 这是 typography / state grammar 的重点页，不需要新结构。

### Semantic Recall / 词义回想

**当前优点：** PR #89 后已从浮动大卡片变成连续 work surface，明显更成熟。

**还可以精修：**

1. `已保存。` 这类瞬态状态不应长期占顶部一行，可更接近 progress 或自动淡回普通状态。
2. 完成后“再做一小段选择词义”仍是 work surface 内的一张小 bordered card，可改成普通 next-action row。
3. 三个自评按钮必须维持完全等权，hover 不应让其中任何一个看起来像“更好的答案”。
4. 当前 word 与 meaning 的垂直间距可以再精确调到“先思考、后揭示”的节奏，而不是表单节奏。

### Semantic Check / 选择词义

这是当前最值得继续精修的 Focus 页面之一。

**主要问题：** 反馈页仍有明显“quiz UI”气质：四个 rounded bordered blocks，再叠 success / danger 色和文字标签。

**方向：** 从“结果卡片”改成“墨迹校正”：

- 选中的错误项只留下一个轻微错误标记；
- 正确项用单侧 rule / 更明确字重；
- 少用整块绿色 / 红色背景；
- `选对了 / 这次选错了` 与答案行不要同时承担同一种状态信息。

这样 correctness 会更像 Wenyan，而不是任何题库 App。

### Semantic Production / 看义写词

这是目前最有潜力成为 Wenyan 标志性界面的页面。

**方向：**

1. 输入框可以从标准 rounded form control 进一步演化成 Focus 专用的“写在纸面上”输入线 / quiet field，但要保留清晰 focus 与可点击区域。
2. 错误反馈不必同时出现大 danger 句子 + 大参考词头。可以把用户输入当作旧墨，把参考词头作为一次清晰 correction，减少表单 validation 感。
3. “只按当前词书的参考词头判分”继续保留，但视觉降级为 epistemic note。

### Records / Index

**当前优点：** 已去掉重复日历，输入细节默认收起；结构比过去清楚很多。

**还可以精修：**

1. 最近 7 天 summary 仍略像 KPI card；可继续朝 archive / index 方向靠，更多使用对齐、行列、hairline，而不是 surface。
2. charts 只在展开后建立是正确的；不要让图表成为主页审美主角。
3. 数据页适合更密、更理性，不需要和 Focus 页面长得一样。
4. 错词详情 modal 已有 `bg-black/30 + 2px backdrop blur`；背景页面无需再额外 opacity dim。本次 post-merge audit 已在独立分支删除无效的 `opacity-55` 双重 dim 逻辑。

### Library / Index

**当前优点：** 左侧分类 + 右侧资源列表已经形成真正的 Index 空间；搜索 / 语言工具 sticky 后长列表体验更完整。

**还可以精修：**

1. 列表项应该靠 typography、row height、indentation、separator 建层级，不再增加 card。
2. sticky toolbar 与双层 Header 的 `top:112px` 目前是 magic number。后续应收成共享 layout variable，防止 header 微调后错位。
3. 搜索结果 arrival animation 可删除，搜索本身已经是足够明确的状态变化。

### Sync / Utility

**主要问题：** 仍是全站最像“后台设置页”的页面之一：一个大 rounded panel 内含账号、三列统计、记录同步、学习位置。

**方向：** 改成更机械、可靠的 utility sheet：

- 外层不必是大 card；
- account / queue / record sync / workspace 使用 divider-separated rows；
- `待上传 / 未归属 / 其他账号` 从小 KPI 变成 compact metadata；
- 重要异常才使用 danger；正常同步成功只是文字状态，不做庆祝。

### Learning Stage / Preferences

这是当前最需要“删”的页面。

当前同时存在：

- 当前阶段 card；
- 三节点路径图；
- 又一组阶段 option rows；
- 两个尚未开放阶段。

在只有 `vocabulary` 真正可执行时，这些内容重复表达同一件事，并让产品显得像在展示 roadmap。

**方向：** 先收成：当前阶段 + 简短解释 + 一个真正可执行的 control。未开放阶段放进低权重“以后可用的阶段”说明；等 Reading Loop 真的稳定再把 mixed 提升为正式 choice。

### Reading / Folio + Exam

当前 Reading 对考试训练是合理的：文章左、题目右、一次提交、底部固定 action。

但它不能直接成为未来文学阅读的模板。

**考试 Reading 下一步：**

1. 提交后逐题 stagger reveal 删除，答案一起稳定出现。
2. selected / correct / wrong option 减少背景色与 border 的重复信号。
3. 研究“专注文章”切换：宽屏时可临时隐藏题目栏，让正文成为唯一主体，再恢复题目。
4. 保持 source / time / question count 这种 instrument metadata。

**未来 Folio：** 另建阅读空间：正文绝对主角，注释 / 词汇 / 关联知识进入临时 margin，不常驻 360px 题目栏。

## 5. 交互与“微光”最终语法

推荐把下一阶段所有 interaction review 都套进下面的表：

| 事件 | 主信号 | 不再使用 |
| --- | --- | --- |
| hover | tone / ink contrast | glow、scale |
| keyboard focus | 统一 outline | halo |
| 正确输入 | accent → ink | 星点、背景 bloom |
| 错误输入 | underline / slight warm ink | shake、red glow |
| 选择 | underline 或 local tone | 同时 border + fill + glow |
| 保存完成 | 状态文字 settle | toast celebration |
| modal 打开 | overlay + 轻 transition | 背景再降 opacity |
| 页面切换 | 尽量静态 | page entrance animation |
| 内容展开 | 真实空间变化 | staged fade sequence |

## 6. 推荐实施顺序

不要一次改全站。下一轮建议四个小批次，每批都可单独回滚：

### Batch A · Visual system consolidation

- 清理 dead legacy gradient / typewriter animation；
- 删除纯 appearance motion；
- 明确 metadata 字号下限；
- 收拢 duplicated selector / override；
- 建 header-height / sticky-offset shared variable。

### Batch B · Focus craft

- Semantic Check feedback；
- Semantic Production input / correction；
- Recall completion next-action；
- Typing wrong-letter feedback 与 setup strip。

### Batch C · Utility / Index craft

- Preferences 去重；
- Sync 去大卡；
- Records summary 降 KPI 感；
- Library sticky offset / list typography。

### Batch D · Reading craft

- 删除 stagger reveal；
- 收正确 / 错误选择语法；
- article-focus toggle；
- 为以后 Folio 明确和 exam Reading 分开的 layout contract。

## 7. 明确不做

- 不重新换主题 / 配色；
- 不做大面积 glow、gradient、noise、glass；
- 不为“高级感”增加 serif 大标题；
- 不把每个 section 变成卡片；
- 不把所有页面强行做成相同模板；
- 不把文学功能提前画成不可用占位模块；
- 不因为视觉重构触碰学习事实、AI 策略和云同步边界。

## 8. 完成标准

这一轮真正完成，不是“截图更漂亮”，而是满足：

1. 任意页面隐藏 Logo 后仍能看出相同排版和 interaction grammar；
2. Focus 模式里 1 秒内能看出唯一认知对象；
3. Index 页面可以更密，但不显得后台化；
4. 任何颜色变化都有语义；
5. 任何动画都能回答“它在解释什么状态变化？”；
6. 窄桌面、分屏、暗色、键盘操作和 reduced-motion 都不降级；
7. 删除一个视觉元素时，产品通常变得更好，而不是更空。
