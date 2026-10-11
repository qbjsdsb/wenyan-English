from pathlib import Path

path = Path('src/resources/dictionary.ts')
text = path.read_text()

level2 = """  {
    id: 'frequently_used_words03',
    name: '超频单词level 2',
    description: '超频单词level 2',
    category: '中国考试',
    tags: ['其他'],
    url: '/dicts/frequently_used_word02.json',
    length: 1040,
    language: 'en',
    languageCategory: 'en',
  },"""
assert text.count(level2) == 1
text = text.replace(level2, level2.replace("id: 'frequently_used_words03'", "id: 'frequently_used_words02'"))

oxford_china = """  {
    id: 'Oxford5000',
    name: '牛津5000词',
    description: '牛津5000词',
    category: '中国考试',
    tags: ['其他'],
    url: '/dicts/Oxford5000.json',
    length: 5836,
    language: 'en',
    languageCategory: 'en',
  },
"""
assert text.count(oxford_china) == 1
text = text.replace(oxford_china, '')

old_map = "export const idDictionaryMap: Record<string, Dictionary> = Object.fromEntries(dictionaries.map((dict) => [dict.id, dict]))"
new_map = """export const idDictionaryMap: Record<string, Dictionary> = dictionaries.reduce<Record<string, Dictionary>>(
  (registry, dict) => {
    if (Object.prototype.hasOwnProperty.call(registry, dict.id)) {
      throw new Error(`duplicate_dictionary_id:${dict.id}`)
    }
    registry[dict.id] = dict
    return registry
  },
  Object.create(null) as Record<string, Dictionary>
)"""
assert text.count(old_map) == 1
text = text.replace(old_map, new_map)
path.write_text(text)
