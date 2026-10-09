import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: [{ name: 'alpha', trans: ['阿尔法，开端'], usphone: '', ukphone: '' }] }))
  await page.addInitScript(() => { localStorage.setItem('currentDict', JSON.stringify('cet4')) })
})

test('Today selects semantic recall, preserves reveal on reload, and writes only a semantic fact', async ({ page }) => {
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    await db.learningEvents.add(createLearningEvent('word_attempted', {
      word: 'alpha', dict: 'cet4', chapter: 0, reviewMode: false, wrongCount: 0, durationMs: 100, timing: [], mistakes: {}
    }))
    window.__semanticSeeded = true
  ` })
  await page.waitForFunction(() => (window as unknown as { __semanticSeeded: boolean }).__semanticSeeded)
  await page.reload()
  await expect(page.getByText('回想 1 个熟悉单词的词义')).toBeVisible()
  await page.getByRole('button', { name: '开始学习', exact: true }).click()
  await expect(page).toHaveURL(/\/semantic\//)
  await expect(page.getByText('阿尔法，开端')).toHaveCount(0)
  await page.getByRole('button', { name: /查看释义/ }).click()
  await expect(page.getByText('阿尔法，开端')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('semantic-reveal.png') })
  await page.reload()
  await expect(page.getByText(/恢复时释义已揭示/)).toBeVisible()
  await page.getByRole('button', { name: '2 想起部分' }).click()
  await expect(page.getByRole('heading', { name: '这一段，已经留下记录。' })).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const events = await db.learningEvents.toArray()
    window.__semanticResult = {
      semantic: events.filter(e => e.eventType === 'semantic_recall_attempted'),
      chapter: events.filter(e => e.eventType === 'chapter_completed').length,
      spelling: events.filter(e => e.eventType === 'word_attempted').length,
      runs: await db.semanticRuns.toArray()
    }
  ` })
  await page.waitForFunction(() => !!(window as unknown as { __semanticResult: unknown }).__semanticResult)
  const result = await page.evaluate(() => (window as unknown as { __semanticResult: {
    semantic: { sourceVersion: number; payload: { rating: string; resumedAfterReveal: boolean } }[]; chapter: number; spelling: number; runs: { index: number }[]
  } }).__semanticResult)
  expect(result.semantic).toHaveLength(1)
  expect(result.semantic[0].sourceVersion).toBe(4)
  expect(result.semantic[0].payload.rating).toBe('partial')
  expect(result.semantic[0].payload.resumedAfterReveal).toBe(true)
  expect(result.chapter).toBe(0)
  expect(result.spelling).toBe(1)
  expect(result.runs[0].index).toBe(1)
})

