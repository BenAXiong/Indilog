import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/supabase/session'

export async function getProfile() {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return null
  const { data } = await supabase
    .from('ind_profiles')
    .select('active_study_language, default_dialect')
    .eq('user_id', user.id)
    .maybeSingle()
  return data
}

export async function setCapturesIncludeInReview(include: boolean): Promise<void> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return
  await supabase.from('ind_profiles').upsert({ user_id: user.id, include_in_review: include })
}

export async function updateDefaultDialect(dialect: string): Promise<void> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return
  await supabase
    .from('ind_profiles')
    .upsert({ user_id: user.id, default_dialect: dialect })
}
