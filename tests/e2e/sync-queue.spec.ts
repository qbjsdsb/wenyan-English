import { type Page, expect, test } from '@playwright/test'

async function waitForResult(page: Page, key: string) {
  await page.waitForFunction((name: string) => Boolean((window as unknown as Record<string, unknown>)[name]), key)
  return page.evaluate((name: string) => (window as unknown as Record<string, unknown>)[name], key)
}

test('unclaimed events require explicit ownership before sync and failed events back off', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      import * as queue from '/src/sync/learningQueue.ts'

      await db.learningEvents.clear()
      const now = Date.now()
      const event = {
        id: '11111111-1111-4111-8111-111111111111',
        eventType: 'chapter_completed',
        occurredAt: now,
        syncState: 'pending',
        syncAttempts: 0,
        payload: { dict: 'cet4', chapter: 0 },
      }
      await db.learningEvents.add(event)

      const beforeClaim = await queue.getReadyLearningEvents('user-a', 100, now)
      const claimed = await queue.claimUnownedLearningEvents('user-a')
      const afterClaim = await queue.getReadyLearningEvents('user-a', 100, now)
      const otherAccount = await queue.getReadyLearningEvents('user-b', 100, now)

      await queue.markLearningEventsFailed([event.id], new Error('network down'), now)
      const immediatelyReady = await queue.getReadyLearningEvents('user-a', 100, now)
      const retryDelay = queue.calculateRetryDelayMs(1)
      const readyAfterBackoff = await queue.getReadyLearningEvents('user-a', 100, now + retryDelay + 1)
      const stored = await db.learningEvents.get(event.id)

      window.__syncQueueResult = {
        beforeClaim: beforeClaim.length,
        claimed,
        afterClaim: afterClaim.length,
        otherAccount: otherAccount.length,
        immediatelyReady: immediatelyReady.length,
        readyAfterBackoff: readyAfterBackoff.length,
        retryDelay,
        attempts: stored?.syncAttempts,
        owner: stored?.ownerUserId,
        syncState: stored?.syncState,
      }
    `,
  })

  const result = (await waitForResult(page, '__syncQueueResult')) as Record<string, unknown>
  expect(result.beforeClaim).toBe(0)
  expect(result.claimed).toBe(1)
  expect(result.afterClaim).toBe(1)
  expect(result.otherAccount).toBe(0)
  expect(result.immediatelyReady).toBe(0)
  expect(result.readyAfterBackoff).toBe(1)
  expect(result.retryDelay).toBe(30_000)
  expect(result.attempts).toBe(1)
  expect(result.owner).toBe('user-a')
  expect(result.syncState).toBe('failed')
})

test('new learning events inherit only the locally authenticated owner marker', async ({ page }) => {
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { createLearningEvent } from '/src/learning/types.ts'
      import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'

      setLocalLearningOwnerId(null)
      const anonymous = createLearningEvent('chapter_completed', {})
      setLocalLearningOwnerId('user-a')
      const owned = createLearningEvent('chapter_completed', {})
      setLocalLearningOwnerId(null)

      window.__syncOwnerResult = { anonymous: anonymous.ownerUserId ?? null, owned: owned.ownerUserId ?? null }
    `,
  })

  const result = (await waitForResult(page, '__syncOwnerResult')) as Record<string, unknown>
  expect(result.anonymous).toBeNull()
  expect(result.owned).toBe('user-a')
})
