# Wenyan Final Product Craft Audit · 2026-10-13

本轮不是新的视觉重构，而是在 Visual Quality System 已经稳定之后做最后一圈真实使用工艺检查。重点检查键盘、输入法、分屏宽度、sticky 层级和页面状态是否仍遵守 Wenyan 的同一套交互物理。

## 已确认并修复

### 1. 词库分屏 sticky 层级

词库顶部语言 / 搜索工具条会 sticky；左侧分类导航此前仍使用固定 `top: 5.5rem`。在桌面窄窗尤其 760–900px，Header / toolbar 高度变化后，分类导航可能滑到 sticky 工具条下方，产生视觉叠层。

现在：

- 宽桌面分类导航依据共享 `--wenyan-sticky-offset` 定位，并为顶部词库工具条留出明确空间；
- 900px 以下不再强行 sticky 分类导航，让它随文档自然滚动，避免工具条换行时出现无法可靠预估的高度冲突；
- 760px 双层 Header 同步更新 `--wenyan-header-height`，避免共享布局变量与真实 chrome 高度分裂。

这属于“结构应该被感觉到，而不是看见”的修复，没有新增 surface、阴影或动画。

### 2. 看义写词的中文输入法安全

看义写词使用原生 `<form>` 的 Enter 提交。全局键盘处理已经尊重 `event.isComposing`，但表单提交本身此前没有 composition guard。在中文输入法处于候选确认状态时，Enter 理论上可能同时触发表单提交，造成意外保存。

现在：

- 显式记录 `compositionstart / compositionend`；
- composition 期间 `submit()` fail closed；
- form submit 同样检查 composition 状态。

不改变判分、Learning Fact、Semantic Production measurement 或正常英文 Enter 提交体验。

## 本轮刻意没有继续改的地方

- Today / Typing / Semantic / Reading 的主体排版已经进入毫米级阶段，不再为了“更高级”重新布局；
- 没有增加 glow、粒子、玻璃、渐变卡片或新的 motion layer；
- 没有继续给 CSS 增加新的 polish 文件；
- 没有修改 Dexie、Learning Fact、Smart Session、Coaching、MCP、Supabase 或 OAuth capability。

## 后续仍值得真实使用观察

1. 641–900px 词库长列表滚动时，分类导航改为随文档滚动后是否仍足够顺手；如果确实需要持续可见，再基于真实 toolbar 高度做结构性 sticky，而不是猜 magic number。
2. 中文 IME 在 Windows / macOS 不同浏览器中的 Enter 行为；当前实现按 composition 状态 fail closed。
3. Reading 专注文章模式在长文章中的恢复位置与键盘路径。
4. 暗色模式连续使用时，modal 与普通 surface 的深度差是否仍然足够但不过重。
5. 真实日常使用中只接受可复现的小问题，不再开启新的视觉主题探索。

## 质量判断

当前 UI 的主要风险已经从“视觉方向不统一”转为“边缘交互有没有漏缝”。继续提高品质应该依赖真实使用证据和小步修复，而不是添加更多设计元素。