test('completed recall can create an objectively scored reference-discrimination fact', async ({ page }) => {
  const words = [
    { name: 'alpha', trans: ['阿尔法，开端'], usphone: '', ukphone: '' },
    { name: 'beta', trans: ['贝塔，第二'], usphone: '', ukphone: '' },
    { name: 'gamma', trans: ['伽马，第三'], usphone: '', ukphone: '' },
    { name: 'delta', trans: ['德尔塔，变化量'], usphone: '', ukphone: '' },
  ]
  await page.unroute('**/dicts/CET4_T.json')
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: words }))
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    for (const word of ['alpha', 'beta', 'gamma', 'delta']) {
      await db.learningEvents.add(createLearningEvent('word_attempted', {
        word, dict: 'cet4', chapter: 0, reviewMode: false, wrongCount: 0, durationMs: 100, timing: [], mistakes: {}
      }))
    }
    window.__objectiveSemanticSeeded = true
  ` })
  await page.waitForFunction(() => (window as unknown as { __objectiveSemanticSeeded: boolean }).__objectiveSemanticSeeded)
  await page.reload()
  await expect(page.getByText('回想 4 个熟悉单词的词义')).toBeVisible()
  await page.getByRole('button', { name: '开始学习', exact: true }).click()
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: /查看释义/ }).click()
    await page.getByRole('button', { name: '3 想起了' }).click()
  }
  await expect(page.getByRole('button', { name: '开始辨认' })).toBeVisible()
  await page.getByRole('button', { name: '开始辨认' }).click()
  await expect(page).toHaveURL(/\/semantic-check\//)
  await expect(page.getByRole('heading', { name: 'alpha' })).toBeVisible()
  await page.getByRole('button', { name: /阿尔法，开端/ }).click()
  await expect(page.getByText('选择正确')).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const facts = await db.learningEvents.where('eventType').equals('semantic_discrimination_attempted').toArray()
    const runs = await db.semanticRuns.toArray()
    window.__objectiveSemanticResult = { facts, runs }
  ` })
  await page.waitForFunction(() => !!(window as unknown as { __objectiveSemanticResult: unknown }).__objectiveSemanticResult)
  const result = await page.evaluate(() => (window as unknown as { __objectiveSemanticResult: {
    facts: { sourceVersion: number; payload: { measurement: string; isCorrect: boolean; options: unknown[] } }[]
    runs: { mode?: string; index: number }[]
  } }).__objectiveSemanticResult)
  expect(result.facts).toHaveLength(1)
  expect(result.facts[0].sourceVersion).toBe(5)
  expect(result.facts[0].payload.measurement).toBe('reference_meaning_discrimination')
  expect(result.facts[0].payload.isCorrect).toBe(true)
  expect(result.facts[0].payload.options).toHaveLength(4)
  expect(result.runs.some((run) => run.mode === 'discrimination' && run.index === 1)).toBe(true)
})

