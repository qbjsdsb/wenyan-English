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
  await expect(page.getByText(/真实的 YYYY-MM-DD/)).toBeVisible()
  await textarea.fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], chapterIndex: -1 }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByText(/chapterIndex/)).toBeVisible()
  await textarea.fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], status: 'completed', completionEventId: 'invented' }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByRole('button', { name: '开始任务' })).toBeVisible()
  await expect(page.getByText('已完成 ✓', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '导入计划', exact: true }).click()
  await textarea.fill(JSON.stringify(plan))
  await page.getByRole('button', { name: '保存计划' }).click()
  await expect(page.getByText(/已经保存/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: plan.title })).toBeVisible()
  await page.screenshot({ path: 'test-results/today-light.png', fullPage: true })
  await expect(page.getByRole('button', { name: '开始任务' })).toHaveCount(1)
})

test('a plan launches the right chapter and only real completed practice updates progress', async ({ page }) => {
  await page.getByLabel('粘贴计划 JSON').fill(JSON.stringify(plan))
  await page.getByRole('button', { name: '保存计划' }).click()
  await page.getByRole('button', { name: '开始任务' }).click()
  await expect(page).toHaveURL(/taskRun=/)
  const runUrl = page.url()
  const runId = new URL(runUrl).searchParams.get('taskRun')
  expect(runId).toBeTruthy()
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
  await page.getByRole('button', { name: '返回今日学习' }).click()
  await expect(page.getByText('已完成 ✓', { exact: true })).toBeVisible()

  await page.addScriptTag({
    type: 'module',
    content: `
      import { db } from '/src/utils/db/index.ts'
      const events = await db.learningEvents.toArray()
      const wordFacts = events.filter(event => event.eventType === 'word_attempted')
      const chapterFact = events.find(event => event.eventType === 'chapter_completed')
      window.__planFactResult = {
        wordCount: wordFacts.length,
        allWordsV2: wordFacts.every(event => event.sourceVersion === 2),
        allWordsLinked: wordFacts.every(event => event.payload.planId === 'test-plan' && event.payload.taskId === 'first' && event.payload.taskRunId),
        wordRunIds: [...new Set(wordFacts.map(event => event.payload.taskRunId))],
        rawDictationCaptured: wordFacts.every(event => event.payload.dictationEnabled === false && event.payload.dictationType === 'hideAll'),
        chapterVersion: chapterFact?.sourceVersion,
        chapterPlanId: chapterFact?.payload?.planId,
        chapterTaskId: chapterFact?.payload?.taskId,
        chapterTaskRunId: chapterFact?.payload?.taskRunId,
      }
    `,
  })
  await page.waitForFunction(() => Boolean((window as unknown as { __planFactResult?: unknown }).__planFactResult))
  const factResult = await page.evaluate(() => (window as unknown as { __planFactResult: Record<string, unknown> }).__planFactResult)
  expect(factResult.wordCount).toBe(words.length)
  expect(factResult.allWordsV2).toBe(true)
  expect(factResult.allWordsLinked).toBe(true)
  expect(factResult.wordRunIds).toEqual([runId])
  expect(factResult.rawDictationCaptured).toBe(true)
  expect(factResult.chapterVersion).toBe(2)
  expect(factResult.chapterPlanId).toBe('test-plan')
  expect(factResult.chapterTaskId).toBe('first')
  expect(factResult.chapterTaskRunId).toBe(runId)

  await page.reload()
  await expect(page.getByText('已完成 ✓', { exact: true })).toBeVisible()
})

test('a different chapter cannot complete the assigned task', async ({ page }) => {
  await page.route('**/dicts/CET6_T.json', (route) => route.fulfill({ json: Array.from({ length: 21 }, () => ({ name: 'test', trans: ['测试'], usphone: '', ukphone: '' })) }))
  await page.getByLabel('粘贴计划 JSON').fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], dictId: 'cet6' }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await page.getByRole('button', { name: '开始任务' }).click()
  await expect(page).toHaveURL(/taskRun=/)
  await page.evaluate(() => localStorage.setItem('currentChapter', '1'))
  await page.reload()
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('test', { delay: 50 })
  await expect(page.getByText('表现不错！全对了！')).toBeVisible()
  await page.getByRole('button', { name: '返回今日学习' }).click()
  await expect(page.getByText('已完成 ✓', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '重新开始' })).toBeVisible()
})

test('skipping a word does not finish a plan task', async ({ page }) => {
  await page.route('**/dicts/CET6_T.json', (route) => route.fulfill({ json: ['go', 'end'].map((name) => ({ name, trans: ['测试'], usphone: '', ukphone: '' })) }))
  await page.getByLabel('粘贴计划 JSON').fill(JSON.stringify({ ...plan, tasks: [{ ...plan.tasks[0], dictId: 'cet6' }] }))
  await page.getByRole('button', { name: '保存计划' }).click()
  await page.getByRole('button', { name: '开始任务' }).click()
  await expect(page.getByText('按任意键开始', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('go', { delay: 50 })
  await page.waitForTimeout(400)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('x')
    await page.waitForTimeout(400)
  }
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: '返回今日学习' }).click()
  await expect(page.getByText('已完成 ✓', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '重新开始' })).toBeVisible()
})

test('navigation remains on the current page when the desktop window resizes', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await expect(page).toHaveURL(/\/today$/)
  await page.getByRole('button', { name: '切换深色' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({ path: 'test-results/today-dark.png', fullPage: true })
})
