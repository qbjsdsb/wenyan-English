from pathlib import Path

path = Path('docs/STATUS.md')
text = path.read_text()
old = "- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；generic command-bus / MCP-OAuth RPC 保持不变；"
new = "- migration `20261011_000028_control_runtime_owner_binding.sql` **尚未应用生产**；command tool 名称、capability 与 payload shape 保持兼容；`get_action_status` 仅补强 expired executing 的 `effectiveStatus=expired`，同 owner/device 轮询会在 120 秒租约后把仍未过期的 abandoned claim 重新排队；"
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)
