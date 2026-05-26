import { createClient } from '@/lib/supabase/client'

export type Source = {
  id: string
  user_id: string
  name: string
  url?: string
  notes?: string
  language?: string
  created_at: string
}

export async function createSource(name: string, language?: string): Promise<Source | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('ind_sources')
    .insert({ name, language, user_id: user.id })
    .select()
    .single()

  if (error) { console.error('createSource:', error); return null }
  return data
}

export async function listSources(language?: string): Promise<Source[]> {
  const supabase = createClient()
  let query = supabase.from('ind_sources').select('*').order('name')
  if (language) query = query.eq('language', language)
  const { data, error } = await query
  if (error) { console.error('listSources:', error); return [] }
  return data ?? []
}
