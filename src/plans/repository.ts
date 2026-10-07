import type { StoredStudyPlan, StudyPlan, StudyPlanRun } from './types'
import { parseStudyPlan } from './validation'
import { createLearningEvent } from '@/learning/types'
import { db } from '@/utils/db'

export async function importStudyPlan(json: string, origin: StoredStudyPlan['origin'] = 'import') {
  const plan = parseStudyPlan(json)
  await db.transaction('rw', db.studyPlans, async () => {
    if (await db.studyPlans.get(plan.id)) throw new Error('这份计划已经保存。若要新建，请使用新的计划 ID；已有进度不会被覆盖。')
    await db.studyPlans.add({ ...plan, importedAt: Date.now(), origin })
  })
  return plan
}

export async function startStudyTask(planId: string, taskId: string): Promise<StudyPlanRun> {
  return db.transaction('rw', db.studyPlans, db.studyPlanRuns, async () => {
    const plan = await db.studyPlans.get(planId)
    if (!plan?.tasks.some((task) => task.id === taskId)) throw new Error('没有找到这个任务，请刷新后重试。')
    const runs = await db.studyPlanRuns.where('planId').equals(planId).toArray()
    if (runs.some((run) => run.taskId === taskId && run.completionEventId)) throw new Error('这个任务已经完成。可以通过词库再次练习。')
    // A fresh run gives this launch its own identity; completion is linked to a real chapter event.
    const run = { id: createLearningEvent('chapter_completed', {}).id, planId, taskId, startedAt: Date.now() }
    await db.studyPlanRuns.add(run)
    return run
  })
}

export function exportStudyPlan(plan: StoredStudyPlan): string {
  const portable: StudyPlan = { schemaVersion: 1, id: plan.id, title: plan.title, timezone: plan.timezone, tasks: plan.tasks }
  return JSON.stringify(portable, null, 2)
}
