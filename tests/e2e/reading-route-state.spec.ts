import { expect, test } from '@playwright/test'

test('stale reading submission persists for captured owner without overwriting a rapid A→B→A visit', async ({ page }) => {
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
      const originalTransaction = db.transaction.bind(db)
      let release
      const gate = new Promise((resolve) => { release = resolve })
      let pauseNextTransaction = true
      db.transaction = async (...args) => {
        if (pauseNextTransaction) {
          pauseNextTransaction = false
          window.__readingSubmitStarted = true
          await gate
        }
        return originalTransaction(...args)
      }
      window.__releaseReadingSubmit = release
      window.__switchReadingOwner = (owner) => setLocalLearningOwnerId(owner)
      window.__countReadingCompletionsForA = async () => {
        const rows = await db.learningEvents.toArray()
        return rows.filter((row) => row.eventType === 'reading_completed' && row.ownerUserId === 'owner-a').length
      }
    `,
  })

  await page.getByRole('button', { name: '提交' }).click()
  await page.waitForFunction(() => Boolean((window as unknown as { __readingSubmitStarted?: boolean }).__readingSubmitStarted))

  await page.evaluate(() => {
    const controls = window as unknown as { __switchReadingOwner: (owner: string) => void }
    controls.__switchReadingOwner('owner-b')
    window.localStorage.setItem(
      'wenyanReadingDraft:owner-a:wenyan-demo-reading-01:1',
      JSON.stringify({ ownerUserId: 'owner-a', startedAt: 123456, answers: [{ questionId: 'q1', selectedOptionId: 'B', answerChangeCount: 0 }] }),
    )
    controls.__switchReadingOwner('owner-a')
  })

  await expect(page.locator('input[name="q1"][value="B"]')).toBeChecked()
  await page.evaluate(() => (window as unknown as { __releaseReadingSubmit: () => void }).__releaseReadingSubmit())
  await page.waitForFunction(async () => {
    const count = await (window as unknown as { __countReadingCompletionsForA: () => Promise<number> }).__countReadingCompletionsForA()
    return count === 1
  })

  await expect(page.getByText('本次结果')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '提交' })).toBeEnabled()
  await expect(page.locator('input[name="q1"][value="B"]')).toBeChecked()
  const replacementDraft = await page.evaluate(() => window.localStorage.getItem('wenyanReadingDraft:owner-a:wenyan-demo-reading-01:1'))
  expect(replacementDraft).toContain('123456')
  expect(replacementDraft).toContain('"selectedOptionId":"B"')
})

test('reading rejects malformed saved answers and locks answers during submission', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('wenyanReadingDraft:anonymous:wenyan-demo-reading-01:1', JSON.stringify({
      startedAt: Date.now() - 1000,
      answers: [null, { questionId: 'q1', selectedOptionId: 'invented', answerChangeCount: -1 }],
    }))
  })
  await page.goto('/reading/wenyan-demo-reading-01')
  await expect(page.getByText('已作答 0 / 3')).toBeVisible()
  await page.locator('input[name="q1"][value="B"]').check()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const originalTransaction = db.transaction.bind(db)
    let release
    const gate = new Promise(resolve => { release = resolve })
    db.transaction = async (...args) => { await gate; return originalTransaction(...args) }
    window.__finishReadingSave = release
  ` })
  await page.getByRole('button', { name: '提交', exact: true }).click()
  await expect(page.locator('input[name="q1"][value="A"]')).toBeDisabled()
  await page.evaluate(() => (window as unknown as { __finishReadingSave: () => void }).__finishReadingSave())
  await expect(page.getByText('答对 1 · 答错 0 · 未答 2', { exact: true })).toBeVisible()
  await expect(page.getByText('未作答 · 正确答案：C')).toHaveCount(2)
})
