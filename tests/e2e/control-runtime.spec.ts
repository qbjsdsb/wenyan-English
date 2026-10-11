import { expect, test } from '@playwright/test'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test('control runtime keeps a stable session device id across reloads when localStorage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.getItem = function (key: string) {
      if (this === window.localStorage && key === 'wenyanDeviceId') throw new DOMException('blocked', 'SecurityError')
      return originalGetItem.call(this, key)
    }
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === window.localStorage && key === 'wenyanDeviceId') throw new DOMException('blocked', 'SecurityError')
      return originalSetItem.call(this, key, value)
    }
  })
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  const readDeviceId = async () => {
    await page.addScriptTag({
      type: 'module',
      content: `
        import { getWenyanDeviceId } from '/src/control/deviceId.ts'
        window.__controlDeviceIdResult = getWenyanDeviceId()
      `,
    })
    await page.waitForFunction(() => Boolean((window as unknown as { __controlDeviceIdResult?: string }).__controlDeviceIdResult))
    return page.evaluate(() => (window as unknown as { __controlDeviceIdResult: string }).__controlDeviceIdResult)
  }

  const beforeReload = await readDeviceId()
  expect(beforeReload).toMatch(UUID_PATTERN)

  await page.reload()
  const afterReload = await readDeviceId()
  expect(afterReload).toBe(beforeReload)
  await expect(page.locator('body')).toBeVisible()
})

test('retries reuse the same active cloud task run instead of duplicating execution', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')
  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      import { startStudyTask } from '/src/plans/repository.ts'
      import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'

      await db.studyPlans.clear()
      await db.studyPlanRuns.clear()
      setLocalLearningOwnerId('owner-a')
      await db.studyPlans.put({
        schemaVersion: 1,
        id: 'control-plan',
        title: '控制重试计划',
        timezone: 'Asia/Shanghai',
        importedAt: Date.now(),
        origin: 'cloud',
        ownerUserId: 'owner-a',
        cloudRevision: 9,
        cloudStatus: 'active',
        cloudCompletions: {},
        tasks: [{
          id: 'first', title: '第一章', kind: 'chapter', dictId: 'cet4', chapterIndex: 0,
          dueDate: '2026-10-11', estimatedMinutes: 10, reason: '验证命令重试幂等。'
        }],
      })
      const first = await startStudyTask('control-plan', 'first')
      const second = await startStudyTask('control-plan', 'first')
      const runs = await db.studyPlanRuns.where('planId').equals('control-plan').toArray()
      window.__controlRetryResult = { firstId: first.id, secondId: second.id, count: runs.length }
    `,
  })

  await page.waitForFunction(() => Boolean((window as unknown as { __controlRetryResult?: unknown }).__controlRetryResult))
  const result = await page.evaluate(() => (window as unknown as {
    __controlRetryResult: { firstId: string; secondId: string; count: number }
  }).__controlRetryResult)
  expect(result.secondId).toBe(result.firstId)
  expect(result.count).toBe(1)
})
