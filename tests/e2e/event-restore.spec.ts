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

  const v2 = {
    ...makeWord('55555555-5555-4555-8555-555555555555', 'linked'),
    source_version: 2,
    created_at: '2026-10-07T00:00:01.123456+00:00',
    payload: {
      ...first.payload,
      word: 'linked',
      dictationEnabled: true,
      dictationType: 'hideAll',
      taskRunId: 'run-1',
      planId: 'test-plan',
      taskId: 'first',
      planRevision: 7,
      taskFingerprint: 'chapter:cet4:0',
    },
  }
  const insertedV2 = await storePulledLearningEventPage('user-a', [v2])
  const restoredV2 = await db.learningEvents.get(v2.id)
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
    insertedV2,
    count,
    v2SourceVersion: restoredV2?.sourceVersion,
    v2TaskRunId: restoredV2?.payload?.taskRunId,
    v2PlanId: restoredV2?.payload?.planId,
    v2TaskId: restoredV2?.payload?.taskId,
    v2PlanRevision: restoredV2?.payload?.planRevision,
    v2TaskFingerprint: restoredV2?.payload?.taskFingerprint,
    v2DictationEnabled: restoredV2?.payload?.dictationEnabled,
    v2DictationType: restoredV2?.payload?.dictationType,
    cursorEventId: cursorBeforeConflict?.eventId,
    cursorCreatedAt: cursorBeforeConflict?.createdAt,
    conflictMessage,
    conflictOwner: conflictEvent?.ownerUserId,
    cursorStableAfterConflict: cursorAfterConflict?.eventId === cursorBeforeConflict?.eventId,
    unsupportedMessage,
    cursorStableAfterUnsupported: cursorAfterUnsupported?.eventId === cursorBeforeConflict?.eventId,
  }
`

test('restored facts are idempotent, versioned, and cursor updates atomically', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: moduleScript })
  await page.waitForFunction(() => Boolean((window as unknown as { __eventRestoreResult?: unknown }).__eventRestoreResult))
  const result = await page.evaluate(() => (window as unknown as { __eventRestoreResult: Record<string, unknown> }).__eventRestoreResult)

  expect(result.insertedFirst).toBe(2)
  expect(result.insertedAgain).toBe(0)
  expect(result.insertedV2).toBe(1)
  expect(result.count).toBe(3)
  expect(result.v2SourceVersion).toBe(2)
  expect(result.v2TaskRunId).toBe('run-1')
  expect(result.v2PlanId).toBe('test-plan')
  expect(result.v2TaskId).toBe('first')
  expect(result.v2PlanRevision).toBe(7)
  expect(result.v2TaskFingerprint).toBe('chapter:cet4:0')
  expect(result.v2DictationEnabled).toBe(true)
  expect(result.v2DictationType).toBe('hideAll')
  expect(result.cursorEventId).toBe('55555555-5555-4555-8555-555555555555')
  expect(result.cursorCreatedAt).toBe('2026-10-07T00:00:01.123456+00:00')
  expect(result.conflictMessage).toContain('跨账号')
  expect(result.conflictOwner).toBe('user-b')
  expect(result.cursorStableAfterConflict).toBe(true)
  expect(result.unsupportedMessage).toContain('不支持')
  expect(result.cursorStableAfterUnsupported).toBe(true)
})
