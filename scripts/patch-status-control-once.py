from pathlib import Path
import re

path = Path('docs/STATUS.md')
text = path.read_text()

text = text.replace(
    '- 当前生产 `main`：`cf5b5613d07fdac6beee446130a790dce4d8c6c3`（PR #74，Cloud Plan / Learning Preferences captured-owner closure）。',
    '- 当前生产 `main`：`6fc0d534ffbd5af80e53f81f6c90a4310ab1e1ba`（PR #77，Dictionary registry integrity closure）。',
)
text = text.replace(
    '- main CI run `38101964360`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、Chromium 浏览器流程、production Pages build 与 Pages recovery checks 全部通过。',
    '- main CI run `38126442220`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、Chromium 浏览器流程、production Pages build 与 Pages recovery checks 全部通过。',
)
text = text.replace(
    '- GitHub Pages run `38101964361`：**success**，部署源码同为 `cf5b5613…`。',
    '- GitHub Pages run `38126442230`：**success**，部署源码同为 `6fc0d534…`。',
)
needle = '- #74：Cloud Plan browser cache 与 Learning Preferences read / confirm 在 RPC 边界绑定 captured owner；偏好确认同时绑定已加载 snapshot owner；generic MCP/OAuth RPC 保持不变；已合并到生产 main。'
replacement = needle + '\n- #77：内置词书 registry 已收口：超频 level 2/3 使用独立稳定 ID；Oxford5000 仅保留 canonical 注册项；`idDictionaryMap` 为 null-prototype 且 duplicate ID fail fast；focused regression 已进入 CI。'
assert needle in text
text = text.replace(needle, replacement, 1)

registry_section = '''### Dictionary registry integrity：已进入主干

- PR #77 已 squash merge 为生产 `main` `6fc0d534…`；旧 #73 已关闭为 superseded；
- `/dicts/frequently_used_word02.json` 使用独立稳定 ID `frequently_used_words02`；level 3 保持 `frequently_used_words03`；
- 重复的“中国考试 / 其他” `Oxford5000` 注册项已删除，保留同一真实来源的 canonical “国际考试 / 牛津版”条目；
- `idDictionaryMap` 使用 null-prototype registry，并在未来出现重复 ID 时 fail fast，不再静默覆盖；
- focused Playwright 覆盖 duplicate ID、Level 2/3 identity、Oxford 唯一性和 prototype-chain alias；
- PR #77 最终 head `66caade…` 的完整 CI run `38126189959`：**success**；最终 Codex review：**no major issues**；
- 合并后 main CI `38126442220`：**success**；Pages `38126442230`：**success**。

'''
text, count = re.subn(r'### PR #77：Dictionary registry integrity（最终收口）.*?(?=### Remote Control captured-owner closure)', registry_section, text, flags=re.S)
assert count == 1

old_remote = '''### Remote Control captured-owner closure（进行中）

Remote Control 单独从最新生产 `main` 重建收口分支 `fix/control-runtime-closure`，不再叠加旧 #76 分支。

- device ID：`localStorage → sessionStorage → document memory` 降级；localStorage 被阻止时，同一 tab reload 仍保持稳定 ID；
- auth 初始化复用 generation gate，晚到的 `getSession()` 不能覆盖更新的 auth callback；
- heartbeat / pending / claim / finish 使用 owner-bound browser RPC，并携带 captured owner；
- command 在 claim 返回后以及 `start_task` 的异步边界后重新检查 owner + generation；账号切换时 fail closed，不允许 A 的 command 修改 B 的页面状态；
- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；generic command-bus / MCP-OAuth RPC 保持不变；
- 下一步：在 #77 合并后把 control regression 接入最新 CI，完成 Codex/security review → 000028 生产验证/rollout → main / Pages 复验，再关闭旧 #76。
'''
new_remote = '''### PR #78：Remote Control captured-owner closure（进行中）

#78 从已含 #77 的最新生产 `main` 重建；旧 #76 暂不合并，待 #78 完成生产 rollout 后关闭为 superseded。

- device ID：`localStorage → sessionStorage → document memory` 降级；localStorage 被阻止时，同一 tab reload 仍保持稳定 ID；
- auth 初始化复用 generation gate，晚到的 `getSession()` 不能覆盖更新的 auth callback；
- heartbeat / pending / claim / finish 使用 owner-bound browser RPC，并携带 captured owner；
- command 在 claim 返回后以及 `start_task` 的异步边界后重新检查 owner + generation；账号切换时 fail closed，不允许 A 的 command 修改 B 的页面状态；
- cloud `start_task` 在执行前再次要求 plan owner 与 captured owner 一致；底层 `startStudyTask` 仍保留自己的 owner 检查；
- blocked-localStorage 回归覆盖刷新后 device ID 稳定；该 focused regression 已接入 PR CI；
- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；generic command-bus / MCP-OAuth RPC 保持不变；
- 当前下一步：#78 完整 CI + Codex/security review → 000028 生产 preflight / apply / fail-closed verification → 更新本页真实生产结果 → merge → main / Pages 复验 → 关闭旧 #76。
'''
assert old_remote in text
text = text.replace(old_remote, new_remote, 1)

text = text.replace(
    '1. 完成 #77 最终 review → merge → main / Pages 复验，并关闭旧 #73；\n2. 完成 Remote Control captured-owner closure：CI / security review → production 000028 → fail-closed verification → merge，并关闭旧 #76；\n3. 修复 Reading 实验在 passage id / version SPA 切换时的草稿、计时和答案状态重置；',
    '1. 完成 #78 Remote Control closure：CI / security review → production 000028 → fail-closed verification → merge，并关闭旧 #76；\n2. 修复 Reading 实验在 passage id / version SPA 切换时的草稿、计时和答案状态重置；\n3. 提升“选择词义”干扰项质量：只使用真实版本化词书释义，优先选择结构更接近、较不容易一眼排除的选项，同时继续明确 recognition != mastery；',
)

path.write_text(text)
