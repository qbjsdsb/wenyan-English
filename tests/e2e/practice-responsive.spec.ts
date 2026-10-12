import { expect, test } from '@playwright/test'

test('Practice keeps all four specialist modes discoverable in a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 490, height: 800 })
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({
    json: [
      { name: 'alpha', trans: ['阿尔法，开端'], usphone: '', ukphone: '' },
      { name: 'beta', trans: ['贝塔，第二'], usphone: '', ukphone: '' },
      { name: 'gamma', trans: ['伽马，第三'], usphone: '', ukphone: '' },
      { name: 'delta', trans: ['德尔塔，变化量'], usphone: '', ukphone: '' },
    ],
  }))
  await page.addInitScript(() => { localStorage.setItem('currentDict', JSON.stringify('cet4')) })

  await page.goto('/practice')
  await expect(page.getByRole('heading', { name: '专项训练' })).toBeVisible()

  const tabs = page.locator('.wenyan-practice-tabs')
  await expect(tabs).toBeVisible()
  await expect(tabs.getByRole('radio')).toHaveCount(4)

  for (const title of ['拼写', '词义回想', '选择词义', '看义写词']) {
    await expect(tabs.getByText(title, { exact: true })).toBeVisible()
  }

  const layout = await tabs.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const columns = getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean)
    return {
      columns: columns.length,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
    }
  })

  expect(layout.columns).toBe(2)
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1)
})