test('failed local commit preserves progress; another owner cannot read or rate the run', async ({ page }) => {
  await page.goto('/today')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { revealSemanticItem, saveSemanticRating, loadSemanticRun } from '/src/semantic/runtime.ts'
    const run = { id: 'failure-fixture', sessionId: 's', dictionaryId: 'cet4', startedAt: Date.now(), index: 0,
      items: [{ contentId: 'semantic:cet4:alpha', key: 'semantic:cet4:alpha', contentVersion: 'sha256:' + 'a'.repeat(64), word: 'alpha', meanings: ['开端'] }] }
    await db.semanticRuns.add(run)
    await revealSemanticItem(run.id, 0)
    const reject = () => { throw new Error('fixture_storage_failure') }
    db.learningEvents.hook('creating', reject)
    let failed = false
    try { await saveSemanticRating(run.id, 0, 'partial', false) } catch { failed = true }
    db.learningEvents.hook('creating').unsubscribe(reject)
    const after = await db.semanticRuns.get(run.id)
    const facts = await db.learningEvents.where('eventType').equals('semantic_recall_attempted').count()
    localStorage.setItem('wenyanLearningOwnerId', 'other-owner')
    let isolated = false
    try { await loadSemanticRun(run.id) } catch { isolated = true }
    window.__semanticSafety = { failed, index: after.index, facts, isolated }
  ` })
  await page.waitForFunction(() => !!(window as unknown as { __semanticSafety: unknown }).__semanticSafety)
  expect(await page.evaluate(() => (window as unknown as { __semanticSafety: unknown }).__semanticSafety))
    .toEqual({ failed: true, index: 0, facts: 0, isolated: true })
})

test('manual vocabulary desk launches recall directly and is not captured by Smart Session', async ({ page }) => {
  await page.goto('/practice')
  await expect(page.getByRole('heading', { name: '专项训练' })).toBeVisible()
  await page.getByRole('button', { name: '开始词义回想' }).click()
  await expect(page).toHaveURL(/\/semantic\//)
  await page.getByRole('button', { name: /查看释义/ }).click()
  await page.keyboard.press('2') // reveal click must release focus to enable numeric rating
  await expect(page.getByRole('heading', { name: '这一段，已经留下记录。' })).toBeVisible()
  await expect(page.getByText('想起 0 · 部分 1 · 没想起 0')).toBeVisible()
  await page.getByRole('button', { name: '回到专项训练', exact: true }).click()
  await page.getByText('词义模糊', { exact: true }).click()
  await page.getByRole('button', { name: '开始词义回想' }).click()
  await page.getByRole('link', { name: 'Wenyan', exact: true }).click()
  await expect(page.getByText(/继续刚才的词义回想/)).toHaveCount(0)
  await page.goto('/practice')
  await expect(page.getByRole('button', { name: '继续词义回想' })).toBeVisible()
  await page.getByRole('link', { name: '记录', exact: true }).click()
  await expect(page.getByRole('region', { name: '词义训练记录' })).toContainText('部分 1')
})

test('direct objective selection retains atomic facts and owner-safe resume', async ({ page }) => {
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((word) => ({ name: word, trans: [`meaning-${word}`], usphone: '', ukphone: '' })) }))
  await page.goto('/practice?mode=discrimination')
  await page.getByRole('button', { name: '开始选择词义' }).click()
  await expect(page).toHaveURL(/\/semantic-check\//)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(alpha|beta|gamma|delta|epsilon)$/)
  const word = await page.getByRole('heading', { level: 1 }).textContent()
  await page.getByRole('button', { name: new RegExp(`meaning-${word}$`) }).click()
  await expect(page.getByText('选择正确', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('2 / 5', { exact: true })).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { getRecoverableSmartSessionFocusDictionary } from '/src/smart-session/runtime.ts'
    const facts = await db.learningEvents.toArray()
    window.__directCheck = { facts, focus: await getRecoverableSmartSessionFocusDictionary() }
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __directCheck: unknown }).__directCheck))
  const saved = await page.evaluate(() => (window as unknown as { __directCheck: { facts: { eventType: string; sourceVersion: number; payload: { isCorrect: boolean } }[]; focus?: string } }).__directCheck)
  expect(saved.facts).toHaveLength(1)
  expect(saved.facts[0].eventType).toBe('semantic_discrimination_attempted')
  expect(saved.facts[0].sourceVersion).toBe(5)
  expect(saved.facts[0].payload.isCorrect).toBe(true)
  expect(saved.focus).toBeUndefined()
  await page.addScriptTag({ type: 'module', content: `
    import { setLocalLearningOwnerId } from '/src/sync/localLearningOwner.ts'
    setLocalLearningOwnerId('different-owner')
  ` })
  await expect(page.getByRole('alert')).toContainText('不属于当前账号')
  await page.goto('/practice')
  await expect(page.getByRole('button', { name: '继续词义回想' })).toHaveCount(0)
})

test('practice pools use latest owner facts and reject old definition uncertainty', async ({ page }) => {
  await page.goto('/practice')
  await page.addScriptTag({ type: 'module', content: `
    import { selectPracticeWords, preparePracticeItems } from '/src/semantic/practice.ts'
    import { semanticItem } from '/src/semantic/provider.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    const now = Date.now()
    const words = [{ name: 'alpha', trans: ['A'] }, { name: 'beta', trans: ['B'] }]
    const spelling = (id, word, wrongCount, occurredAt) => ({ ...createLearningEvent('word_attempted', { word, dict:'cet4', wrongCount }), id, occurredAt })
    const old = spelling('old', 'alpha', 2, now - 2000)
    const good = spelling('new', 'alpha', 0, now - 1000)
    const bad = spelling('bad', 'beta', 1, now - 1000)
    const errors = selectPracticeWords(words, [old, good, bad], 'cet4', 0, 'errors', 'spelling', now).candidates.map(w=>w.name)
    const item = await semanticItem('cet4', words[0])
    const payload = { domain:'english', activity:'semantic_recall', measurement:'self_report_after_reveal', direction:'en_to_meaning', contentId:item.contentId, contentVersion:item.contentVersion, dictionaryId:'cet4', word:'alpha', sessionId:'session', blockId:'block', cue:'word_only', responseMode:'mental_recall', answerRevealed:true, resumedAfterReveal:false, rating:'partial' }
    const partial = { ...createLearningEvent('semantic_recall_attempted', payload, 4), occurredAt:now - 1000 }
    const uncertain = selectPracticeWords(words, [partial], 'cet4', 0, 'uncertain', 'recall', now)
    const exact = await preparePracticeItems(uncertain.candidates, 'cet4', 6, uncertain)
    const changed = await preparePracticeItems([{name:'alpha', trans:['updated-A']}], 'cet4', 6, uncertain)
    const recalled = {...partial, id:'later', occurredAt:now, payload:{...payload, rating:'recalled'}}
    const cleared = selectPracticeWords(words, [partial,recalled], 'cet4', 0, 'uncertain', 'recall', now).candidates.length
    window.__poolProof = { errors, exact:exact.length, changed:changed.length, cleared }
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __poolProof: unknown }).__poolProof))
  const proof = await page.evaluate(() => (window as unknown as { __poolProof: unknown }).__poolProof)
  expect(proof).toEqual({ errors: ['beta'], exact: 1, changed: 0, cleared: 0 })
})

