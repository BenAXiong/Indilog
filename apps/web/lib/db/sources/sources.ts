import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/supabase/session'

export type SourceType = 'person' | 'media' | 'reference'

export type Source = {
  id:           string
  user_id:      string
  name:         string
  type:         SourceType
  dialect_name: string | null
  language:     string | null
  location:     string | null
  url:          string | null
  notes:        string | null
  avatar_color: string | null
  created_at:   string
}

export type CreateSourceInput = Omit<Source, 'id' | 'user_id' | 'created_at'>

function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function listSources(): Promise<Source[]> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('ind_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('name')
  if (error) { console.error('listSources:', error); return [] }
  return data ?? []
}

export async function createSource(input: CreateSourceInput): Promise<Source | null> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('ind_sources')
    .insert(defined({ ...input, user_id: user.id }) as Record<string, unknown>)
    .select()
    .single()
  if (error) { console.error('createSource:', error); return null }
  return data
}

export async function updateSource(id: string, patch: Partial<CreateSourceInput>): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('ind_sources')
    .update(defined(patch as Record<string, unknown>))
    .eq('id', id)
  if (error) { console.error('updateSource:', error); return false }
  return true
}

export async function deleteSource(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('ind_sources').delete().eq('id', id)
  if (error) { console.error('deleteSource:', error); return false }
  return true
}
