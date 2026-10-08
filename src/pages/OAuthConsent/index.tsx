import { LoadingUI } from '@/components/Loading'
import { supabase } from '@/supabase/client'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

interface ConsentDetails {
  authorization_id: string
  client: {
    name?: string | null
    uri?: string | null
  }
  redirect_uri?: string | null
  scope?: string | null
}

function currentConsentRedirectUrl() {
  return window.location.toString()
}

function scopeLabel(scope: string) {
  if (scope === 'openid') return '确认 Wenyan 登录身份'
  if (scope === 'email') return '读取账号邮箱'
  if (scope === 'profile') return '读取基础账号资料'
  return scope
}

export default function OAuthConsentPage() {
  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id')?.trim() ?? ''
  const [session, setSession] = useState<Session | null>(null)
  const [details, setDetails] = useState<ConsentDetails | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadAuthorization = useCallback(async () => {
    if (!authorizationId) {
      setMessage('这个授权链接缺少 authorization_id。请回到 ChatGPT 重新发起连接。')
      setLoading(false)
      return
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setSession(null)
      setDetails(null)
      setLoading(false)
      return
    }

    const { data: authData, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    if (error || !authData) {
      setMessage(`无法读取授权请求：${error?.message ?? '授权请求已经失效，请重新连接。'}`)
      setLoading(false)
      return
    }

    if (!('authorization_id' in authData)) {
      window.location.replace(authData.redirect_url)
      return
    }

    setDetails(authData as ConsentDetails)
    setLoading(false)
  }, [authorizationId])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadAuthorization()
  }, [loadAuthorization, session?.access_token])

  const sendMagicLink = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !authorizationId) return

    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false, emailRedirectTo: currentConsentRedirectUrl() },
    })
    setBusy(false)
    setMessage(error ? `发送失败：${error.message}` : '登录链接已经发送。打开邮件后会回到这张授权页。')
  }

  const decide = async (decision: 'approve' | 'deny') => {
    if (!authorizationId || busy) return
    setBusy(true)
    setMessage('')
    const result = decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId)

    if (result.error || !result.data) {
      setBusy(false)
      setMessage(`授权失败：${result.error?.message ?? '请回到 ChatGPT 后重新连接。'}`)
      return
    }

    window.location.assign(result.data.redirect_url)
  }

  const scopes = details?.scope?.split(/\s+/).filter(Boolean) ?? []
  const clientName = details?.client.name?.trim() || 'ChatGPT / MCP 客户端'

  return (
    <main className="wenyan-auth-shell min-h-screen px-5 py-12 text-[var(--wenyan-ink)] sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-[620px]">
        <div className="mb-7 text-center sm:text-left">
          <div className="wenyan-brand text-[22px] font-semibold">Wenyan</div>
          <h1 className="mt-5 text-[30px] font-semibold tracking-[-0.045em] text-[var(--wenyan-ink)]">连接你的学习数据</h1>
          <p className="wenyan-muted mx-auto mt-3 max-w-[560px] text-sm leading-7 sm:mx-0">
            这里会明确展示谁在申请访问、能读取什么，以及哪些事情它不能做。
          </p>
        </div>

        <section className="wenyan-auth-card p-6 sm:p-8">
          {loading ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-4">
              <LoadingUI label="正在确认授权请求" />
              <p className="wenyan-muted text-xs">正在确认授权请求</p>
            </div>
          ) : !authorizationId ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">授权链接无效</h2>
              <p className="wenyan-muted text-sm leading-6">{message}</p>
            </div>
          ) : !session ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">先登录 Wenyan</h2>
                <p className="wenyan-muted mt-2 text-sm leading-6">授权只作用于当前账号。输入邮箱不会自动创建新用户。</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="oauth-email">登录邮箱</label>
                <input
                  id="oauth-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="wenyan-input w-full px-3.5 text-sm outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <button className="wenyan-button-primary" disabled={busy || !email.trim()} onClick={sendMagicLink}>
                {busy ? '正在发送…' : '发送登录链接'}
              </button>
            </div>
          ) : details ? (
            <div className="space-y-7">
              <div>
                <p className="wenyan-muted text-[10px]">申请访问</p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em]">{clientName}</h2>
                {details.client.uri && <p className="wenyan-muted mt-1 break-all text-[11px]">{details.client.uri}</p>}
              </div>

              <div className="rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[color-mix(in_srgb,var(--wenyan-paper-muted)_58%,transparent)] p-4">
                <p className="text-sm font-medium">这次访问可以</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--wenyan-ink-secondary)]">
                  <li>查看已同步的学习概况、弱词证据和单词历史</li>
                  <li>依据这些事实给出解释和学习建议</li>
                  <li>读取不到尚未同步到云端的其他设备记录</li>
                  <li>不能修改历史、删除数据或伪造学习完成</li>
                </ul>
              </div>

              {scopes.length > 0 && (
                <div>
                  <p className="text-sm font-medium">OAuth 权限</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scopes.map((scope) => (
                      <span key={scope} className="wenyan-scope-pill px-3 py-1.5 text-[11px]">{scopeLabel(scope)}</span>
                    ))}
                  </div>
                </div>
              )}

              {details.redirect_uri && (
                <div>
                  <p className="wenyan-muted text-[10px]">授权完成后返回</p>
                  <p className="wenyan-muted mt-1 break-all text-[11px] leading-5">{details.redirect_uri}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-[var(--wenyan-line-soft)] pt-5 sm:flex-row sm:justify-end">
                <button className="wenyan-button-secondary" disabled={busy} onClick={() => void decide('deny')}>拒绝</button>
                <button className="wenyan-button-primary" disabled={busy} onClick={() => void decide('approve')}>
                  {busy ? '正在确认…' : '允许只读访问'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">无法继续授权</h2>
              <p className="wenyan-muted text-sm leading-6">{message || '请回到 ChatGPT 后重新发起连接。'}</p>
            </div>
          )}

          {message && authorizationId && <div role="status" className="mt-5 rounded-[var(--wenyan-radius-sm)] bg-[var(--wenyan-paper-muted)] px-4 py-3 text-sm text-[var(--wenyan-ink-secondary)]">{message}</div>}
        </section>

        <p className="wenyan-muted mt-5 text-center text-[11px] leading-5 sm:text-left">
          你可以拒绝本次授权；撤销授权也不会删除已有学习历史。
        </p>
      </div>
    </main>
  )
}
