import { expect, test } from '@playwright/test'

const moduleScript = `
  import { db } from '/src/utils/db/index.ts'
  import { storePulledLearningEventPage } from '/src/sync/pullLearningEvents.ts'

  await db.learningEvents.clear()
  await db.learningSyncCursors.clear()

  const createdAt = '2026-10-07T00:00:00.123456+00:00'
  const makeWord = (id, word) => ({
    id,
    event_type: 'word_attempted',
    occurred_at: '2026-10-07T00:00:00.000Z',
    source: 'wenyan-english',
    source_version: 1,
    created_at: createdAt,
    payload: {
      word,
      dict: 'cet4',
      chapter: 0,
      reviewMode: false,
      wrongCount: 0,
      durationMs: 420,
      timing: [120, 140, 160],
      mistakes: {},
    },
  })

  const first = makeWord('11111111-1111-4111-8111-111111111111', 'first')
  const second = makeWord('22222222-2222-4222-8222-222222222222', 'second')
  const insertedFirst = await storePulledLearningEventPage('user-a', [first, second])
  const insertedAgain = await storePulledLearningEventPage('user-a', [first, second])
  const count = await db.learningEvents.count()
  const cursorBeforeConflict = await db.learningSyncCursors.get('user-a')

  const conflictId = '33333333-3333-4333-8333-333333333333'
  await db.learningEvents.put({
    id: conflictId,
    eventType: 'word_attempted',
    occurredAt: Date.now(),
    syncState: 'pending',
    syncAttempts: 0,
    ownerUserId: 'user-b',
    payload: first.payload,
  })

  let conflictMessage = ''
  try {
    await storePulledLearningEventPage('user-a', [makeWord(conflictId, 'conflict')])
  } catch (error) {
    conflictMessage = error instanceof Error ? error.message : String(error)
  }

  const cursorAfterConflict = await db.learningSyncCursors.get('user-a')
  const conflictEvent = await db.learningEvents.get(conflictId)

  let unsupportedMessage = ''
  try {
    await storePulledLearningEventPage('user-a', [{ ...second, id: '44444444-4444-4444-8444-444444444444', source_version: 99 }])
  } catch (error) {
    unsupportedMessage = error instanceof Error ? error.message : String(error)
  }
  const cursorAfterUnsupported = await db.learningSyncCursors.get('user-a')

  window.__eventRestoreResult = {
    insertedFirst,
    insertedAgain,
    count,
    cursorEventId: cursorBeforeConflict?.eventId,
    cursorCreatedAt: cursorBeforeConflict?.createdAt,
    conflictMessage,
    conflictOwner: conflictEvent?.ownerUserId,
    cursorStableAfterConflict: cursorAfterConflict?.eventId === cursorBeforeConflict?.eventId,
    unsupportedMessage,
    cursorStableAfterUnsupported: cursorAfterUnsupported?.eventId === cursorBeforeConflict?.eventId,
  }
`

test('restored facts are idempotent and cursor updates atomically', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: moduleScript })
  await page.waitForFunction(() => Boolean((window as unknown as { __eventRestoreResult?: unknown }).__eventRestoreResult))
  const result = await page.evaluate(() => (window as unknown as { __eventRestoreResult: Record<string, unknown> }).__eventRestoreResult)

  expect(result.insertedFirst).toBe(2)
  expect(result.insertedAgain).toBe(0)
  expect(result.count).toBe(2)
  expect(result.cursorEventId).toBe('22222222-2222-4222-8222-222222222222')
  expect(result.cursorCreatedAt).toBe('2026-10-07T00:00:00.123456+00:00')
  expect(result.conflictMessage).toContain('跨账号')
  expect(result.conflictOwner).toBe('user-b')
  expect(result.cursorStableAfterConflict).toBe(true)
  expect(result.unsupportedMessage).toContain('不支持')
  expect(result.cursorStableAfterUnsupported).toBe(true)
})
