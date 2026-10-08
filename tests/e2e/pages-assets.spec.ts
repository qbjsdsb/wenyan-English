import { expect, test } from '@playwright/test'

const dictionaryPath = '/wenyan-English/dicts/2025KaoYanHongBaoShu.json'

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenEnhancedPromotion', 'true')
    localStorage.setItem('dismissStartCardDate', JSON.stringify(new Date().toISOString()))
    localStorage.setItem('pronunciation', JSON.stringify({ isOpen: false, volume: 0, type: 'us' }))
    localStorage.setItem('currentDict', JSON.stringify('2025KaoYanHongBaoShu'))
  })
})

test('production Pages artifact loads real vocabulary and local sound assets', async ({ page, request }) => {
  const words = await request.get(dictionaryPath)
  expect(words.ok()).toBe(true)
  expect(words.headers()['content-type']).toContain('application/json')
  const dictionary = await words.json()
  expect(dictionary.length).toBeGreaterThan(100)
  const sound = await request.get('/wenyan-English/sounds/beep.wav')
  expect(sound.ok()).toBe(true)
  expect(sound.headers()['content-type']).not.toContain('text/html')

  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  await page.goto('/wenyan-English/today')
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeEnabled()
  expect(requests).toContain(dictionaryPath)
  expect(requests.some((path) => path.startsWith('/qwerty-learner/'))).toBe(false)
  await page.getByRole('link', { name: '练习', exact: true }).click()
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始', exact: true })).toBeEnabled()
})

for (const failure of [
  { name: '404 HTML', status: 404, contentType: 'text/html', body: '<!DOCTYPE html><html>Not found</html>' },
  { name: '200 HTML fallback', status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html>SPA fallback</html>' },
  { name: 'malformed JSON', status: 200, contentType: 'application/json', body: '{' },
  { name: 'invalid schema', status: 200, contentType: 'application/json', body: '{"words":[]}' },
  { name: 'empty vocabulary', status: 200, contentType: 'application/json', body: '[]' },
]) {
  test(`practice exposes ${failure.name} and recovers on explicit retry`, async ({ page }) => {
    await page.route(`**${dictionaryPath}`, (route) => route.fulfill(failure))
    await page.goto('/wenyan-English/')
    await expect(page.getByRole('alert')).toContainText('词库暂时无法加载')
    await expect(page.getByRole('button', { name: '开始', exact: true })).toBeDisabled()
    await expect(page.getByRole('status')).toHaveCount(0)
    await page.unroute(`**${dictionaryPath}`)
    await page.getByRole('button', { name: '重新加载词库', exact: true }).click()
    await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '开始', exact: true })).toBeEnabled()
  })
}

test('Today ends failed preparation and retries using the real dictionary', async ({ page }) => {
  await page.route(`**${dictionaryPath}`, (route) => route.fulfill({ status: 404, contentType: 'text/html', body: '<!DOCTYPE html>' }))
  await page.goto('/wenyan-English/today')
  const dock = page.getByRole('region', { name: '智能学习' })
  await expect(dock.getByRole('heading')).toHaveText('暂时无法安排下一段学习。')
  await expect(dock.getByRole('alert')).toContainText('HTTP 404')
  const retry = dock.getByRole('button', { name: '重新安排', exact: true })
  await expect(retry).toBeEnabled()
  await page.unroute(`**${dictionaryPath}`)
  await retry.click()
  await expect(dock.getByRole('button', { name: '开始学习', exact: true })).toBeEnabled()
  await expect(dock.getByRole('alert')).toHaveCount(0)
})
