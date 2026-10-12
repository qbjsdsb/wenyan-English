# Wenyan Visual Quality System · 2026-10-13

> 这不是新的视觉主题，而是当前生产界面的质量标准。目标是让所有页面在长时间使用中保持安静、精确、舒服，并在不同功能密度下仍然具有同一种 Wenyan 气质。

## 1. 目标感受

第一眼：一个清楚、可靠、没有多余动作的学习工具。

使用十分钟：当前任务始终是最清楚的东西，工具和状态不会抢注意力。

使用数小时：排版、边界、暗色和反馈不会造成疲劳。

使用数月：不会因为流行 UI 元素过时而显得陈旧。

## 2. 核心原则

### Content wins

每个 viewport 只允许一个主要视觉对象。Today 是下一段学习，Typing 是单词，语义专项是当前题面，Reading 是文章，Index 页面是可扫描的数据本身。

### Structure before surface

优先使用对齐、间距、字重和细线形成结构。只有真正需要浮起的工具才使用 surface depth。普通内容不因为“需要分组”就自动获得圆角卡片。

### One event, one signal

同一个状态变化尽量只使用一个主要视觉信号。正确、错误、选中、保存完成不能同时叠加色块、边框、阴影、位移和动画。

### Light happens, ink remains

微光属于认知变化发生的瞬间。正确输入、完成、保存等可以短暂改变明度或色调，随后稳定回普通墨色。页面本身不长期发光。

### Quiet by default

Rest 是绝大多数时间的默认状态。hover、focus、selected、loading 只有在用户需要时才增加对比。

## 3. 五类空间

### Desk

Today。中等密度，当前任务最强，数据和快捷入口退后。禁止做成 KPI dashboard。

### Focus

Typing、词义回想、选择词义、看义写词。低 chrome、高留白、当前认知对象绝对优先。反馈像校订，不像游戏奖励。

### Folio

Reading 与未来文学阅读。正文优先，工具可退场；考试题目与文学批注可以使用不同结构，但共享排版和交互物理。

### Index

词库、记录、错词、未来人物/作品/概念索引。允许高密度，依靠细线、基线、缩进、数字和搜索建立秩序，不追求大留白。

### Utility

同步、学习阶段、OAuth、设置、移动端说明。使用稳定的 utility sheet grammar：标题、必要说明、分组行、状态、操作。正常状态不需要成功色块。

## 4. Typography

- UI 主体尽量保持同一 Sans 家族，避免靠频繁换字体制造层级。
- 阅读正文使用 Serif；工具、批注和 metadata 保持 Sans。
- Mono 只用于单词输入、键盘数据、精确数字等真正需要等宽节奏的对象。
- 普通 metadata 原则上不低于 11px；10px 只允许极短刻度或特殊图表标签，不进入主要操作路径。
- 数字统计使用 tabular numbers；普通正文数字保持自然宽度。
- 中文、英文、数字混排优先依赖浏览器排版能力和稳定间距，不手工到处塞视觉空格。

## 5. Material hierarchy

只保留三层：

1. Paper：页面和稳定内容，0 elevation。
2. Tool：临时可操作 surface，只允许极轻边界 / 阴影。
3. Modal：真正覆盖上下文的 dialog，允许明确 elevation。

普通 section、统计、列表、空状态原则上不因为分组需要而获得完整卡片材质。

## 6. Color

- Paper / Ink 承担绝大多数界面。
- Accent 只用于主操作、当前选择、进度和短暂认知反馈。
- Success / Danger 只在结果或风险真正需要区分时出现，不作为装饰色。
- 暗色模式主要依赖 surface luminance 和细边界，不依赖深阴影或蓝色 glow。

## 7. Motion

保留：

- 正确 / 错误输入反馈；
- progress；
- dialog / disclosure 的真实状态变化；
- 必要的 loading indicator。

删除或避免：

- 页面纯出现动画；
- 搜索结果为了漂亮而淡入；
- 报告 stagger；
- 星点、aurora、halo、扫光；
- 无语义的 bounce / shake。

高频 motion 目标约 120–220ms，完成状态可以稍慢，但必须很快重新安静。

## 8. State grammar

- Top nav / tabs：文字 + 单一 underline。
- Segmented choice / chip：轻 paper tone 或轻边界，不再叠多重信号。
- Current row：单侧 ink mark / subtle tone。
- Correct / Wrong：细边线或文本校订 + 必要文案。
- Primary action：稳定 filled control，每个工作区尽量只出现一个。
- Focus visible：统一 outline，不能靠颜色状态猜键盘焦点。

## 9. Page-specific quality bar

### Today

Smart Session 是第一视觉锚点。专项、当前词书、今日记录都只能作为辅助。不要放大数字做 dashboard。

### Typing

核心学习区已经稳定，只做毫米级调整。正确输入短暂 settle，错误使用暖墨 + underline，不增加装饰光效。

### Semantic practice

当前题面、输入/选择和校订必须形成单一阅读顺序。不要把反馈做成独立结果卡。

### Records

像证据档案，不像 analytics dashboard。数字可以大，但容器不能比数据本身更抢眼。

### Gallery / ErrorBook

属于 Index family。密度可以高，列表和表格优先使用边线、对齐和 hover row，不使用大卡片墙。

### Sync / Preferences

属于 Utility family。稳定、机械、可靠。正常同步不需要庆祝；风险与异常才提高对比。

### OAuth

授权信息必须清楚、可信、克制。Client、权限、只读边界是主角，不用“安全感装饰”。

### Mobile

这是一张说明页，不应像营销落地页。保持短、稳定、明确。

## 10. Acceptance checklist

每次 UI 修改至少人工检查：

- 浅色 / 暗色；
- 1440px 常规桌面；
- 900px 左右分屏；
- 760px header 切换点；
- keyboard focus；
- hover / active / selected；
- loading / empty / error；
- reduced motion；
- 去掉颜色后，层级是否仍然成立；
- 页面是否存在两个以上同时争夺注意力的主操作。

判断标准不是“截图够不够漂亮”，而是：同一个页面使用半小时之后，是否仍然安静、明确、没有视觉疲劳。
