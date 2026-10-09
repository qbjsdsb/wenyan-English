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
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    const events = await db.learningEvents.toArray()
    document.body.dataset.wordFacts = String(events.filter(e => e.eventType === 'word_attempted').length)
    document.body.dataset.chapterFacts = String(events.filter(e => e.eventType === 'chapter_completed').length)
  `,
  })
}

test('failed word write pauses at the same word and retry commits exactly once', async ({ page }) => {
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    window.failWordWrite = true
    db.learningEvents.hook('creating', (_key, event) => {
      if (window.failWordWrite && event.eventType === 'word_attempted') throw new Error('fixture storage failure')
    })
  `,
  })
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
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    window.failChapterWrite = true
    db.learningEvents.hook('creating', (_key, event) => {
      if (window.failChapterWrite && event.eventType === 'chapter_completed') throw new Error('fixture chapter failure')
    })
  `,
  })
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
  page.on('request', (request) => {
    if (request.url().includes('2025KaoYanHongBaoShu.json')) refetches++
  })
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

// Recovery verifies facts and record linkage, not just the displayed cursor.
test('first letter starts practice without loss; reload resumes at the committed word', async ({ page }) => {
  await page.keyboard.type('alpha', { delay: 35 })
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await expect(page.getByText('已恢复上次保存的位置。', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '1')
  await page.keyboard.press('Enter')
  await page.keyboard.type('beta', { delay: 35 })
  await expect(page.getByText('本次学习完成 · 记录已保存在本机', { exact: true })).toBeVisible()
  await expect(page.getByText('2 / 2', { exact: true }).first()).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '2')
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '1')
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    const records = await db.chapterRecords.toArray()
    document.body.dataset.linkedWords = String(records[0].wordRecordIds.length)
    document.body.dataset.checkpoints = String(await db.typingCheckpoints.count())
  `,
  })
  await expect(page.locator('body')).toHaveAttribute('data-linked-words', '2')
  await expect(page.locator('body')).toHaveAttribute('data-checkpoints', '0')
})

test('interrupted chapter commit recovers after reload without replaying word facts', async ({ page }) => {
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    db.learningEvents.hook('creating', (_key, event) => {
      if (event.eventType === 'chapter_completed') throw new Error('fixture chapter failure')
    })
  `,
  })
  await page.keyboard.type('alpha', { delay: 35 })
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await page.keyboard.type('beta', { delay: 35 })
  await expect(page.getByRole('alert')).toContainText('本次章节记录尚未保存')
  await page.reload()
  await expect(page.getByText('本次学习完成 · 记录已保存在本机', { exact: true })).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '2')
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '1')
})

test('random order and repetition boundary survive reload; owner and content changes cannot reuse it', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('randomConfig', JSON.stringify({ isOpen: true }))
    localStorage.setItem('loopWordConfig', JSON.stringify({ times: 3 }))
  })
  await page.reload()
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toHaveText(/^(alpha|beta)$/)
  const word = (await page.locator('.wenyan-word-stage .tooltip-info').textContent())!.trim()
  await page.keyboard.type(word, { delay: 35 })
  await expect(page.locator('.wenyan-word-stage .wenyan-letter-correct')).toHaveCount(0)
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    const read = async () => {
      const cp = (await db.typingCheckpoints.toArray())[0]
      return cp?.state.wordExerciseCount ?? -1
    }
    window.readCheckpoint = read
    await read()
  `,
  })
  await expect.poll(() => page.evaluate('window.readCheckpoint()')).toBe(1)
  await page.reload()
  await expect(page.getByText('已恢复上次保存的位置。', { exact: false })).toBeVisible()
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toHaveText(word)
  await page.keyboard.type(word, { delay: 35 })
  await expect(page.locator('.wenyan-word-stage .wenyan-letter-correct')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.addScriptTag({
    type: 'module',
    content: `
    import { db } from '/src/utils/db/index.ts'
    document.body.dataset.repeat = String((await db.typingCheckpoints.toArray())[0].state.wordExerciseCount)
    import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'
    setLocalLearningOwnerId('fixture-other-owner')
  `,
  })
  await expect(page.locator('body')).toHaveAttribute('data-repeat', '2')
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
  await page.addScriptTag({
    type: 'module',
    content: `
    import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'
    setLocalLearningOwnerId(undefined)
  `,
  })
  await expect(page.getByText('已恢复上次保存的位置。', { exact: false })).toBeVisible()
  await page.route('**/dicts/2025KaoYanHongBaoShu.json', (route) =>
    route.fulfill({ json: fixtureWords.map((item) => ({ ...item, trans: ['changed reference'] })) }),
  )
  await page.reload()
  await expect(page.getByText('词库或本机进度发生变化', { exact: false })).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '2')
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '0')
})

test('skipped words do not produce chapter completion; word drawer search stays paused', async ({ page }) => {
  await page.keyboard.press('Enter')
  await page.keyboard.type('xxxx', { delay: 380 })
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByText('meaning-beta', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '本章词表' }).click()
  const search = page.getByRole('searchbox', { name: '搜索本章单词或释义' })
  await search.fill('beta')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '播放 alpha 的发音' })).toHaveCount(0)
  await page.getByRole('button', { name: '继续练习', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.type('beta', { delay: 35 })
  await expect(page.getByText('本段练习结束 · 记录已保存在本机', { exact: true })).toBeVisible()
  await expect(page.getByText('1 个词尚未完成输入', { exact: false })).toBeVisible()
  await counts(page)
  await expect(page.locator('body')).toHaveAttribute('data-word-facts', '1')
  await expect(page.locator('body')).toHaveAttribute('data-chapter-facts', '0')
})