test('manual spelling commits fact with its resume cursor and keeps its selected order', async ({ page }) => {
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: ['alpha','beta'].map((word) => ({ name:word, trans:[`meaning-${word}`], usphone:'', ukphone:'' })) }))
  await page.addInitScript(() => localStorage.setItem('randomConfig', JSON.stringify({ isOpen: true })))
  await page.goto('/practice?mode=spelling&pool=errors')
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    for (const word of ['alpha','beta']) await db.learningEvents.add(createLearningEvent('word_attempted', { word, dict:'cet4', chapter:0, reviewMode:false, wrongCount:1, durationMs:10, timing:[], mistakes:{} }, 2))
    window.__spellingPracticeSeeded = true
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __spellingPracticeSeeded: boolean }).__spellingPracticeSeeded))
  await page.getByRole('button', { name: '开始拼写训练' }).click()
  await expect(page).toHaveURL(/practice=spelling/)
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toContainText('alpha')
  await page.keyboard.type('alpha', { delay: 35 })
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toContainText('beta')
  await page.reload()
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toContainText('beta')
  await page.keyboard.type('beta', { delay: 35 })
  await expect(page.getByText('本次已练的词没有出现拼写错误。')).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    window.__spellingPracticeProof = { events:await db.learningEvents.where('eventType').equals('word_attempted').toArray(), records:await db.reviewRecords.toArray() }
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __spellingPracticeProof: unknown }).__spellingPracticeProof))
  const proof = await page.evaluate(() => (window as unknown as { __spellingPracticeProof: { events: unknown[]; records: { index: number; origin: string; isFinished: boolean }[] } }).__spellingPracticeProof)
  expect(proof.events).toHaveLength(4)
  expect(proof.records[0]).toMatchObject({ index: 1, origin: 'manual', isFinished: true })
})


