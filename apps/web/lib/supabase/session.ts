import { createClient } from './client'
import type { User } from '@supabase/supabase-js'

// Client-side replacement for the auth.getUser() network round trip (perf S3).
// getSession() reads the locally-stored session (supabase-js auto-refreshes an
// expired token); the id is only ever a query filter — authorization is enforced
// server-side by RLS (auth.uid()) on every query regardless.
// Server code (middleware, lib/db/**/server) must keep using auth.getUser().
export async function getSessionUser(): Promise<User | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user
  // Cold fallback (e.g. storage not yet hydrated right after OAuth callback)
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
