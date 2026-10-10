import { expect, test, type Page } from '@playwright/test'

const smartWords = ['alpha', 'beta', 'gamma'].map((name) => ({
  name,
  trans: [`${name} translation`],
  usphone: '',
  ukphone: '',
}))

const authenticatedUserId = '00000000-0000-4000-8000-000000000001'

const installAuthenticatedSession = async (page: Page) => {
  await page.addInitScript(() => {
    const now = Math.floor(Date.now() / 1000)
    localStorage.setItem(
      'sb-cmjhxvpkdeheujuteqoi-auth-token',
      JSON.stringify({
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        user: {
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'e2e@example.com',
          app_metadata: {},
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
        },
      }),
    )
  })
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: smartWords }))
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenEnhancedPromotion', 'true')
    localStorage.setItem('dismissStartCardDate', JSON.stringify(new Date().toISOString()))
    localStorage.setItem('pronunciation', JSON.stringify({ isOpen: false, volume: 0, type: 'us' }))
    localStorage.setItem('currentDict', JSON.stringify('cet4'))
  })
})

test('Smart Session persists the real spelling cursor, resumes at the next word, and settles without chapter completion', async ({ page }) => {
  await page.goto('/today')

  const smartRegion = page.getByRole('region', { name: '智能学习' })
  await expect(smartRegion).toBeVisible()
  const start = smartRegion.getByRole('button', { name: '开始学习', exact: true })
  await expect(start).toBeEnabled()
  await expect(smartRegion.getByText(/继续推进 3 个新词/)).toBeVisible()
  await start.click()

  await expect(page).toHaveURL(/smartSession=/)
  await expect(page).toHaveURL(/smartBlock=/)
  expect(new URL(page.url()).searchParams.get('taskRun')).toBeNull()
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()

  await page.keyboard.press('Enter')
  await page.keyboard.type('alpha', { delay: 35 })
  await page.waitForTimeout(500)
  await page.getByRole('link', { name: '今日学习', exact: true }).click()

  await expect(page.getByText('继续刚才的 3 个词', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '继续这一段', exact: true })).toBeEnabled()

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      const events = await db.learningEvents.toArray()
      const wordFacts = events.filter(event => event.eventType === 'word_attempted')
      const reviewRecords = await db.reviewRecords.toArray()
      const smartRecord = reviewRecords.find(record => record.origin === 'smart')
      window.__smartSessionFacts = {
        wordCount: wordFacts.length,
        words: wordFacts.map(event => event.payload.word),
        allReviewMode: wordFacts.every(event => event.payload.reviewMode === true),
        allReviewChapter: wordFacts.every(event => event.payload.chapter === -1),
        anyPlanLink: wordFacts.some(event => event.payload.planId || event.payload.taskId || event.payload.taskRunId),
        chapterFacts: events.filter(event => event.eventType === 'chapter_completed').length,
        openReviewRecords: reviewRecords.filter(record => !record.isFinished && record.endedAt === undefined).length,
        smartIndex: smartRecord?.index ?? null,
        smartOrigin: smartRecord?.origin ?? null,
        smartOwner: smartRecord?.ownerUserId ?? null,
        smartFinished: smartRecord?.isFinished ?? null,
      }
    `,
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __smartSessionFacts?: unknown }).__smartSessionFacts))
  const facts = await page.evaluate(
    () => (window as unknown as { __smartSessionFacts: Record<string, unknown> }).__smartSessionFacts,
  )

  expect(facts.wordCount).toBe(1)
  expect(facts.words).toEqual(['alpha'])
  expect(facts.allReviewMode).toBe(true)
  expect(facts.allReviewChapter).toBe(true)
  expect(facts.anyPlanLink).toBe(false)
  expect(facts.chapterFacts).toBe(0)
  expect(facts.openReviewRecords).toBe(1)
  expect(facts.smartIndex).toBe(1)
  expect(facts.smartOrigin).toBe('smart')
  expect(facts.smartOwner).toBeNull()
  expect(facts.smartFinished).toBe(false)

  await page.getByRole('button', { name: '继续这一段', exact: true }).click()
  await expect(page).toHaveURL(/smartSession=/)
  expect(new URL(page.url()).searchParams.get('taskRun')).toBeNull()
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(page.getByText('beta translation', { exact: true })).toBeVisible()
  await page.keyboard.type('beta', { delay: 35 })
  await expect(page.getByText('gamma translation', { exact: true })).toBeVisible()
  await page.keyboard.type('gamma', { delay: 35 })
  await expect(page.getByText(/本次学习完成/)).toBeVisible()
  await page.getByRole('button', { name: '返回今天', exact: true }).click()
  await expect(page).toHaveURL(/\/today$/)

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      const events = await db.learningEvents.toArray()
      const wordFacts = events.filter(event => event.eventType === 'word_attempted')
      const smartRecord = (await db.reviewRecords.toArray()).find(record => record.origin === 'smart')
      window.__smartCompletion = {
        wordCount: wordFacts.length,
        words: wordFacts.map(event => event.payload.word),
        chapterFacts: events.filter(event => event.eventType === 'chapter_completed').length,
        smartIndex: smartRecord?.index ?? null,
        smartFinished: smartRecord?.isFinished ?? null,
      }
    `,
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __smartCompletion?: unknown }).__smartCompletion))
  const completion = await page.evaluate(
    () => (window as unknown as { __smartCompletion: Record<string, unknown> }).__smartCompletion,
  )
  expect(completion.wordCount).toBe(3)
  expect(completion.words).toEqual(['alpha', 'beta', 'gamma'])
  expect(completion.chapterFacts).toBe(0)
  expect(completion.smartIndex).toBe(3)
  expect(completion.smartFinished).toBe(true)
})

