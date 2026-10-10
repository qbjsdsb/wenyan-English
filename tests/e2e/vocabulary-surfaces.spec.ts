import { expect, test } from '@playwright/test'

const path = '**/dicts/2025KaoYanHongBaoShu.json'
const words = [{ name: 'alpha', trans: ['fixture-alpha'], usphone: '', ukphone: '' }]

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', route => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenEnhancedPromotion', 'true')
    localStorage.setItem('dismissStartCardDate', JSON.stringify(new Date().toISOString()))
    localStorage.setItem('pronunciation', JSON.stringify({ isOpen: false, volume: 0, type: 'us' }))
    localStorage.setItem('currentDict', JSON.stringify('2025KaoYanHongBaoShu'))
  })
})

test('validated dictionary remains usable when the next download fails', async ({ page }) => {
  await page.route(path, route => route.fulfill({ json: words }))
  await page.goto('/')
  await expect(page.getByText('fixture-alpha', { exact: true })).toBeVisible()
  await page.unroute(path)
  await page.route(path, route => route.abort())
  await page.reload()
  await expect(page.getByText('fixture-alpha', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('本机保存的词库')
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeEnabled()
})

test('invalid downloaded or cached data never becomes a playable dictionary', async ({ page }) => {
  await page.route(path, route => route.fulfill({ json: [] }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('词库内容无效或为空')
  await page.evaluate(async () => {
    const cache = await caches.open('wenyan-public-dictionaries-v1')
    await cache.put('/dicts/2025KaoYanHongBaoShu.json', new Response(JSON.stringify([{ name: 42 }])))
  })
  await page.unroute(path)
  await page.route(path, route => route.abort())
  await page.reload()
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('词库暂时无法加载')
})

test('gallery search preserves navigation and explicitly leaves old review mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('reviewModeInfo', JSON.stringify({
    isReviewMode: true, reviewRecord: { words: [{ name: 'oldreview', trans: ['old-review-content'] }], index: 0, isFinished: false },
  })))
  await page.route(path, route => route.fulfill({ json: words }))
  await page.goto('/gallery')
  await page.getByRole('searchbox', { name: '搜索词书' }).fill('hongbao')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/gallery/)
  await page.getByRole('button', { name: /2025考研英语词汇hongbao书/ }).click()
  await page.getByRole('button', { name: '开始第 1 章', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('fixture-alpha', { exact: true })).toBeVisible()
  await expect(page.getByText('old-review-content', { exact: true })).toHaveCount(0)
})

test('analysis preserves deduplicated legacy spelling history while preferring immutable facts', async ({ page }) => {
  await page.goto('/analysis')
  await expect(page.getByRole('heading', { name: '暂无拼写数据', exact: true })).toBeVisible()

  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { WordRecord } from '/src/utils/db/record.ts'
    await db.wordRecords.add(new WordRecord('legacy-only', 'cet4', 0, [120], 0, {}))
    window.__legacySeeded = true
  ` })
  await page.waitForFunction(() => window.__legacySeeded === true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '拼写节奏', exact: true })).toBeVisible()
  await expect(page.getByText(/旧版本机记录/).first()).toBeVisible()

  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { WordRecord } from '/src/utils/db/record.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    const record = new WordRecord('alpha', 'cet4', 0, [120], 0, {})
    const id = await db.wordRecords.add(record)
    const event = createLearningEvent('word_attempted', {
      word: 'alpha', dict: 'cet4', chapter: 0, reviewMode: false,
      wrongCount: 0, durationMs: 120, timing: [120], mistakes: {}
    }, 2)
    event.occurredAt = record.timeStamp * 1000
    await db.learningEvents.add(event)
    window.__factSeeded = id > 0
  ` })
  await page.waitForFunction(() => window.__factSeeded === true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '拼写节奏', exact: true })).toBeVisible()
  await expect(page.getByText(/含 1 条旧版本机记录/)).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Infinity')
})
