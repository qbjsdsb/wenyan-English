import { expect, test } from '@playwright/test'

test('server-side owner switch during preference confirm normalizes to fail-closed refresh signal', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/sync')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { supabase } from '/src/supabase/client.ts'
      import { getLearningPreferences, confirmLearningStage } from '/src/coaching/preferences.ts'

      const originalGetSession = supabase.auth.getSession.bind(supabase.auth)
      const originalGetUser = supabase.auth.getUser.bind(supabase.auth)
      const originalRpc = supabase.rpc.bind(supabase)
      const user = { id: 'user-a' }
      supabase.auth.getSession = async () => ({ data: { session: { user } }, error: null })
      supabase.auth.getUser = async () => ({ data: { user }, error: null })
      supabase.rpc = async (name) => {
        if (name === 'get_learning_preferences_for_owner') {
          return { data: { schemaVersion: 1, learningStage: { current: 'vocabulary', revision: 1, provenance: { kind: 'product_default', ref: 'test', since: null } }, stageReminder: null, confirmedAt: null, updatedAt: null }, error: null }
        }
        if (name === 'confirm_learning_stage_for_owner') {
          return { data: null, error: { message: 'browser_owner_changed' } }
        }
        return { data: null, error: null }
      }

      let message = ''
      try {
        const snapshot = await getLearningPreferences()
        await confirmLearningStage('vocabulary', snapshot)
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      } finally {
        supabase.auth.getSession = originalGetSession
        supabase.auth.getUser = originalGetUser
        supabase.rpc = originalRpc
      }

      window.__preferenceServerOwnerSwitch = message
    `,
  })

  await page.waitForFunction(() => Boolean((window as unknown as { __preferenceServerOwnerSwitch?: string }).__preferenceServerOwnerSwitch))
  expect(await page.evaluate(() => (window as unknown as { __preferenceServerOwnerSwitch: string }).__preferenceServerOwnerSwitch)).toBe('learning_owner_changed')
})
