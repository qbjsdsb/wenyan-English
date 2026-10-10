import { type Page, expect, test } from '@playwright/test'

async function waitForResult(page: Page, key: string) {
  await page.waitForFunction((name: string) => Boolean((window as unknown as Record<string, unknown>)[name]), key)
  return page.evaluate((name: string) => (window as unknown as Record<string, unknown>)[name], key)
}

async function callWorkspaceHarness(page: Page, method: string, argument?: string) {
  return page.evaluate(({ method, argument }) => {
    const harness = (window as unknown as {
      __workspaceHarness: Record<string, (value?: string) => unknown>
    }).__workspaceHarness
    return harness[method](argument)
  }, { method, argument })
}

test('workspace request gate rejects stale account and pre-write reads', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { createWorkspaceRequestGate } from '/src/sync/workspaceState.ts'

      const gate = createWorkspaceRequestGate()
      const initialA = gate.begin('user-a')
      const afterAccountSwap = gate.begin('user-b')
      const staleAccountAccepted = gate.accepts(initialA, 'user-b')
      const currentBWasAccepted = gate.accepts(afterAccountSwap, 'user-b')

      const readBeforeWrite = gate.begin('user-b')
      gate.invalidate()
      const staleReadAfterWriteAccepted = gate.accepts(readBeforeWrite, 'user-b')
      const readAfterWrite = gate.begin('user-b')
      const freshReadAccepted = gate.accepts(readAfterWrite, 'user-b')

      window.__workspaceGateResult = {
        staleAccountAccepted,
        currentBWasAccepted,
        staleReadAfterWriteAccepted,
        freshReadAccepted,
      }
    `,
  })

  expect(await waitForResult(page, '__workspaceGateResult')).toEqual({
    staleAccountAccepted: false,
    currentBWasAccepted: true,
    staleReadAfterWriteAccepted: false,
    freshReadAccepted: true,
  })
})

test('workspace RPC helpers bind every read and write to the captured owner', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { supabase } from '/src/supabase/client.ts'
      import { getWorkspaceState, saveWorkspaceState } from '/src/sync/workspaceState.ts'

      const calls = []
      const originalRpc = supabase.rpc.bind(supabase)
      supabase.rpc = async (name, args) => {
        calls.push({ name, args })
        return {
          data: {
            schemaVersion: 1,
            dictId: 'cet4',
            chapterIndex: 2,
            practiceMode: 'recall',
            practicePool: 'chapter',
            practiceLimit: 6,
            updatedAt: '2026-10-10T00:00:00.000Z',
          },
          error: null,
        }
      }

      try {
        await getWorkspaceState('user-a')
        await saveWorkspaceState('user-a', {
          dictId: 'cet4',
          chapterIndex: 2,
          practiceMode: 'recall',
          practicePool: 'chapter',
          practiceLimit: 6,
        })
      } finally {
        supabase.rpc = originalRpc
      }

      window.__workspaceRpcResult = calls
    `,
  })

  const result = await waitForResult(page, '__workspaceRpcResult') as Array<{ name: string; args: Record<string, unknown> }>
  expect(result).toHaveLength(2)
  expect(result[0]).toEqual({
    name: 'get_wenyan_workspace_state',
    args: { p_expected_user_id: 'user-a' },
  })
  expect(result[1]).toEqual({
    name: 'save_wenyan_workspace_state',
    args: {
      p_expected_user_id: 'user-a',
      p_dict_id: 'cet4',
      p_chapter_index: 2,
      p_practice_mode: 'recall',
      p_practice_pool: 'chapter',
      p_practice_limit: 6,
    },
  })
})

test('local workspace persistence rolls back a partial storage failure', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { persistLocalWorkspace } from '/src/sync/workspaceState.ts'
      import { practiceChoicesStorageKey } from '/src/semantic/practiceChoices.ts'

      const owner = 'user-a'
      localStorage.setItem('currentDict', JSON.stringify('cet6'))
      localStorage.setItem('currentChapter', JSON.stringify(4))
      localStorage.setItem(practiceChoicesStorageKey(owner), JSON.stringify({ mode: 'spelling', pool: 'learned', limit: 12 }))

      const originalSetItem = Storage.prototype.setItem
      let workspaceWriteCount = 0
      Storage.prototype.setItem = function (key, value) {
        if (key === 'currentDict' || key === 'currentChapter' || key === practiceChoicesStorageKey(owner)) {
          workspaceWriteCount += 1
          if (workspaceWriteCount === 2) throw new DOMException('quota test', 'QuotaExceededError')
        }
        return originalSetItem.call(this, key, value)
      }

      const result = persistLocalWorkspace(owner, {
        schemaVersion: 1,
        dictId: 'cet4',
        chapterIndex: 8,
        practiceMode: 'recall',
        practicePool: 'uncertain',
        practiceLimit: 6,
        updatedAt: '2026-10-10T00:00:00.000Z',
      })
      Storage.prototype.setItem = originalSetItem

      window.__workspaceRollbackResult = {
        ok: result.ok,
        rollbackOk: result.ok ? null : result.rollbackOk,
        dict: JSON.parse(localStorage.getItem('currentDict')),
        chapter: JSON.parse(localStorage.getItem('currentChapter')),
        choices: JSON.parse(localStorage.getItem(practiceChoicesStorageKey(owner))),
      }
    `,
  })

  expect(await waitForResult(page, '__workspaceRollbackResult')).toEqual({
    ok: false,
    rollbackOk: true,
    dict: 'cet6',
    chapter: 4,
    choices: { mode: 'spelling', pool: 'learned', limit: 12 },
  })
})

test('a complete local workspace persists across reload', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { persistLocalWorkspace } from '/src/sync/workspaceState.ts'
      window.__workspacePersistResult = persistLocalWorkspace('user-a', {
        schemaVersion: 1,
        dictId: 'cet4',
        chapterIndex: 7,
        practiceMode: 'discrimination',
        practicePool: 'uncertain',
        practiceLimit: 12,
        updatedAt: '2026-10-10T00:00:00.000Z',
      }).ok
    `,
  })
  expect(await waitForResult(page, '__workspacePersistResult')).toBe(true)

  await page.reload()
  const restored = await page.evaluate(() => ({
    dict: JSON.parse(localStorage.getItem('currentDict') ?? 'null'),
    chapter: JSON.parse(localStorage.getItem('currentChapter') ?? 'null'),
    choices: JSON.parse(localStorage.getItem('wenyanPracticeChoices:user-a') ?? 'null'),
  }))
  expect(restored).toEqual({
    dict: 'cet4',
    chapter: 7,
    choices: { mode: 'discrimination', pool: 'uncertain', limit: 12 },
  })
})

