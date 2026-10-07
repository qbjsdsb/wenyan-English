import { expect, test } from '@playwright/test'

test('OAuth consent route is preserved on mobile and rejects a missing authorization id', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/oauth/consent')

  await expect(page).toHaveURL(/\/oauth\/consent$/)
  await expect(page.getByRole('heading', { name: '连接你的学习数据' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '授权链接无效' })).toBeVisible()
  await expect(page.getByText(/authorization_id/)).toBeVisible()
})
