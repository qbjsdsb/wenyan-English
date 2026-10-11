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
      import Dexie from 'dexie'
      import { db } from '/src/utils/db/index.ts'
      import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'
      const tablePrototype = Object.getPrototypeOf(db.learningEvents)
      const originalBulkAdd = tablePrototype.bulkAdd
      let release
      const gate = new Promise((resolve) => { release = resolve })
      tablePrototype.bulkAdd = async function (...args) {
        if (this.name === 'learningEvents') {
          window.__readingSubmitStarted = true
          await Dexie.waitFor(gate)
        }
        return originalBulkAdd.apply(this, args)
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
