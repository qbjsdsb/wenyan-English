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
  if (scope === 'openid') return '确认你的 Wenyan 登录身份'
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
      options: {
        shouldCreateUser: false,
        emailRedirectTo: currentConsentRedirectUrl(),
      },
    })
    setBusy(false)
    setMessage(error ? `发送失败：${error.message}` : '登录链接已经发送。打开邮件后会回到这张授权页。')
  }

  const decide = async (decision: 'approve' | 'deny') => {
    if (!authorizationId || busy) return
    setBusy(true)
    setMessage('')
    const result =
      decision === 'approve'
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
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900 dark:bg-gray-950 dark:text-gray-100 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-indigo-500">Wenyan Authorization</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">连接你的学习数据</h1>
          <p className="mt-3 text-sm leading-7 text-gray-500 dark:text-gray-400">
            Wenyan 会先让你看清楚是谁在申请访问。当前 ChatGPT 插件阶段只有只读学习工具，不允许修改历史学习事实或替你伪造完成记录。
          </p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">正在确认授权请求…</p>
          ) : !authorizationId ? (
            <div className="space-y-3">
              <h2 className="text-lg font-medium">授权链接无效</h2>
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">{message}</p>
            </div>
          ) : !session ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-medium">先登录 Wenyan</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  授权只会作用于你当前登录的 Wenyan 账号。这里不会因为输入新邮箱而自动注册账号。
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="oauth-email">
                  登录邮箱
                </label>
                <input
                  id="oauth-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 outline-none focus:border-indigo-400 dark:border-gray-700"
                  placeholder="you@example.com"
                />
              </div>
              <button className="my-btn-primary w-full sm:w-auto" disabled={busy || !email.trim()} onClick={sendMagicLink}>
                发送登录链接
              </button>
            </div>
          ) : details ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">申请访问</p>
                <h2 className="mt-2 text-xl font-semibold">{clientName}</h2>
                {details.client.uri && <p className="mt-1 break-all text-xs text-gray-400">{details.client.uri}</p>}
              </div>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
                <p className="text-sm font-medium">当前允许它做什么</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  <li>• 查看已同步的学习概况、弱词证据和单词历史</li>
                  <li>• 依据这些事实给出解释和学习建议</li>
                  <li>• 看不到尚未同步到云端的其他设备记录</li>
                  <li>• 当前不能创建计划、修改历史、删除数据或写入完成状态</li>
                </ul>
              </div>

              {scopes.length > 0 && (
                <div>
                  <p className="text-sm font-medium">OAuth 权限</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scopes.map((scope) => (
                      <span key={scope} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        {scopeLabel(scope)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {details.redirect_uri && (
                <div>
                  <p className="text-xs text-gray-400">授权完成后返回</p>
                  <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">{details.redirect_uri}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button className="my-btn-secondary" disabled={busy} onClick={() => void decide('deny')}>
                  拒绝
                </button>
                <button className="my-btn-primary" disabled={busy} onClick={() => void decide('approve')}>
                  允许只读访问
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-medium">无法继续授权</h2>
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">{message || '请回到 ChatGPT 后重新发起连接。'}</p>
            </div>
          )}

          {message && authorizationId && <div className="mt-5 rounded-xl bg-gray-100 px-4 py-3 text-sm dark:bg-gray-800">{message}</div>}
        </section>

        <p className="mt-5 text-xs leading-5 text-gray-400">
          你可以拒绝这次授权。后续也可以在 Wenyan / Supabase 中撤销已批准的 OAuth 授权，而不会删除你的学习历史。
        </p>
      </div>
    </main>
  )
}
