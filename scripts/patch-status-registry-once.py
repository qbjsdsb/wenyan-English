from pathlib import Path
import re

path = Path('docs/STATUS.md')
text = path.read_text()

text = text.replace(
    '- 当前生产 `main`：`c4235a66b686aecac2d5d23533f94c3c4f7e3ba2`（PR #72，Learning Facts captured-owner binding）。',
    '- 当前生产 `main`：`cf5b5613d07fdac6beee446130a790dce4d8c6c3`（PR #74，Cloud Plan / Learning Preferences captured-owner closure）。',
)
text = text.replace(
    '- main CI run `38098193313`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、Chromium 浏览器流程、production Pages build 与 Pages recovery checks 全部通过。',
    '- main CI run `38101964360`：**success**；lint、TypeScript、Smart Session / Semantic / Coaching / OAuth deterministic checks、MCP packaging、Chromium 浏览器流程、production Pages build 与 Pages recovery checks 全部通过。',
)
text = text.replace(
    '- GitHub Pages run `38098193330`：**success**，部署源码同为 `c4235a66…`。',
    '- GitHub Pages run `38101964361`：**success**，部署源码同为 `cf5b5613…`。',
)
needle = '- #72：Learning Event browser upload / pull 在数据库 RPC 边界绑定 captured owner；启动 auth 初始化有 generation guard；in-flight sync 按 owner 隔离。'
replacement = needle + '\n- #74：Cloud Plan browser cache 与 Learning Preferences read / confirm 在 RPC 边界绑定 captured owner；偏好确认同时绑定已加载 snapshot owner；generic MCP/OAuth RPC 保持不变；已合并到生产 main。'
assert needle in text
text = text.replace(needle, replacement, 1)

open_section = '''### PR #77：Dictionary registry integrity（最终收口）

#73 的临时 self-patching CI 方案已废弃；#77 从当前生产 `main` 重新建立，只保留最终产品代码与回归保护。

- `/dicts/frequently_used_word02.json` 使用独立稳定 ID `frequently_used_words02`；level 3 保持 `frequently_used_words03`；
- 删除重复的“中国考试 / 其他” `Oxford5000` 注册项，保留同一真实来源的 canonical “国际考试 / 牛津版”条目；
- `idDictionaryMap` 改为 null-prototype registry，并在未来出现重复 ID 时 fail fast，不再静默覆盖；
- focused Playwright 覆盖 duplicate ID、Level 2/3 identity、Oxford 唯一性和 prototype-chain alias；
- PR #77 head `b706ae7…` 的完整 CI run `38125761066`：**success**；
- 当前仅剩 STATUS handoff review finding；修正文档后请求最终 review，再合并并关闭旧 #73。

### Remote Control captured-owner closure（进行中）

Remote Control 单独从最新生产 `main` 重建收口分支 `fix/control-runtime-closure`，不再叠加旧 #76 分支。

- device ID：`localStorage → sessionStorage → document memory` 降级；localStorage 被阻止时，同一 tab reload 仍保持稳定 ID；
- auth 初始化复用 generation gate，晚到的 `getSession()` 不能覆盖更新的 auth callback；
- heartbeat / pending / claim / finish 使用 owner-bound browser RPC，并携带 captured owner；
- command 在 claim 返回后以及 `start_task` 的异步边界后重新检查 owner + generation；账号切换时 fail closed，不允许 A 的 command 修改 B 的页面状态；
- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；generic command-bus / MCP-OAuth RPC 保持不变；
- 下一步：在 #77 合并后把 control regression 接入最新 CI，完成 Codex/security review → 000028 生产验证/rollout → main / Pages 复验，再关闭旧 #76。

'''
text, count = re.subn(r'### PR #73：Dictionary registry integrity.*?(?=## 产品真实性)', open_section, text, flags=re.S)
assert count == 1

text = text.replace(
    '1. 完成 #73 词库 registry 实修并让 focused test / 全 CI 转绿；\n2. 完成 #74 review → production 000027 → fail-closed verification → merge → main / Pages 复验；\n3. 审计 Remote Control：auth 初始化 race、device / command captured-owner、localStorage 不可用时 device ID 降级；',
    '1. 完成 #77 最终 review → merge → main / Pages 复验，并关闭旧 #73；\n2. 完成 Remote Control captured-owner closure：CI / security review → production 000028 → fail-closed verification → merge，并关闭旧 #76；\n3. 修复 Reading 实验在 passage id / version SPA 切换时的草稿、计时和答案状态重置；',
)

path.write_text(text)
