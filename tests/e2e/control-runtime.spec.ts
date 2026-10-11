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
