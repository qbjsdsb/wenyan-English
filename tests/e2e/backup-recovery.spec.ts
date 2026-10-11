import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('failed backup import preserves data, unlocks controls, and allows a valid retry', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: [{ name: 'alpha', trans: ['开端'], usphone: '', ukphone: '' }] }))
  await page.addInitScript(() => localStorage.setItem('currentDict', JSON.stringify('cet4')))
  await page.goto('/')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    await db.learningEvents.add(createLearningEvent('word_attempted', {
      word: 'alpha', dict: 'cet4', chapter: 0, reviewMode: false, wrongCount: 0, durationMs: 100, timing: [], mistakes: {}
    }))
    window.__backupSeeded = true
  ` })
  await page.waitForFunction(() => (window as any).__backupSeeded)
  await page.getByRole('button', { name: '学习设置', exact: true }).click()
  await page.getByRole('button', { name: '打开学习设置' }).click()
  await page.getByRole('tab', { name: /本机数据/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出本机数据' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^Wenyan-Backup-.*\.gz$/)
  const backup = await readFile((await download.path())!)
  const input = page.getByLabel('选择 Wenyan 备份')
  await input.setInputFiles({ name: 'broken.gz', mimeType: 'application/gzip', buffer: Buffer.from('not a gzip backup') })
  await expect(page.getByRole('alert')).toContainText('备份无法读取')
  await expect(page.getByRole('button', { name: '选择备份并导入' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '再次导出' })).toBeEnabled()
  expect(await page.evaluate("import('/src/utils/db/index.ts').then(({ db }) => db.learningEvents.count())")).toBe(1)
  // Re-select the same invalid file; the input must have been reset.
  await input.setInputFiles({ name: 'broken.gz', mimeType: 'application/gzip', buffer: Buffer.from('not a gzip backup') })
  await expect(page.getByRole('alert')).toContainText('备份无法读取')
  await input.setInputFiles({ name: 'valid.gz', mimeType: 'application/gzip', buffer: backup })
  await expect(page.getByRole('button', { name: '刷新并载入恢复的数据' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: '刷新并载入恢复的数据' }).click()
  await expect(page.getByRole('button', { name: '学习设置', exact: true })).toBeVisible()
  expect(await page.evaluate("import('/src/utils/db/index.ts').then(({ db }) => db.learningEvents.count())")).toBe(1)
})
