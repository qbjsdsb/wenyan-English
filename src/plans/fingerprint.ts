import type { StudyTask } from './types'

/**
 * Stable execution identity for the currently executable chapter task.
 *
 * Deliberately excludes presentation/planning metadata such as title, reason,
 * due date and estimated minutes: changing those should not invalidate a run
 * that still points at the exact same learning target. Plan/task ids are
 * carried separately in the immutable fact context.
 */
export function studyTaskExecutionFingerprint(task: Pick<StudyTask, 'kind' | 'dictId' | 'chapterIndex'>): string {
  return `${task.kind}:${task.dictId}:${task.chapterIndex}`
}
