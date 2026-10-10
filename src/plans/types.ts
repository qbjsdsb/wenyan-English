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
  /** Cloud metadata is an execution cache only. Supabase Cloud Plan v2 remains authoritative. */
  ownerUserId?: string
  cloudRevision?: number
  cloudStatus?: 'active' | 'archived'
  cloudCompletions?: Record<string, CloudTaskCompletion>
}

export interface StudyPlanRun {
  id: string
  planId: string
  taskId: string
  startedAt: number
  /** Owner is required for new Cloud Plan runs; local/import runs remain portable. */
  ownerUserId?: string
  /** Revision observed when this run started. Provenance only; taskFingerprint decides target compatibility. */
  planRevision?: number
  /** Stable execution target captured at launch so a revised task cannot inherit stale completion. */
  taskFingerprint?: string
  completedAt?: number
  completionEventId?: string
}
