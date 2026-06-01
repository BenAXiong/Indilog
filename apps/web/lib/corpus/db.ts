import { createClient } from '@supabase/supabase-js'

// Read-only corpus client — uses anon key, corpus tables have public-read RLS.
// Module-level singleton so the client is reused across requests.
let _client: ReturnType<typeof createClient> | null = null

export function getCorpusClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _client = createClient(url, key, { auth: { persistSession: false } })
  }
  return _client
}
