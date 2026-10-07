export interface StudyTask {
  id: string
  title: string
  kind: 'chapter'
  dictId: string
  chapterIndex: number
  dueDate: string
  estimatedMinutes: number
  reason: string
}

/** Portable plan instructions only. Imported JSON cannot assert learning completion. */
export interface StudyPlan {
  schemaVersion: 1
  id: string
  title: string
  timezone: string
  tasks: StudyTask[]
}

export interface CloudTaskCompletion {
  completedAt: string
  completionEventId: string
}

export interface StoredStudyPlan extends StudyPlan {
  importedAt: number
  origin: 'local' | 'import' | 'cloud'
  /** Cloud metadata is a cache only. Supabase Cloud Plan v2 remains authoritative. */
  cloudRevision?: number
  cloudStatus?: 'active' | 'archived'
  cloudCompletions?: Record<string, CloudTaskCompletion>
}

export interface StudyPlanRun {
  id: string
  planId: string
  taskId: string
  startedAt: number
  completedAt?: number
  completionEventId?: string
}
