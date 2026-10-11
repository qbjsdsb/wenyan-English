import { studyTaskExecutionFingerprint } from './fingerprint'
import type { StoredStudyPlan, StudyPlan, StudyPlanRun } from './types'
import { parseStudyPlan } from './validation'
import { createLearningEvent } from '@/learning/types'
import { getLocalLearningOwnerId } from '@/sync/localLearningOwner'
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
    const task = plan?.tasks.find((item) => item.id === taskId)
    if (!plan || !task) throw new Error('没有找到这个任务，请刷新后重试。')
    if (plan.cloudCompletions?.[taskId]) throw new Error('这个云端任务已经有真实完成记录。可以通过词库再次练习。')

    const ownerUserId = getLocalLearningOwnerId()
    if (plan.origin === 'cloud') {
      if (!ownerUserId || plan.ownerUserId !== ownerUserId) throw new Error('学习账号已变化，请刷新任务后重试。')
      if (plan.cloudStatus !== 'active') throw new Error('这个云端任务已经不是当前活动任务，请刷新后重试。')
      if (!plan.cloudRevision || plan.cloudRevision < 1) throw new Error('云端任务缺少版本信息，请刷新后重试。')
    }

    const runs = await db.studyPlanRuns.where('planId').equals(planId).toArray()
    if (runs.some((run) => run.taskId === taskId && run.completionEventId)) throw new Error('这个任务已经完成。可以通过词库再次练习。')

    // A fresh run gives this launch its own identity and captures the exact
    // execution target observed at launch. Later plan edits cannot silently
    // inherit this run's completion evidence.
    const run: StudyPlanRun = {
      id: createLearningEvent('chapter_completed', {}).id,
      planId,
      taskId,
      startedAt: Date.now(),
      ownerUserId: plan.origin === 'cloud' ? ownerUserId : undefined,
      planRevision: plan.origin === 'cloud' ? plan.cloudRevision : undefined,
      taskFingerprint: studyTaskExecutionFingerprint(task),
    }
    await db.studyPlanRuns.add(run)
    return run
  })
}

export function exportStudyPlan(plan: StoredStudyPlan): string {
  const portable: StudyPlan = { schemaVersion: 1, id: plan.id, title: plan.title, timezone: plan.timezone, tasks: plan.tasks }
  return JSON.stringify(portable, null, 2)
}
