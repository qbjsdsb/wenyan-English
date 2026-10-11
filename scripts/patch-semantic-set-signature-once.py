from pathlib import Path

semantic_path = Path('src/semantic/discrimination.ts')
text = semantic_path.read_text()
old = """function meaningSignature(item: SemanticItem) {
  return item.meanings
    .map((value) => value.normalize('NFKC').trim().toLocaleLowerCase())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('\\u241f')
}
"""
new = """function meaningSignature(item: SemanticItem) {
  const normalized = item.meanings
    .map((value) => value.normalize('NFKC').trim().toLocaleLowerCase())
    .filter(Boolean)
  return [...new Set(normalized)]
    .sort((a, b) => a.localeCompare(b))
    .join('\\u241f')
}
"""
assert old in text
semantic_path.write_text(text.replace(old, new, 1))

check_path = Path('scripts/check-semantic.mjs')
check = check_path.read_text()
needle = """assert.equal(reorderedQuestion.correctContentId, 'reordered:cue')

const objectivePayload = parseSemanticDiscriminationPayload({
"""
insert = """assert.equal(reorderedQuestion.correctContentId, 'reordered:cue')

const repeatedMeaningItems = [
  { contentId: 'repeat:cue', key: 'repeat:cue', contentVersion: shapeVersion('6'), word: 'squabble', meanings: ['争吵'] },
  { contentId: 'repeat:duplicate', key: 'repeat:duplicate', contentVersion: shapeVersion('7'), word: 'quarrel', meanings: ['争吵', '争吵'] },
  { contentId: 'repeat:other-1', key: 'repeat:other-1', contentVersion: shapeVersion('8'), word: 'other4', meanings: ['协商'] },
  { contentId: 'repeat:other-2', key: 'repeat:other-2', contentVersion: shapeVersion('9'), word: 'other5', meanings: ['沉默'] },
  { contentId: 'repeat:other-3', key: 'repeat:other-3', contentVersion: shapeVersion('a'), word: 'other6', meanings: ['赞同'] },
]
const repeatedQuestion = buildSemanticDiscriminationQuestions(repeatedMeaningItems, 1, ['repeat:cue'])[0]
assert.equal(repeatedQuestion.options.length, 4)
assert.equal(repeatedQuestion.options.some((option) => option.contentId === 'repeat:duplicate'), false)
assert.equal(repeatedQuestion.correctContentId, 'repeat:cue')

const objectivePayload = parseSemanticDiscriminationPayload({
"""
assert needle in check
check_path.write_text(check.replace(needle, insert, 1))
