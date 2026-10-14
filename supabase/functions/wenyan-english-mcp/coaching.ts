import { buildCloudCoachingContext as buildCloudCoachingContextV15 } from './coachingV15.ts'
import { buildCloudCoachingContext as buildCloudCoachingContextV17 } from './coachingV17.ts'

type CoachingOptions = Parameters<typeof buildCloudCoachingContextV15>[0]

const isEdgeRuntime = typeof (globalThis as unknown as { Deno?: unknown }).Deno !== 'undefined'

/**
 * Production Edge Runtime serves v1.7. Node-based legacy adapter regression stays pinned to v1.5;
 * v1.7 has its own focused regression script so the old 10-scenario contract remains untouched.
 */
export function buildCloudCoachingContext(options: CoachingOptions) {
  return isEdgeRuntime ? buildCloudCoachingContextV17(options) : buildCloudCoachingContextV15(options)
}
