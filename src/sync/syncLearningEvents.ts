import { supabase } from '@/supabase/client'
import { createAuthInitializationGate, getAuthenticatedOwner } from './authOwner'
import { getReadyLearningEvents, markLearningEventsFailed, markLearningEventsSynced, toRemoteLearningEvent } from './learningQueue'
import { setLocalLearningOwnerId } from './localLearningOwner'
import { type LearningPullResult, pullLearningEventsForOwner } from './pullLearningEvents'

export type LearningSyncResult =
  | { status: 'signed-out'; synced: 0 }
  | { status: 'idle'; synced: 0 }
  | { status: 'synced'; synced: number }
  | { status: 'failed'; synced: 0; message: string }

export interface LearningDataSyncResult {
  upload: LearningSyncResult
  download: LearningPullResult
}

const activeSyncByOwner = new Map<string, Promise<LearningSyncResult>>()
const activeDataSyncByOwner = new Map<string, Promise<LearningDataSyncResult>>()

function failedSync(message: string): LearningSyncResult {
  return { status: 'failed', synced: 0, message }
}

async function performSync(ownerUserId: string): Promise<LearningSyncResult> {
  const events = await getReadyLearningEvents(ownerUserId, 100)
  if (events.length === 0) return { status: 'idle', synced: 0 }

  const ids = events.map((event) => event.id)
  const payload = events.map(toRemoteLearningEvent)
  const { error } = await supabase.rpc('ingest_learning_events_for_owner', {
    p_expected_user_id: ownerUserId,
    p_events: payload,
  })

  if (error) {
    // An auth switch is not a failure of the immutable local facts themselves.
    // Leave them pending so the original owner can retry immediately next time.
    if (!error.message.includes('learning_owner_changed')) await markLearningEventsFailed(ids, error)
    return failedSync(error.message)
  }

  await markLearningEventsSynced(ids)
  return { status: 'synced', synced: ids.length }
}

export function syncLearningEventsForOwner(ownerUserId: string) {
  const existing = activeSyncByOwner.get(ownerUserId)
  if (existing) return existing

  const promise = performSync(ownerUserId)
    .catch((error) => failedSync(error instanceof Error ? error.message : String(error)))
    .finally(() => {
      if (activeSyncByOwner.get(ownerUserId) === promise) activeSyncByOwner.delete(ownerUserId)
    })
  activeSyncByOwner.set(ownerUserId, promise)
  return promise
}

export async function syncLearningEvents(): Promise<LearningSyncResult> {
  const auth = await getAuthenticatedOwner()
  if (auth.status === 'signed-out') return { status: 'signed-out', synced: 0 }
  if (auth.status === 'failed') return failedSync(auth.message)
  return syncLearningEventsForOwner(auth.userId)
}

function syncLearningDataForOwner(ownerUserId: string) {
  const existing = activeDataSyncByOwner.get(ownerUserId)
  if (existing) return existing

  const promise = (async () => {
    const upload = await syncLearningEventsForOwner(ownerUserId)
    const download = await pullLearningEventsForOwner(ownerUserId)
    return { upload, download }
  })().finally(() => {
    if (activeDataSyncByOwner.get(ownerUserId) === promise) activeDataSyncByOwner.delete(ownerUserId)
  })
  activeDataSyncByOwner.set(ownerUserId, promise)
  return promise
}

export async function syncLearningData(): Promise<LearningDataSyncResult> {
  const auth = await getAuthenticatedOwner()
  if (auth.status === 'signed-out') {
    return {
      upload: { status: 'signed-out', synced: 0 },
      download: { status: 'signed-out', received: 0, inserted: 0 },
    }
  }
  if (auth.status === 'failed') {
    return {
      upload: failedSync(auth.message),
      download: { status: 'failed', received: 0, inserted: 0, message: auth.message },
    }
  }
  return syncLearningDataForOwner(auth.userId)
}

export function startLearningSync() {
  let disposed = false
  const authGate = createAuthInitializationGate()

  const run = () => {
    if (!disposed) void syncLearningData()
  }

  const onOnline = () => run()
  window.addEventListener('online', onOnline)

  const initialTicket = authGate.ticket()
  void supabase.auth.getSession().then(({ data, error }) => {
    if (disposed || !authGate.accepts(initialTicket)) return
    if (error) {
      setLocalLearningOwnerId(null)
      return
    }
    setLocalLearningOwnerId(data.session?.user.id)
  })

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    authGate.authChanged()
    setLocalLearningOwnerId(session?.user.id)
    if (session) window.setTimeout(run, 0)
  })

  const intervalId = window.setInterval(run, 30_000)
  run()

  return () => {
    disposed = true
    window.removeEventListener('online', onOnline)
    window.clearInterval(intervalId)
    data.subscription.unsubscribe()
  }
}
