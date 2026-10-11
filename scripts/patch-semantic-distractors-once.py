from pathlib import Path

semantic_path = Path('src/semantic/discrimination.ts')
text = semantic_path.read_text()

needle = """function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
"""
replacement = needle + """
function meaningShape(item: SemanticItem) {
  const lengths = item.meanings
    .map((value) => Array.from(value.normalize('NFKC').trim()).length)
    .filter((length) => length > 0)
  return {
    senseCount: lengths.length,
    totalLength: lengths.reduce((total, length) => total + length, 0),
    longestSense: lengths.length ? Math.max(...lengths) : 0,
  }
}

/**
 * Prefer references whose visible answer shape is harder to eliminate at a glance.
 * This deliberately measures only source-text shape, not semantic similarity or POS.
 */
function referenceShapeDistance(cue: SemanticItem, candidate: SemanticItem) {
  const cueShape = meaningShape(cue)
  const candidateShape = meaningShape(candidate)
  return Math.abs(cueShape.senseCount - candidateShape.senseCount) * 10_000
    + Math.abs(cueShape.totalLength - candidateShape.totalLength) * 10
    + Math.abs(cueShape.longestSense - candidateShape.longestSense)
}
"""
assert needle in text
text = text.replace(needle, replacement, 1)

old_sort = """      .sort((a, b) => stableHash(`${cue.contentVersion}:${a.contentId}`) - stableHash(`${cue.contentVersion}:${b.contentId}`)
        || a.contentId.localeCompare(b.contentId))
"""
new_sort = """      .sort((a, b) => referenceShapeDistance(cue, a) - referenceShapeDistance(cue, b)
        || stableHash(`${cue.contentVersion}:${a.contentId}`) - stableHash(`${cue.contentVersion}:${b.contentId}`)
        || a.contentId.localeCompare(b.contentId))
"""
assert old_sort in text
text = text.replace(old_sort, new_sort, 1)
semantic_path.write_text(text)

check_path = Path('scripts/check-semantic.mjs')
check = check_path.read_text()
needle = """assert.deepEqual(buildSemanticDiscriminationQuestions(semanticItems, 4), questions)
const objectivePayload = parseSemanticDiscriminationPayload({
"""
insert = """assert.deepEqual(buildSemanticDiscriminationQuestions(semanticItems, 4), questions)

const shapeVersion = (digit) => `sha256:${digit.repeat(64)}`
const shapeItems = [
  { contentId: 'shape:cue', key: 'shape:cue', contentVersion: shapeVersion('a'), word: 'abandon', meanings: ['放弃', '抛弃'] },
  { contentId: 'shape:near-1', key: 'shape:near-1', contentVersion: shapeVersion('b'), word: 'obtain', meanings: ['得到', '获得'] },
  { contentId: 'shape:near-2', key: 'shape:near-2', contentVersion: shapeVersion('c'), word: 'permit', meanings: ['允许', '准许'] },
  { contentId: 'shape:near-3', key: 'shape:near-3', contentVersion: shapeVersion('d'), word: 'retain', meanings: ['保存', '保留'] },
  { contentId: 'shape:far-1', key: 'shape:far-1', contentVersion: shapeVersion('e'), word: 'verbose', meanings: ['一种非常漫长并且从答案外观就很容易排除的解释'] },
  { contentId: 'shape:far-2', key: 'shape:far-2', contentVersion: shapeVersion('f'), word: 'catalogue', meanings: ['第一种很长的解释', '第二种同样很长的解释', '第三种解释'] },
]
const shapeQuestion = buildSemanticDiscriminationQuestions(shapeItems, 1, ['shape:cue'])[0]
assert.deepEqual(
  new Set(shapeQuestion.options.map((option) => option.contentId)),
  new Set(['shape:cue', 'shape:near-1', 'shape:near-2', 'shape:near-3']),
)
assert.deepEqual(buildSemanticDiscriminationQuestions(shapeItems, 1, ['shape:cue']), [shapeQuestion])

const objectivePayload = parseSemanticDiscriminationPayload({
"""
assert needle in check
check = check.replace(needle, insert, 1)
check_path.write_text(check)
