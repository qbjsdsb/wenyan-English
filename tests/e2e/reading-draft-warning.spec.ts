import { expect, test } from '@playwright/test'

test('reading keeps draft-save warning visible after an account-switch notice', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wenyanLearningOwnerId', 'owner-a')
  })
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.goto('/reading/wenyan-demo-reading-01')

  await page.addScriptTag({
    type: 'module',
    content: `
      import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'
      window.__switchReadingOwner = (owner) => setLocalLearningOwnerId(owner)
    `,
  })

  await page.evaluate(() => {
    const controls = window as unknown as { __switchReadingOwner: (owner: string) => void }
    controls.__switchReadingOwner('owner-b')
  })
  await expect(page.getByText('账号已切换。已为当前账号重新读取独立的阅读草稿。')).toBeVisible()

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key.startsWith('wenyanReadingDraft:')) {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      return originalSetItem.call(this, key, value)
    }
  })

  await page.locator('input[name="q1"][value="B"]').check()

  await expect(page.getByText('账号已切换。已为当前账号重新读取独立的阅读草稿。')).toBeVisible()
  await expect(page.getByText('草稿暂时无法保存；请保持此页打开，完成后提交。')).toBeVisible()
})