test('practice remembers choices and ending older work preserves its facts', async ({ page }) => {
  await page.goto('/practice?mode=recall&pool=chapter&limit=12')
  await page.getByRole('button', { name: '开始词义回想' }).click()
  await page.getByRole('button', { name: /查看释义/ }).click()
  await page.getByRole('button', { name: '2 想起部分' }).click()
  await expect(page.getByText('想起 0 · 部分 1 · 没想起 0')).toBeVisible()
  await page.addScriptTag({ type: 'module', content: `
    import { db } from '/src/utils/db/index.ts'
    const fact = await db.learningEvents.where('eventType').equals('semantic_recall_attempted').first()
    await db.learningEvents.update(fact.id, { occurredAt: Date.now() - 20 * 86400000 }) // synthetic old fixture
    const run = await db.semanticRuns.get(fact.payload.blockId)
    for (let n=0;n<4;n++) await db.semanticRuns.add({...run,id:'pending-'+n,index:0,completedAt:undefined,endedAt:undefined})
    window.__oldRunSeeded = true
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __oldRunSeeded: boolean }).__oldRunSeeded))
  await page.reload()
  await expect(page.getByText('想起 0 · 部分 1 · 没想起 0')).toBeVisible()
  await page.getByRole('button', { name: '回到专项训练', exact: true }).click()
  await expect(page).toHaveURL(/mode=recall&pool=chapter&limit=12/)
  await page.goto('/practice')
  await expect(page.getByRole('radio', { name: '最多 12 个' })).toBeChecked()
  await expect(page.getByRole('button', { name: '继续词义回想' })).toHaveCount(3)
  await page.getByRole('button', { name: '展开其余 1 段' }).click()
  await expect(page.getByRole('button', { name: '继续词义回想' })).toHaveCount(4)
  await page.getByRole('button', { name: '结束词义回想，保留记录' }).first().click()
  await expect(page.getByRole('button', { name: '继续词义回想' })).toHaveCount(3)
  await page.addScriptTag({ type:'module', content: `
    import { db } from '/src/utils/db/index.ts'
    import { buildSemanticEvidence } from '/src/semantic/core.ts'
    const facts = await db.learningEvents.toArray()
    window.__endProof = { facts:facts.length, recent:buildSemanticEvidence(facts,Date.now()).attempts,
      ended:(await db.semanticRuns.toArray()).filter(r=>r.endedAt && !r.completedAt).length }
  ` })
  await page.waitForFunction(() => Boolean((window as unknown as { __endProof: unknown }).__endProof))
  expect(await page.evaluate(() => (window as unknown as { __endProof: unknown }).__endProof)).toEqual({facts:1,recent:0,ended:1})
})

test('manual spelling restores authoritative cursor before mounting input', async ({ page }) => {
  await page.route('**/dicts/CET4_T.json', (route) => route.fulfill({ json: ['alpha','beta'].map(name=>({name,trans:[name],usphone:'',ukphone:''})) }))
  await page.goto('/practice?mode=spelling&pool=errors')
  await page.addScriptTag({type:'module',content:`
    import { db } from '/src/utils/db/index.ts'
    import { createLearningEvent } from '/src/learning/types.ts'
    for (const word of ['alpha','beta']) await db.learningEvents.add(createLearningEvent('word_attempted', { word, dict:'cet4', chapter:0, reviewMode:false, wrongCount:1, durationMs:10, timing:[], mistakes:{} }, 2))
    window.__staleSeeded = true
  `})
  await page.waitForFunction(() => Boolean((window as unknown as { __staleSeeded: boolean }).__staleSeeded))
  await page.getByRole('button', { name: '开始拼写训练' }).click()
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toContainText('alpha')
  await page.keyboard.type('alpha', { delay:35 })
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toContainText('beta')
  await page.evaluate(() => {
    const stale = JSON.parse(localStorage.getItem('reviewModeInfo')!)
    stale.reviewRecord.index = 0
    localStorage.setItem('reviewModeInfo',JSON.stringify(stale))
  })
  await page.reload()
  await expect(page.locator('.wenyan-word-stage .tooltip-info')).toContainText('beta')
  await page.addScriptTag({type:'module',content:`
    import { db } from '/src/utils/db/index.ts'
    window.__cursorProof = { index:(await db.reviewRecords.toArray())[0].index, facts:await db.learningEvents.count() }
  `})
  await page.waitForFunction(() => Boolean((window as unknown as { __cursorProof: unknown }).__cursorProof))
  expect(await page.evaluate(() => (window as unknown as { __cursorProof: unknown }).__cursorProof)).toEqual({index:1,facts:3})
})