test('SyncPage orders saves over stale reads, reconciles uncertain saves, and clears state on account failure', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { supabase } from '/src/supabase/client.ts'

      const sessionA = { user: { id: 'user-a', email: 'a@example.com' } }
      const sessionB = { user: { id: 'user-b', email: 'b@example.com' } }
      const workspace = (chapterIndex) => ({
        schemaVersion: 1,
        dictId: 'cet4',
        chapterIndex,
        practiceMode: 'recall',
        practicePool: 'chapter',
        practiceLimit: 6,
        updatedAt: '2026-10-10T00:00:00.000Z',
      })

      let authCallback
      let mode = 'initial'
      let pendingSave
      let pendingRead
      let getCount = 0
      let saveCount = 0

      supabase.auth.getSession = async () => ({ data: { session: sessionA }, error: null })
      supabase.auth.onAuthStateChange = (callback) => {
        authCallback = callback
        return { data: { subscription: { unsubscribe() {} } } }
      }
      supabase.rpc = async (name) => {
        if (name === 'get_wenyan_workspace_state') {
          getCount += 1
          if (mode === 'save-race') {
            return await new Promise((resolve) => { pendingRead = () => resolve({ data: workspace(2), error: null }) })
          }
          if (mode === 'ambiguous') return { data: workspace(9), error: null }
          if (mode === 'account-b-fail') return { data: null, error: { message: 'offline-b' } }
          return { data: workspace(2), error: null }
        }
        if (name === 'save_wenyan_workspace_state') {
          saveCount += 1
          if (mode === 'save-race') {
            return await new Promise((resolve) => { pendingSave = () => resolve({ data: workspace(6), error: null }) })
          }
          if (mode === 'ambiguous') return { data: null, error: { message: 'response-lost' } }
        }
        return { data: null, error: null }
      }

      window.__workspaceHarness = {
        setMode(value) { mode = value },
        fireA() { authCallback?.('TOKEN_REFRESHED', sessionA) },
        fireB() { authCallback?.('SIGNED_IN', sessionB) },
        resolveSave() { pendingSave?.(); pendingSave = null },
        resolveRead() { pendingRead?.(); pendingRead = null },
        hasPendingSave() { return Boolean(pendingSave) },
        hasPendingRead() { return Boolean(pendingRead) },
        getCount() { return getCount },
        saveCount() { return saveCount },
      }
    `,
  })

  await page.getByLabel('同步').click()
  await expect(page.getByText(/云端：.*第 3 章/)).toBeVisible()
  await expect(page.getByRole('button', { name: '恢复云端位置' })).toBeEnabled()

  await callWorkspaceHarness(page, 'setMode', 'save-race')
  await page.getByRole('button', { name: '保存本机位置' }).click()
  await page.waitForFunction(() => Boolean((window as unknown as {
    __workspaceHarness?: { hasPendingSave?: () => boolean }
  }).__workspaceHarness?.hasPendingSave?.()))
  await callWorkspaceHarness(page, 'fireA')
  await page.waitForFunction(() => Boolean((window as unknown as {
    __workspaceHarness?: { hasPendingRead?: () => boolean }
  }).__workspaceHarness?.hasPendingRead?.()))
  await callWorkspaceHarness(page, 'resolveSave')
  await expect(page.getByText(/云端：.*第 7 章/)).toBeVisible()
  await callWorkspaceHarness(page, 'resolveRead')
  await expect(page.getByText(/云端：.*第 7 章/)).toBeVisible()

  await callWorkspaceHarness(page, 'setMode', 'ambiguous')
  await page.getByRole('button', { name: '保存本机位置' }).click()
  await expect(page.getByText('保存结果未能直接确认，已重新读取云端位置。请核对后再继续。')).toBeVisible()
  await expect(page.getByText(/云端：.*第 10 章/)).toBeVisible()
  await expect(page.getByRole('button', { name: '恢复云端位置' })).toBeEnabled()

  await callWorkspaceHarness(page, 'setMode', 'account-b-fail')
  await callWorkspaceHarness(page, 'fireB')
  await expect(page.getByText('b@example.com')).toBeVisible()
  await expect(page.getByText('云端：还没有保存过云端位置')).toBeVisible()
  await expect(page.getByRole('button', { name: '恢复云端位置' })).toBeDisabled()
})
