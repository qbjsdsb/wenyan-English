import { supabase } from '@/supabase/client'

export type AuthenticatedOwnerResult =
  | { status: 'signed-out' }
  | { status: 'authenticated'; userId: string }
  | { status: 'failed'; message: string }

/**
 * Resolve one stable browser account snapshot before an owner-bound RPC.
 * A session/user mismatch means auth changed while the lookup was in flight;
 * callers must fail closed and let the next auth-triggered sync retry.
 */
export async function getAuthenticatedOwner(): Promise<AuthenticatedOwnerResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { status: 'failed', message: sessionError.message }
  if (!sessionData.session) return { status: 'signed-out' }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { status: 'failed', message: userError?.message ?? '无法确认当前登录账号。' }
  }
  if (sessionData.session.user.id !== userData.user.id) {
    return { status: 'failed', message: '登录账号刚刚发生变化，请稍后重试同步。' }
  }

  return { status: 'authenticated', userId: userData.user.id }
}

export function createAuthInitializationGate() {
  let generation = 0
  return {
    ticket() {
      return generation
    },
    authChanged() {
      generation += 1
    },
    accepts(ticket: number) {
      return ticket === generation
    },
  }
}
