import { createClient } from '@/lib/supabase/client'

export async function fetchCompletions(language: string, source: string): Promise<Set<string>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase
    .from('ind_completions')
    .select('item_key')
    .eq('user_id', user.id)
    .eq('language', language)
    .eq('source', source)
  return new Set((data ?? []).map((r: { item_key: string }) => r.item_key))
}

export async function markComplete(
  language: string, source: string, itemKey: string,
): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('ind_completions')
    .upsert({ user_id: user.id, language, source, item_key: itemKey })
  return !error
}

export async function unmarkComplete(
  language: string, source: string, itemKey: string,
): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('ind_completions')
    .delete()
    .eq('user_id', user.id)
    .eq('language', language)
    .eq('source', source)
    .eq('item_key', itemKey)
  return !error
}
