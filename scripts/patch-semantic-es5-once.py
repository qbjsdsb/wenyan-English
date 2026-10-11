from pathlib import Path

path = Path('src/semantic/discrimination.ts')
text = path.read_text()
old = """  return [...new Set(normalized)]
    .sort((a, b) => a.localeCompare(b))
"""
new = """  return Array.from(new Set(normalized))
    .sort((a, b) => a.localeCompare(b))
"""
assert old in text
path.write_text(text.replace(old, new, 1))
