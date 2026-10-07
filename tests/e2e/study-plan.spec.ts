import { expect, test } from '@playwright/test'

const plan = {
  schemaVersion: 1, id: 'test-plan', title: '我的英语计划', timezone: 'Asia/Shanghai',
  tasks: [{ id: 'first', title: '练习第一章', kind: 'chapter', dictId: 'cet4', chapterIndex: 0,
    dueDate: '2026-10-07', estimatedMinutes: 10, reason: '用实际练习建立起点。' }],
}
const words = ['cancel', 'explosive', 'numerous', 'govern', 'analyse', 'discourage', 'resemble', 'remote', 'salary', 'pollution', 'pretend', 'kettle', 'wreck', 'drunk', 'calculate', 'persistent', 'sake', 'conceal', 'audience', 'meanwhile']

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenEnhancedPromotion', 'true')
    localStorage.setItem('dismissStartCardDate', JSON.stringify(new Date().toISOString()))
    localStorage.setItem('pronunciation', JSON.stringify({ isOpen: false, volume: 0, type: 'us' }))
  })
  await page.goto('/today')
  await page.getByRole('button', { name: '导入计划', exact: true }).click()
})

test('rejects invalid instructions and cannot import fake completion', async ({ page }) => {
  const textarea = page.getByLabel('粘贴计划 JSON')
  await textarea.fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], dueDate: '2026-02-30' }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByRole('status')).toContainText('真实的 YYYY-MM-DD')
  await textarea.fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], chapterIndex: -1 }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByRole('status')).toContainText('chapterIndex')
  await textarea.fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], status: 'completed', completionEventId: 'invented' }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByRole('button', { name: '开始任务' })).toBeVisible()
  await expect(page.getByText('已完成 ✓', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '导入计划', exact: true }).click()
  await textarea.fill(JSON.stringify(plan))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByRole('status')).toContainText('已经保存')
  await page.reload()
  await expect(page.getByRole('heading', { name: plan.title })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始任务' })).toHaveCount(1)
})

test('a plan launches the right chapter and only real completed practice updates progress', async ({ page }) => {
  await page.getByLabel('粘贴计划 JSON').fill(JSON.stringify(plan))
  await page.getByRole('button', { name: '保存计划' }).click()
  await page.getByRole('button', { name: '开始任务' }).click()
  await expect(page).toHaveURL(/taskRun=/)
  const runUrl = page.url()
  await page.getByRole('link', { name: '今日学习', exact: true }).click()
  await expect(page.getByText('已完成 ✓', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '重新开始' })).toBeVisible()
  await page.goto(runUrl)
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')
  for (const word of words) {
    await page.keyboard.type(word, { delay: 35 })
    await page.waitForTimeout(320)
  }
  await expect(page.getByText('表现不错！全对了！')).toBeVisible()
  await page.getByRole('link', { name: '今日学习', exact: true }).click()
  await expect(page.getByText('已完成 ✓', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('已完成 ✓', { exact: true })).toBeVisible()
})

test('navigation remains on the current page when the desktop window resizes', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await expect(page).toHaveURL(/\/today$/)
  await page.getByRole('button', { name: '切换深色' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({ path: 'test-results/today-dark.png', fullPage: true })
})
