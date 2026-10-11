import type { IReviewRecord, ReviewRecordOrigin } from '@/utils/db/record'

export const OWNER_BOUND_REVIEW_ORIGINS = ['manual', 'smart', 'correction'] as const satisfies readonly ReviewRecordOrigin[]

export type OwnerBoundReviewRecord = IReviewRecord & {
  id: number
  origin: ReviewRecordOrigin
}

/**
 * Missing origin is intentionally reserved for legacy local review data.
 * Never reinterpret an origin-less record as a modern manual run.
 */
export function isLegacyReviewRecord(record: IReviewRecord | undefined): record is IReviewRecord & { origin?: undefined } {
  return Boolean(record) && record?.origin === undefined
}

export function isOwnerBoundReviewOrigin(origin: unknown): origin is ReviewRecordOrigin {
  return typeof origin === 'string' && (OWNER_BOUND_REVIEW_ORIGINS as readonly string[]).includes(origin)
}

/** Modern review execution must refer to one persisted record. The local anonymous owner is represented by undefined. */
export function isOwnerBoundReviewRecord(record: IReviewRecord | undefined): record is OwnerBoundReviewRecord {
  return Boolean(
    record &&
      typeof record.id === 'number' &&
      Number.isInteger(record.id) &&
      record.id > 0 &&
      isOwnerBoundReviewOrigin(record.origin),
  )
}

/** Exact owner equality is required. undefined === undefined is the valid anonymous/local owner. */
export function isOwnerBoundReviewForOwner(record: IReviewRecord | undefined, ownerUserId: string | undefined) {
  return Boolean(isOwnerBoundReviewRecord(record) && record.ownerUserId === ownerUserId)
}

export function ownerBoundReviewReturnPath(origin: ReviewRecordOrigin) {
  if (origin === 'manual') return '/practice?mode=spelling'
  if (origin === 'correction') return '/error-book'
  return '/today'
}
