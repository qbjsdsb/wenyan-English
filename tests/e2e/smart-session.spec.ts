import { expect, test } from '@playwright/test'

const smartWords = ['alpha', 'beta', 'gamma'].map((name) => ({
  name,
  trans: [`${name} translation`],
  usphone: '',
  ukphone: '',
}))

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

test('Smart Session uses real word facts, has no chapter taskRun, and resumes an unfinished block', async ({ page }) => {
  await page.goto('/today')

  const start = page.getByRole('button', { name: '开始学习', exact: true })
  await expect(start).toBeEnabled()
  await expect(page.getByText(/继续推进 3 个新词/)).toBeVisible()
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
      window.__smartSessionFacts = {
        wordCount: wordFacts.length,
        words: wordFacts.map(event => event.payload.word),
        allReviewMode: wordFacts.every(event => event.payload.reviewMode === true),
        allReviewChapter: wordFacts.every(event => event.payload.chapter === -1),
        anyPlanLink: wordFacts.some(event => event.payload.planId || event.payload.taskId || event.payload.taskRunId),
        chapterFacts: events.filter(event => event.eventType === 'chapter_completed').length,
        openReviewRecords: reviewRecords.filter(record => !record.isFinished).length,
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

  await page.getByRole('button', { name: '继续这一段', exact: true }).click()
  await expect(page).toHaveURL(/smartSession=/)
  expect(new URL(page.url()).searchParams.get('taskRun')).toBeNull()
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
})

test('active Learning Intent is merged by scope and safely shapes the next block', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_learning_intents', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: [
        {
          scope: 'session',
          revision: 2,
          constraints: { targetMinutes: 10, newWordCeiling: 1, intensity: 'gentle' },
        },
        {
          scope: 'ongoing',
          revision: 4,
          constraints: { newWordCeiling: 3, reviewPreference: 'balanced' },
        },
      ],
    }),
  )
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

  await page.goto('/today')

  const dock = page.getByRole('complementary', { name: '智能学习' })
  await expect(dock).toHaveAttribute('data-intent-source', 'cloud')
  await expect(page.getByText('继续推进 1 个新词', { exact: true })).toBeVisible()
  await expect(page.getByText(/已按你最近的学习安排自动调整/)).toBeVisible()
})
