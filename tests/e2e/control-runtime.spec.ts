import { expect, test } from '@playwright/test'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test('control runtime keeps a stable session device id when its localStorage key is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.getItem = function (key: string) {
      if (key === 'wenyanDeviceId') throw new DOMException('blocked', 'SecurityError')
      return originalGetItem.call(this, key)
    }
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'wenyanDeviceId') throw new DOMException('blocked', 'SecurityError')
      return originalSetItem.call(this, key, value)
    }
  })
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/today')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { getWenyanDeviceId } from '/src/control/deviceId.ts'
      window.__controlDeviceIdResult = {
        first: getWenyanDeviceId(),
        second: getWenyanDeviceId(),
      }
    `,
  })

  await page.waitForFunction(() => Boolean((window as unknown as { __controlDeviceIdResult?: unknown }).__controlDeviceIdResult))
  const result = await page.evaluate(() => (window as unknown as { __controlDeviceIdResult: { first?: string; second?: string } }).__controlDeviceIdResult)
  expect(result.first).toMatch(UUID_PATTERN)
  expect(result.second).toBe(result.first)
  await expect(page.locator('body')).toBeVisible()
})
