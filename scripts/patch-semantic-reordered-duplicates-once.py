from pathlib import Path

semantic_path = Path('src/semantic/discrimination.ts')
text = semantic_path.read_text()
old = """  return item.meanings
    .map((value) => value.normalize('NFKC').trim().toLocaleLowerCase())
    .filter(Boolean)
    .join('\\u241f')
"""
new = """  return item.meanings
    .map((value) => value.normalize('NFKC').trim().toLocaleLowerCase())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('\\u241f')
"""
assert old in text
text = text.replace(old, new, 1)
semantic_path.write_text(text)

check_path = Path('scripts/check-semantic.mjs')
check = check_path.read_text()
needle = """assert.deepEqual(buildSemanticDiscriminationQuestions(shapeItems, 1, ['shape:cue']), [shapeQuestion])

const objectivePayload = parseSemanticDiscriminationPayload({
"""
insert = """assert.deepEqual(buildSemanticDiscriminationQuestions(shapeItems, 1, ['shape:cue']), [shapeQuestion])

const reorderedMeaningItems = [
  { contentId: 'reordered:cue', key: 'reordered:cue', contentVersion: shapeVersion('1'), word: 'lissome', meanings: ['adj.柔软的', 'adj.敏捷的，轻盈的'] },
  { contentId: 'reordered:duplicate', key: 'reordered:duplicate', contentVersion: shapeVersion('2'), word: 'lithe', meanings: ['adj.敏捷的，轻盈的', 'adj.柔软的'] },
  { contentId: 'reordered:other-1', key: 'reordered:other-1', contentVersion: shapeVersion('3'), word: 'other1', meanings: ['adj.坚定的'] },
  { contentId: 'reordered:other-2', key: 'reordered:other-2', contentVersion: shapeVersion('4'), word: 'other2', meanings: ['adj.迟缓的'] },
  { contentId: 'reordered:other-3', key: 'reordered:other-3', contentVersion: shapeVersion('5'), word: 'other3', meanings: ['adj.短暂的'] },
]
const reorderedQuestion = buildSemanticDiscriminationQuestions(reorderedMeaningItems, 1, ['reordered:cue'])[0]
assert.equal(reorderedQuestion.options.length, 4)
assert.equal(reorderedQuestion.options.some((option) => option.contentId === 'reordered:duplicate'), false)
assert.equal(reorderedQuestion.correctContentId, 'reordered:cue')

const objectivePayload = parseSemanticDiscriminationPayload({
"""
assert needle in check
check = check.replace(needle, insert, 1)
check_path.write_text(check)
