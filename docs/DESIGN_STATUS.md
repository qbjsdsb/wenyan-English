# Wenyan Design Architecture status

更新：2026-10-13。

本页只记录 `design/mature-html-prototypes` 分支的视觉实验，不代表生产 `main` 已迁移。

## 已完成

- 新增 `docs/DESIGN_CONSTITUTION_V1.md`，将 Luminous Paper 从视觉主题收束为 Paper / Ink / Light / Rhythm 的设计合同。
- 固化四个工作空间：Desk / Focus / Folio / Index。
- 固化 4px micro / 8px macro rhythm、83 / 167 / 250ms motion physics、Chrome Budget、Line Budget、One Event One Change。
- 明确拒绝 card wall、decorative glow、stardust、aurora、button shine、巨型 landing typography。
- 重做 `design-prototypes/mature-ui/today.html` 为 Desk 母版。
- 新增 `focus.html`，用于词义回想与 Attention → Cognition → Settlement 交互验证。
- 重做 `reading.html` 为 Folio manuscript grid，margin note 与正文处于同一 Paper 平面。
- 新增 `index.html`，验证高密度词库/知识索引界面。
- `vocab.html` 仅保留为旧路径到 `focus.html` 的兼容跳转。
- 统一原型使用一个 `styles.css`，没有新增 polish stylesheet。

## 未触碰

- 未修改生产 React 页面。
- 未修改学习事实、Dexie、Supabase、MCP、Smart Session 或 Reading Loop 行为。
- 未合并到 `main`，未触发生产发布。

## 当前判断

四个母版故意保持不同密度：Desk 中密度、Focus 极低密度、Folio 低中密度、Index 高密度。统一性来自共享 rhythm、Ink 层级、leadspace、材质与 motion physics，而不是共享同一页面模板。

## 下一步

1. 先人工审查四母版，优先 Focus 的长期学习舒适度。
2. 真实实现前补齐 keyboard / IME 行为合同和 reduced-motion 对等状态。
3. 若母版方向确认，再从 Focus 开始小批量迁移生产 UI；不要全站一次性换皮。
4. 迁移时优先删除旧视觉层，而不是继续叠加新的 `*-polish.css`。
