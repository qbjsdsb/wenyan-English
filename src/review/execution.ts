import type { Word } from '@/typings'
import { ReviewRecord } from '@/utils/db/record'
import type { IReviewRecord, ReviewRecordOrigin } from '@/utils/db/record'

export const OWNER_BOUND_REVIEW_ORIGINS = ['manual', 'smart', 'correction'] as const satisfies readonly ReviewRecordOrigin[]

export type OwnerBoundReviewRecord = IReviewRecord & {
  origin: ReviewRecordOrigin
  ownerUserId: string
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

export function isOwnerBoundReviewRecord(record: IReviewRecord | undefined): record is OwnerBoundReviewRecord {
  return Boolean(
    record &&
      isOwnerBoundReviewOrigin(record.origin) &&
      typeof record.ownerUserId === 'string' &&
      record.ownerUserId.length > 0,
  )
}

export function isOwnerBoundReviewForOwner(record: IReviewRecord | undefined, ownerUserId: string | undefined) {
  return Boolean(ownerUserId && isOwnerBoundReviewRecord(record) && record.ownerUserId === ownerUserId)
}

export function createOwnerBoundReviewRecord(
  dict: string,
  words: Word[],
  origin: ReviewRecordOrigin,
  ownerUserId: string | undefined,
) {
  if (!ownerUserId) throw new Error('owner_bound_review_requires_owner')
  const record = new ReviewRecord(dict, words)
  record.origin = origin
  record.ownerUserId = ownerUserId
  return record as ReviewRecord & OwnerBoundReviewRecord
}

export function ownerBoundReviewReturnPath(origin: ReviewRecordOrigin) {
  if (origin === 'manual') return '/practice?mode=spelling'
  if (origin === 'correction') return '/error-book'
  return '/today'
}
