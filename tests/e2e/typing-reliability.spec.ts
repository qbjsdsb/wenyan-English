import { expect, test, type Page } from '@playwright/test'

const fixtureWords = ['alpha', 'beta'].map((name) => ({ name, trans: [`meaning-${name}`], usphone: '', ukphone: '' }))

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/2025KaoYanHongBaoShu.json', (route) => route.fulfill({ json: fixtureWords }))
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenEnhancedPromotion', 'true')
    localStorage.setItem('dismissStartCardDate', JSON.stringify(new Date().toISOString()))
    localStorage.setItem('pronunciation', JSON.stringify({ isOpen: false, volume: 0, type: 'us' }))
    localStorage.setItem('currentDict', JSON.stringify('2025KaoYanHongBaoShu'))
  })
  await page.goto('/')
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
})

async function counts(page: Page) {
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const events = await db.learningEvents.toArray()
    document.body.dataset.wordFacts = String(events.filter(e => e.eventType === 'word_attempted').length)
    document.body.dataset.chapterFacts = String(events.filter(e => e.eventType === 'chapter_completed').length)
  ` })
}

test('failed word write pauses at the same word and retry commits exactly once', async ({ page }) => {
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    window.failWordWrite = true
    db.learningEvents.hook('creating', (_key, event) => {
      if (window.failWordWrite && event.eventType === 'word_attempted') throw new Error('fixture storage failure')
    })
  ` })
  await page.keyboard.press('Enter')
  await page.keyboard.type('alpha', { delay: 35 })
  await expect(page.getByRole('alert')).toContainText('这个词的记录尚未保存')
  await expect(page.getByText('meaning-alpha', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeDisabled()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toHaveCount(0)
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '0')
  await page.evaluate('window.failWordWrite = false')
  await page.getByRole('button', { name: '重试保存单词' }).click()
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '1')
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '0')
})

test('chapter result waits for local commit and a failed chapter can be retried', async ({ page }) => {
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    window.failChapterWrite = true
    db.learningEvents.hook('creating', (_key, event) => {
      if (window.failChapterWrite && event.eventType === 'chapter_completed') throw new Error('fixture chapter failure')
    })
  ` })
  await page.keyboard.press('Enter')
  await page.keyboard.type('alpha', { delay: 35 })
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await page.keyboard.type('beta', { delay: 35 })
  await expect(page.getByRole('alert')).toContainText('本次章节记录尚未保存')
  await expect(page.getByRole('button', { name: '下一章节', exact: true })).toHaveCount(0)
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '2')
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '0')
  await page.evaluate('window.failChapterWrite = false')
  await page.getByRole('button', { name: '重试保存', exact: true }).click()
  await expect(page.getByText('本次学习完成 · 记录已保存在本机', { exact: true })).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '1')
})

test('Tab navigation and Enter in the word drawer do not start typing', async ({ page }) => {
  const start = page.getByRole('button', { name: '开始', exact: true })
  await start.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '重新开始当前章节' })).toBeFocused()
  await page.getByRole('button', { name: '本章词表' }).click()
  const close = page.getByRole('button', { name: '关闭词表' })
  await close.focus()
  await page.keyboard.press('Enter')
  await expect(close).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toHaveCount(0)
})

test('focus and reconnect do not refetch and reset a partially completed chapter', async ({ page }) => {
  let refetches = 0
  page.on('request', (request) => { if (request.url().includes('2025KaoYanHongBaoShu.json')) refetches++ })
  await page.keyboard.press('Enter')
  await page.keyboard.type('alpha', { delay: 35 })
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('online'))
  })
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeVisible()
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  expect(refetches).toBe(0)
})
