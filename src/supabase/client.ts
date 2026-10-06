import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://cmjhxvpkdeheujuteqoi.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_js_gjuCeIahQWc2NgxJmDA_eeKqV-Bh'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY

// The publishable key is intentionally safe to embed in a browser bundle. Access to
// learning data is still enforced by Supabase Auth + RLS. Never replace this with a
// service-role or secret key.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export function getWenyanRedirectUrl() {
  const basePath = REACT_APP_DEPLOY_ENV === 'pages' ? '/wenyan-English/' : '/'
  return new URL(basePath, window.location.origin).toString()
}
