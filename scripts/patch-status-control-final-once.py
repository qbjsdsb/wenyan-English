from pathlib import Path

path = Path('docs/STATUS.md')
text = path.read_text()
old = "- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；command tool 名称、capability 与 payload shape 保持兼容；executing command 不再自动重排，硬 TTL 到期后 `get_action_status` 返回 `effectiveStatus=expired`，且数据库拒绝 late finish；同一 active Cloud Plan task 的重试复用相同未完成 run，避免恢复路径制造重复 task run；"
new = "- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；command tool 名称、capability 与 payload shape 保持兼容；executing command 不再自动重排，硬 TTL 到期后 `get_action_status` 返回 `effectiveStatus=expired`，且数据库拒绝 late finish；显式重新发起学习任务仍保留原有 fresh-run 语义；"
assert old in text
path.write_text(text.replace(old, new, 1))
