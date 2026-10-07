import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenEnhancedPromotion', 'true')
    localStorage.setItem('dismissStartCardDate', JSON.stringify(new Date().toISOString()))
    localStorage.setItem('pronunciation', JSON.stringify({ isOpen: false, volume: 0, type: 'us' }))
  })
})

test('Reading Runner saves question facts separately from passage completion', async ({ page }) => {
  await page.goto('/reading/wenyan-demo-reading-01')

  await expect(page.getByRole('heading', { name: 'The Cost of Convenience' })).toBeVisible()
  await page.getByRole('radio', { name: /Convenience can gradually change/ }).check()
  await page.getByRole('radio', { name: /decision about what deserves attention/ }).check()
  await page.getByRole('radio', { name: /remove every decision/ }).check()
  await page.getByRole('button', { name: '提交这一篇' }).click()

  await expect(page.getByText('2 / 3', { exact: true })).toBeVisible()
  await expect(page.getByText('正确答案：C', { exact: true })).toBeVisible()

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      const events = await db.learningEvents.toArray()
      const questions = events.filter(event => event.eventType === 'question_attempted')
      const completions = events.filter(event => event.eventType === 'reading_completed')
      window.__readingFacts = {
        questionCount: questions.length,
        completionCount: completions.length,
        sourceVersions: events.map(event => event.sourceVersion),
        chapterFacts: events.filter(event => event.eventType === 'chapter_completed').length,
        questionResults: questions.map(event => ({
          questionId: event.payload.questionId,
          selectedOptionId: event.payload.selectedOptionId,
          correctOptionId: event.payload.correctOptionId,
          isCorrect: event.payload.isCorrect,
        })),
        completion: completions[0]?.payload,
      }
    `,
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __readingFacts?: unknown }).__readingFacts))
  const facts = await page.evaluate(
    () => (window as unknown as { __readingFacts: Record<string, unknown> }).__readingFacts,
  )

  expect(facts.questionCount).toBe(3)
  expect(facts.completionCount).toBe(1)
  expect(facts.sourceVersions).toEqual([3, 3, 3, 3])
  expect(facts.chapterFacts).toBe(0)
  expect(facts.questionResults).toEqual([
    { questionId: 'q1', selectedOptionId: 'B', correctOptionId: 'B', isCorrect: true },
    { questionId: 'q2', selectedOptionId: 'C', correctOptionId: 'C', isCorrect: true },
    { questionId: 'q3', selectedOptionId: 'A', correctOptionId: 'C', isCorrect: false },
  ])
  expect(facts.completion).toMatchObject({
    passageId: 'wenyan-demo-reading-01',
    passageVersion: '1',
    questionCount: 3,
    answeredCount: 3,
    correctCount: 2,
  })
})

test('Reading Runner restores an unfinished local answer draft without creating facts', async ({ page }) => {
  await page.goto('/reading/wenyan-demo-reading-01')
  await page.getByRole('radio', { name: /Convenience can gradually change/ }).check()
  await page.reload()

  await expect(page.getByRole('radio', { name: /Convenience can gradually change/ })).toBeChecked()
  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      window.__readingDraftFacts = (await db.learningEvents.toArray()).length
    `,
  })
  await page.waitForFunction(() => (window as unknown as { __readingDraftFacts?: number }).__readingDraftFacts !== undefined)
  expect(await page.evaluate(() => (window as unknown as { __readingDraftFacts: number }).__readingDraftFacts)).toBe(0)
})
