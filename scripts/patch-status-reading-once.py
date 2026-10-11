from pathlib import Path
import re

path = Path('docs/STATUS.md')
text = path.read_text()

old_registry = '''### PR #77：Dictionary registry integrity（最终收口）

#73 的临时 self-patching CI 方案已废弃；#77 从当前生产 `main` 重新建立，只保留最终产品代码与回归保护。

- `/dicts/frequently_used_word02.json` 使用独立稳定 ID `frequently_used_words02`；level 3 保持 `frequently_used_words03`；
- 删除重复的“中国考试 / 其他” `Oxford5000` 注册项，保留同一真实来源的 canonical “国际考试 / 牛津版”条目；
- `idDictionaryMap` 改为 null-prototype registry，并在未来出现重复 ID 时 fail fast，不再静默覆盖；
- focused Playwright 覆盖 duplicate ID、Level 2/3 identity、Oxford 唯一性和 prototype-chain alias；
- PR #77 head `b706ae7…` 的完整 CI run `38125761066`：**success**；
- 当前仅剩 STATUS handoff review finding；修正文档后请求最终 review，再合并并关闭旧 #73。
'''
new_registry = '''### Dictionary registry integrity：已进入主干

- PR #77 已 squash merge 为生产 `main` `6fc0d534…`；旧 #73 已关闭为 superseded；
- `/dicts/frequently_used_word02.json` 使用独立稳定 ID `frequently_used_words02`；level 3 保持 `frequently_used_words03`；
- 重复 Oxford5000 注册项已删除；`idDictionaryMap` 使用 null-prototype registry，并在未来 duplicate ID 时 fail fast；
- focused Playwright 覆盖 duplicate ID、Level 2/3 identity、Oxford 唯一性和 prototype-chain alias；
- 合并后 main CI `38126442220` 与 Pages `38126442230`：**success**。
'''
assert old_registry in text
text = text.replace(old_registry, new_registry, 1)

reading_section = '''### PR #79：Reading route state closure（待合并）

Reading 仍是实验，不新增正式内容/阶段；这里只收口现有页面的状态正确性。

- passage `id:version` 在 SPA 切换时重新读取当前 owner 对应草稿，并重置 timer / answers / summary / busy / error；
- passage 或 owner 每次变化都会递增 attempt generation；旧异步提交即使经历 A→B→A 也不能重新成为 current；
- stale submit 不再覆盖新页面 summary/error/busy，也不会删除同 key 的 replacement draft；
- `tests/e2e/reading-route-state.spec.ts` 挂载真实 ReadingPage，冻结一次 Dexie save，模拟 owner A→B→A 后再释放旧提交，验证旧结果不泄漏且新草稿保留；
- 无数据库 migration、无 learning-event schema 变化、无 recommendation eligibility 变化。

'''
marker = '## 产品真实性\n'
assert marker in text
text = text.replace(marker, reading_section + marker, 1)

old_items = '''1. 完成 #77 最终 review → merge → main / Pages 复验，并关闭旧 #73；
2. 完成 Remote Control captured-owner closure：CI / security review → production 000028 → fail-closed verification → merge，并关闭旧 #76；
3. 修复 Reading 实验在 passage id / version SPA 切换时的草稿、计时和答案状态重置；
4. 现有训练可用率：选择词义扩展到**同词书、真实版本化释义**的有界 distractor pool，不让 AI 编造假释义；
5. Reading 实验：passage id / version 在 SPA 切换时重置对应草稿、计时和答案状态；
'''
new_items = '''1. 完成 #78 Remote Control captured-owner closure：最终 CI / security review → production 000028 → fail-closed verification → merge，并关闭旧 #76；
2. 完成 #80 选择词义 distractor quality：真实版本化释义、可见答案去重、最终 CI / review → merge；
3. Reading 正式主闭环继续后置；#79 只解决现有实验页面的 route / owner / async submission 正确性，不把 Reading 冒充正式阶段；
'''
assert old_items in text
text = text.replace(old_items, new_items, 1)
# Keep numbering monotonically readable for the remaining legacy list.
for old, new in [('6. owner-bound', '4. owner-bound'), ('7. 长期性能', '5. 长期性能'), ('8. 真实用户', '6. 真实用户'), ('9. 自然出现', '7. 自然出现'), ('10. 更高质量', '8. 更高质量')]:
    text = text.replace(old, new, 1)

path.write_text(text)
