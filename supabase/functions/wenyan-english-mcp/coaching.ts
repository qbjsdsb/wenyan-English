import { buildCloudCoachingContext as buildCloudCoachingContextV15 } from './coachingV15.ts'
import { buildCloudCoachingContext as buildCloudCoachingContextV16 } from './coachingV16.ts'

type CoachingOptions = Parameters<typeof buildCloudCoachingContextV15>[0]

const isEdgeRuntime = typeof (globalThis as unknown as { Deno?: unknown }).Deno !== 'undefined'

/**
 * Production Edge Runtime serves v1.6. Node-based legacy adapter regression stays pinned to v1.5;
 * v1.6 has its own focused regression script so the old 10-scenario contract remains untouched.
 */
export function buildCloudCoachingContext(options: CoachingOptions) {
  return isEdgeRuntime ? buildCloudCoachingContextV16(options) : buildCloudCoachingContextV15(options)
}
