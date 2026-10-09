import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: [{ name: 'alpha', trans: ['阿尔法，开端'], usphone: '', ukphone: '' }] }))
  await page.addInitScript(() => { localStorage.setItem('currentDict', JSON.stringify('cet4')) })
})

test('Today selects semantic recall, preserves reveal on reload, and writes only a semantic fact', async ({ page }) => {
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    await db.learningEvents.add(createLearningEvent('word_attempted', {
      word: 'alpha', dict: 'cet4', chapter: 0, reviewMode: false, wrongCount: 0, durationMs: 100, timing: [], mistakes: {}
    }))
    window.__semanticSeeded = true
  ` })
  await page.waitForFunction(() => (window as unknown as { __semanticSeeded: boolean }).__semanticSeeded)
  await page.reload()
  await expect(page.getByText('回想 1 个熟悉单词的词义')).toBeVisible()
  await page.getByRole('button', { name: '开始学习', exact: true }).click()
  await expect(page).toHaveURL(/\/semantic\//)
  await expect(page.getByText('阿尔法，开端')).toHaveCount(0)
  await page.getByRole('button', { name: /查看释义/ }).click()
  await expect(page.getByText('阿尔法，开端')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('semantic-reveal.png') })
  await page.reload()
  await expect(page.getByText(/恢复时释义已揭示/)).toBeVisible()
  await page.getByRole('button', { name: '2 想起部分' }).click()
  await expect(page.getByRole('heading', { name: '这一段，已经留下记录。' })).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const events = await db.learningEvents.toArray()
    window.__semanticResult = {
      semantic: events.filter(e => e.eventType === 'semantic_recall_attempted'),
      chapter: events.filter(e => e.eventType === 'chapter_completed').length,
      spelling: events.filter(e => e.eventType === 'word_attempted').length,
      runs: await db.semanticRuns.toArray()
    }
  ` })
  await page.waitForFunction(() => !!(window as unknown as { __semanticResult: unknown }).__semanticResult)
  const result = await page.evaluate(() => (window as unknown as { __semanticResult: {
    semantic: { sourceVersion: number; payload: { rating: string; resumedAfterReveal: boolean } }[]; chapter: number; spelling: number; runs: { index: number }[]
  } }).__semanticResult)
  expect(result.semantic).toHaveLength(1)
  expect(result.semantic[0].sourceVersion).toBe(4)
  expect(result.semantic[0].payload.rating).toBe('partial')
  expect(result.semantic[0].payload.resumedAfterReveal).toBe(true)
  expect(result.chapter).toBe(0)
  expect(result.spelling).toBe(1)
  expect(result.runs[0].index).toBe(1)
})

test('completed recall can create an objectively scored reference-discrimination fact', async ({ page }) => {
  const words = [
    { name: 'alpha', trans: ['阿尔法，开端'], usphone: '', ukphone: '' },
    { name: 'beta', trans: ['贝塔，第二'], usphone: '', ukphone: '' },
    { name: 'gamma', trans: ['伽马，第三'], usphone: '', ukphone: '' },
    { name: 'delta', trans: ['德尔塔，变化量'], usphone: '', ukphone: '' },
  ]
  await page.unroute('**/dicts/CET4_T.json')
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: words }))
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    for (const word of ['alpha', 'beta', 'gamma', 'delta']) {
      await db.learningEvents.add(createLearningEvent('word_attempted', {
        word, dict: 'cet4', chapter: 0, reviewMode: false, wrongCount: 0, durationMs: 100, timing: [], mistakes: {}
      }))
    }
    window.__objectiveSemanticSeeded = true
  ` })
  await page.waitForFunction(() => (window as unknown as { __objectiveSemanticSeeded: boolean }).__objectiveSemanticSeeded)
  await page.reload()
  await expect(page.getByText('回想 4 个熟悉单词的词义')).toBeVisible()
  await page.getByRole('button', { name: '开始学习', exact: true }).click()
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: /查看释义/ }).click()
    await page.getByRole('button', { name: '3 想起了' }).click()
  }
  await expect(page.getByRole('button', { name: '开始辨认' })).toBeVisible()
  await page.getByRole('button', { name: '开始辨认' }).click()
  await expect(page).toHaveURL(/\/semantic-check\//)
  await expect(page.getByRole('heading', { name: 'alpha' })).toBeVisible()
  await page.getByRole('button', { name: /阿尔法，开端/ }).click()
  await expect(page.getByText('选择正确')).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const facts = await db.learningEvents.where('eventType').equals('semantic_discrimination_attempted').toArray()
    const runs = await db.semanticRuns.toArray()
    window.__objectiveSemanticResult = { facts, runs }
  ` })
  await page.waitForFunction(() => !!(window as unknown as { __objectiveSemanticResult: unknown }).__objectiveSemanticResult)
  const result = await page.evaluate(() => (window as unknown as { __objectiveSemanticResult: {
    facts: { sourceVersion: number; payload: { measurement: string; isCorrect: boolean; options: unknown[] } }[]
    runs: { mode?: string; index: number }[]
  } }).__objectiveSemanticResult)
  expect(result.facts).toHaveLength(1)
  expect(result.facts[0].sourceVersion).toBe(5)
  expect(result.facts[0].payload.measurement).toBe('reference_meaning_discrimination')
  expect(result.facts[0].payload.isCorrect).toBe(true)
  expect(result.facts[0].payload.options).toHaveLength(4)
  expect(result.runs.some((run) => run.mode === 'discrimination' && run.index === 1)).toBe(true)
})

test('failed local commit preserves progress; another owner cannot read or rate the run', async ({ page }) => {
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { revealSemanticItem, saveSemanticRating, loadSemanticRun } from '/src/semantic/runtime.ts'
    const run = { id: 'failure-fixture', sessionId: 's', dictionaryId: 'cet4', startedAt: Date.now(), index: 0,
      items: [{ contentId: 'semantic:cet4:alpha', key: 'semantic:cet4:alpha', contentVersion: 'sha256:' + 'a'.repeat(64), word: 'alpha', meanings: ['开端'] }] }
    await db.semanticRuns.add(run)
    await revealSemanticItem(run.id, 0)
    const reject = () => { throw new Error('fixture_storage_failure') }
    db.learningEvents.hook('creating', reject)
    let failed = false
    try { await saveSemanticRating(run.id, 0, 'partial', false) } catch { failed = true }
    db.learningEvents.hook('creating').unsubscribe(reject)
    const after = await db.semanticRuns.get(run.id)
    const facts = await db.learningEvents.where('eventType').equals('semantic_recall_attempted').count()
    localStorage.setItem('wenyanLearningOwnerId', 'other-owner')
    let isolated = false
    try { await loadSemanticRun(run.id) } catch { isolated = true }
    window.__semanticSafety = { failed, index: after.index, facts, isolated }
  ` })
  await page.waitForFunction(() => !!(window as unknown as { __semanticSafety: unknown }).__semanticSafety)
  expect(await page.evaluate(() => (window as unknown as { __semanticSafety: unknown }).__semanticSafety))
    .toEqual({ failed: true, index: 0, facts: 0, isolated: true })
})
