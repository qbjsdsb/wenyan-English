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

test('sourceVersion 5 objective semantic facts restore through the cloud-pull parser', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      import { storePulledLearningEventPage } from '/src/sync/pullLearningEvents.ts'

      await db.learningEvents.clear()
      await db.learningSyncCursors.clear()
      const versions = ['1', '2', '3', '4'].map((digit) => 'sha256:' + digit.repeat(64))
      const row = {
        id: '55555555-5555-4555-8555-555555555555',
        event_type: 'semantic_discrimination_attempted',
        occurred_at: '2026-10-09T00:00:00.000Z',
        created_at: '2026-10-09T00:00:01.000Z',
        source: 'wenyan-english',
        source_version: 5,
        payload: {
          domain: 'english', activity: 'semantic_discrimination', measurement: 'reference_meaning_discrimination', direction: 'en_to_meaning',
          contentId: 'semantic:cet4:alpha', contentVersion: versions[0], dictionaryId: 'cet4', word: 'alpha',
          sessionId: 'session', blockId: 'block', cue: 'word_only', responseMode: 'single_choice',
          options: ['alpha', 'beta', 'gamma', 'delta'].map((word, index) => ({ contentId: 'semantic:cet4:' + word, contentVersion: versions[index] })),
          selectedContentId: 'semantic:cet4:alpha', correctContentId: 'semantic:cet4:alpha', isCorrect: true,
        },
      }
      const inserted = await storePulledLearningEventPage('user-a', [row])
      const stored = await db.learningEvents.get(row.id)
      const cursor = await db.learningSyncCursors.get('user-a')
      window.__objectivePullResult = {
        inserted,
        eventType: stored?.eventType,
        sourceVersion: stored?.sourceVersion,
        owner: stored?.ownerUserId,
        syncState: stored?.syncState,
        measurement: stored?.payload?.measurement,
        isCorrect: stored?.payload?.isCorrect,
        cursorEventId: cursor?.eventId,
      }
    `,
  })

  const result = (await waitForResult(page, '__objectivePullResult')) as Record<string, unknown>
  expect(result).toEqual({
    inserted: 1,
    eventType: 'semantic_discrimination_attempted',
    sourceVersion: 5,
    owner: 'user-a',
    syncState: 'synced',
    measurement: 'reference_meaning_discrimination',
    isCorrect: true,
    cursorEventId: '55555555-5555-4555-8555-555555555555',
  })
})

test('learning sync RPCs bind upload and pull to the captured owner', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { supabase } from '/src/supabase/client.ts'
      import { db } from '/src/utils/db/index.ts'
      import { syncLearningEventsForOwner } from '/src/sync/syncLearningEvents.ts'
      import { pullLearningEventsForOwner } from '/src/sync/pullLearningEvents.ts'

      await db.learningEvents.clear()
      await db.learningSyncCursors.clear()
      await db.learningEvents.add({
        id: '77777777-7777-4777-8777-777777777777',
        eventType: 'word_attempted',
        occurredAt: Date.now(),
        syncState: 'pending',
        syncAttempts: 0,
        ownerUserId: 'user-a',
        sourceVersion: 2,
        payload: { word: 'alpha', dict: 'cet4', chapter: 0, reviewMode: false, wrongCount: 0, durationMs: 120, timing: [120], mistakes: {}, dictationEnabled: false, dictationType: 'hideAll' },
      })

      const calls = []
      const originalRpc = supabase.rpc.bind(supabase)
      supabase.rpc = async (name, args) => {
        calls.push({ name, args })
        if (name === 'ingest_learning_events_for_owner') return { data: 1, error: null }
        if (name === 'pull_learning_events_for_owner') return { data: [], error: null }
        return { data: null, error: null }
      }

      try {
        await syncLearningEventsForOwner('user-a')
        await pullLearningEventsForOwner('user-a', 20, 1)
      } finally {
        supabase.rpc = originalRpc
      }

      window.__ownerBoundSyncResult = calls
    `,
  })

  const calls = await waitForResult(page, '__ownerBoundSyncResult') as Array<{ name: string; args: Record<string, unknown> }>
  expect(calls).toHaveLength(2)
  expect(calls[0].name).toBe('ingest_learning_events_for_owner')
  expect(calls[0].args.p_expected_user_id).toBe('user-a')
  expect(calls[1]).toEqual({
    name: 'pull_learning_events_for_owner',
    args: {
      p_expected_user_id: 'user-a',
      p_after_created_at: null,
      p_after_id: null,
      p_limit: 20,
    },
  })
})

test('auth initialization gate rejects an older session result after auth changes', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { createAuthInitializationGate } from '/src/sync/authOwner.ts'
      const gate = createAuthInitializationGate()
      const initial = gate.ticket()
      gate.authChanged()
      const staleAccepted = gate.accepts(initial)
      const current = gate.ticket()
      window.__authGateResult = { staleAccepted, currentAccepted: gate.accepts(current) }
    `,
  })

  expect(await waitForResult(page, '__authGateResult')).toEqual({ staleAccepted: false, currentAccepted: true })
})
