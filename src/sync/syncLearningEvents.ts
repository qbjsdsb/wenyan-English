import { supabase } from '@/supabase/client'
import {
  getPendingLearningEvents,
  markLearningEventsFailed,
  markLearningEventsSynced,
  retryFailedLearningEvents,
  toRemoteLearningEvent,
} from './learningQueue'

export type LearningSyncResult =
  | { status: 'signed-out'; synced: 0 }
  | { status: 'idle'; synced: 0 }
  | { status: 'synced'; synced: number }
  | { status: 'failed'; synced: 0; message: string }

let activeSync: Promise<LearningSyncResult> | null = null

async function performSync(): Promise<LearningSyncResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { status: 'signed-out', synced: 0 }
  }

  await retryFailedLearningEvents()
  const events = await getPendingLearningEvents(100)
  if (events.length === 0) {
    return { status: 'idle', synced: 0 }
  }

  const ids = events.map((event) => event.id)
  const payload = events.map(toRemoteLearningEvent)
  const { error } = await supabase.rpc('ingest_learning_events', { p_events: payload })

  if (error) {
    await markLearningEventsFailed(ids, error)
    return { status: 'failed', synced: 0, message: error.message }
  }

  await markLearningEventsSynced(ids)
  return { status: 'synced', synced: ids.length }
}

export function syncLearningEvents() {
  if (!activeSync) {
    activeSync = performSync().finally(() => {
      activeSync = null
    })
  }

  return activeSync
}

export function startLearningSync() {
  let disposed = false

  const run = () => {
    if (!disposed) void syncLearningEvents()
  }

  const onOnline = () => run()
  window.addEventListener('online', onOnline)

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
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
