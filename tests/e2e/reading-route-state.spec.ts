import { expect, test } from '@playwright/test'

test('stale reading submission cannot overwrite a new owner visit or delete its replacement draft', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wenyanLearningOwnerId', 'owner-a')
  })
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/reading/wenyan-demo-reading-01')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'
      const originalBulkAdd = db.learningEvents.bulkAdd.bind(db.learningEvents)
      let release
      const gate = new Promise((resolve) => { release = resolve })
      db.learningEvents.bulkAdd = async (...args) => {
        window.__readingSubmitStarted = true
        await gate
        return originalBulkAdd(...args)
      }
      window.__releaseReadingSubmit = release
      window.__switchReadingOwner = (owner) => setLocalLearningOwnerId(owner)
    `,
  })

  await page.getByRole('button', { name: '提交' }).click()
  await page.waitForFunction(() => Boolean((window as unknown as { __readingSubmitStarted?: boolean }).__readingSubmitStarted))

  await page.evaluate(() => {
    const controls = window as unknown as { __switchReadingOwner: (owner: string) => void }
    controls.__switchReadingOwner('owner-b')
    controls.__switchReadingOwner('owner-a')
    window.localStorage.setItem(
      'wenyanReadingDraft:owner-a:wenyan-demo-reading-01:1',
      JSON.stringify({ ownerUserId: 'owner-a', startedAt: 123456, answers: [{ questionId: 'q1', selectedOptionId: 'B', answerChangeCount: 0 }] }),
    )
  })

  await page.evaluate(() => (window as unknown as { __releaseReadingSubmit: () => void }).__releaseReadingSubmit())
  await page.waitForTimeout(100)

  await expect(page.getByText('本次结果')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '提交' })).toBeEnabled()
  const replacementDraft = await page.evaluate(() => window.localStorage.getItem('wenyanReadingDraft:owner-a:wenyan-demo-reading-01:1'))
  expect(replacementDraft).toContain('123456')
  expect(replacementDraft).toContain('"selectedOptionId":"B"')
})
