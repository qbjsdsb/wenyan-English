import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: [
    { name: 'alpha', trans: ['阿尔法，开端'], usphone: '', ukphone: '' },
    { name: 'beta', trans: ['贝塔，第二'], usphone: '', ukphone: '' },
  ] }))
  await page.addInitScript(() => { localStorage.setItem('currentDict', JSON.stringify('cet4')) })
})

test('meaning-to-headword production hides answers, commits v6 facts, and resumes at the saved cursor', async ({ page }) => {
  await page.goto('/practice?mode=production&limit=6')
  await expect(page.getByRole('heading', { name: '专项训练' })).toBeVisible()
  await expect(page.getByText('看义写词', { exact: true })).toBeVisible()
  await expect(page.getByText('alpha', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '开始看义写词', exact: true }).click()
  await expect(page).toHaveURL(/\/semantic-production\//)
  await expect(page.getByText('阿尔法，开端', { exact: true })).toBeVisible()
  await expect(page.getByText('alpha', { exact: true })).toHaveCount(0)

  await page.getByLabel('英文词头').fill('alpha')
  await page.getByLabel('英文词头').press('Enter')
  await expect(page.getByText('写对了', { exact: true })).toBeVisible()
  await expect(page.getByText('alpha', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /下一个/ }).click()
  await expect(page.getByText('贝塔，第二', { exact: true })).toBeVisible()
  await expect(page.getByText('beta', { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('贝塔，第二', { exact: true })).toBeVisible()
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()
  await page.getByLabel('英文词头').fill('wrong')
  await page.getByLabel('英文词头').press('Enter')
  await expect(page.getByText('核对一下', { exact: true })).toBeVisible()
  await expect(page.getByText('beta', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /查看结果/ }).click()
  await expect(page.getByRole('heading', { name: '这一段完成了。' })).toBeVisible()
  await expect(page.getByText('写对 1 · 写错 1', { exact: true })).toBeVisible()

  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const facts = await db.learningEvents.where('eventType').equals('semantic_production_attempted').toArray()
    const run = (await db.semanticRuns.toArray()).find(r => r.mode === 'production')
    window.__productionProof = { facts, run }
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __productionProof?: unknown }).__productionProof))
  const proof = await page.evaluate(() => (window as unknown as { __productionProof: {
    facts: { sourceVersion: number; payload: { isCorrect: boolean; measurement: string } }[]
    run: { index: number; completedAt?: number }
  } }).__productionProof)
  expect(proof.facts).toHaveLength(2)
  expect(proof.facts.map((fact) => fact.sourceVersion)).toEqual([6, 6])
  expect(proof.facts.map((fact) => fact.payload.isCorrect)).toEqual([true, false])
  expect(proof.facts.every((fact) => fact.payload.measurement === 'reference_headword_production')).toBe(true)
  expect(proof.run.index).toBe(2)
  expect(proof.run.completedAt).toBeTruthy()
})
