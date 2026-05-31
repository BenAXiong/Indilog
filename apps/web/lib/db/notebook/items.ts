import { createClient } from '@/lib/supabase/client'

export type ItemType = 'word' | 'sentence' | 'note'

export type CreateItemInput = {
  ab: string
  type: ItemType
  language: string
  dialect?: string
  place_heard?: string
  notes?: string
  zh?: string
  audio?: string
  note_source?: string
  collection_id?: string
  source_id?: string
  speaker_id?: string
  tags?: string[]
  target_word?: string | null
}

export type Item = CreateItemInput & {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

// Strips undefined values before sending to PostgREST — avoids PGRST204 on optional columns
function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function createItem(input: CreateItemInput): Promise<Item | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('ind_items')
    .insert(defined({ ...input, user_id: user.id }))
    .select()
    .single()

  if (error) { console.error('createItem:', error.message, error.code, error.details); return null }
  return data
}

export async function updateItem(id: string, patch: Partial<CreateItemInput>): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('ind_items').update(defined(patch)).eq('id', id)
  if (error) { console.error('updateItem:', error.message, error.code); return false }
  return true
}

export async function deleteItem(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('ind_items').delete().eq('id', id)
  if (error) { console.error('deleteItem:', error); return false }
  return true
}

export async function listItems(opts?: { language?: string; limit?: number; offset?: number }): Promise<Item[]> {
  const supabase = createClient()
  let query = supabase
    .from('ind_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (opts?.language) query = query.eq('language', opts.language)
  if (opts?.limit)    query = query.limit(opts.limit)
  if (opts?.offset)   query = query.range(opts.offset, (opts.offset + (opts.limit ?? 20)) - 1)

  const { data, error } = await query
  if (error) { console.error('listItems:', error); return [] }
  return data ?? []
}