test('active Learning Intent is merged by scope and safely shapes the next block', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_learning_intents', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          timezone: 'Asia/Shanghai',
          scope: 'session',
          revision: 2,
          constraints: { targetMinutes: 10, newWordCeiling: 1, intensity: 'gentle' },
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          timezone: 'Asia/Shanghai',
          scope: 'ongoing',
          revision: 4,
          constraints: { newWordCeiling: 3, reviewPreference: 'balanced' },
        },
      ],
    }),
  )
  await installAuthenticatedSession(page)

  await page.goto('/today')

  const dock = page.getByRole('region', { name: '智能学习' })
  await expect(dock).toHaveAttribute('data-intent-source', 'cloud')
  await expect(dock.getByText('继续推进 1 个新词', { exact: true })).toBeVisible()
  await expect(dock.getByText(/已按你最近的学习安排自动调整/)).toBeVisible()
})

test('semantic Learning Intent reaches the semantic executor instead of being overwritten to vocabulary', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_learning_intents', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: '00000000-0000-4000-8000-000000000005',
          timezone: 'Asia/Shanghai',
          scope: 'ongoing',
          revision: 1,
          constraints: { preferredActivities: ['semantic_recall'], newWordCeiling: 3 },
        },
      ],
    }),
  )
  await installAuthenticatedSession(page)
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      import { createLearningEvent } from '/src/learning/types.ts'
      const event = createLearningEvent('word_attempted', {
        word: 'alpha', dict: 'cet4', chapter: 0, reviewMode: false,
        wrongCount: 0, durationMs: 100, timing: [], mistakes: {}
      })
      await db.learningEvents.add({ ...event, ownerUserId: '${authenticatedUserId}' })
      window.__semanticIntentSeeded = true
    `,
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __semanticIntentSeeded?: boolean }).__semanticIntentSeeded))
  await page.reload()

  const dock = page.getByRole('region', { name: '智能学习' })
  await expect(dock).toHaveAttribute('data-intent-source', 'cloud')
  await expect(dock.getByText('回想 1 个熟悉单词的词义', { exact: true })).toBeVisible()
  await dock.getByRole('button', { name: '开始学习', exact: true }).click()
  await expect(page).toHaveURL(/\/semantic\//)
})

test('review-only intent has an actionable empty state instead of a dead disabled button', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_learning_intents', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: '00000000-0000-4000-8000-000000000004',
          timezone: 'Asia/Shanghai',
          scope: 'ongoing',
          revision: 1,
          constraints: { newWordCeiling: 0, reviewPreference: 'review_first' },
        },
      ],
    }),
  )
  await installAuthenticatedSession(page)

  await page.goto('/today')

  const dock = page.getByRole('region', { name: '智能学习' })
  await expect(dock).toHaveAttribute('data-intent-source', 'cloud')
  await expect(dock.getByText('当前没有到期复习内容。', { exact: true })).toBeVisible()
  await expect(dock.getByText(/今天的新词上限是 0/)).toBeVisible()
  await expect(dock.getByText('今日新词上限 0', { exact: true })).toBeVisible()
  await expect(dock.getByRole('button', { name: '重新检查', exact: true })).toBeEnabled()
  const manual = dock.getByRole('link', { name: '手动继续当前章节（不按这条智能安排）', exact: true })
  await expect(manual).toBeVisible()
  await manual.click()
  await expect(page).toHaveURL(/\/$/)
})
