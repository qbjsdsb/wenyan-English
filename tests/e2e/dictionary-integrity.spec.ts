import { expect, test } from '@playwright/test'

test('dictionary registry has unique ids and no prototype-chain aliases', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { dictionaryResources, idDictionaryMap } from '/src/resources/dictionary.ts'

      const seen = new Set()
      const duplicates = []
      for (const resource of dictionaryResources) {
        if (seen.has(resource.id)) duplicates.push(resource.id)
        seen.add(resource.id)
      }
      const level2 = dictionaryResources.find((resource) => resource.url === '/dicts/frequently_used_word02.json')
      const level3 = dictionaryResources.find((resource) => resource.url === '/dicts/frequently_used_word03.json')

      window.__dictionaryIntegrity = {
        duplicates,
        level2Id: level2?.id,
        level3Id: level3?.id,
        nullPrototype: Object.getPrototypeOf(idDictionaryMap) === null,
        inheritedToString: Object.prototype.hasOwnProperty.call(idDictionaryMap, 'toString') ? 'own' : typeof idDictionaryMap.toString,
      }
    `,
  })

  const result = await page.evaluate(() => (window as unknown as { __dictionaryIntegrity: Record<string, unknown> }).__dictionaryIntegrity)
  expect(result.duplicates).toEqual([])
  expect(result.level2Id).toBe('frequently_used_words02')
  expect(result.level3Id).toBe('frequently_used_words03')
  expect(result.nullPrototype).toBe(true)
  expect(result.inheritedToString).toBe('undefined')
})
