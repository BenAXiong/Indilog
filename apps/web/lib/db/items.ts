import { createClient } from '@/lib/supabase/client'

export type ItemType = 'word' | 'sentence' | 'note'

export type CreateItemInput = {
  text: string
  type: ItemType
  language: string
  dialect?: string
  place_heard?: string
  notes?: string
  meaning?: string
  audio_url?: string
  source_id?: string
  speaker_id?: string
}

export type Item = CreateItemInput & {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export async function createItem(input: CreateItemInput): Promise<Item | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('ind_items')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) { console.error('createItem:', error.message, error.code, error.details); return null }
  return data
}

export async function updateItem(id: string, patch: Partial<CreateItemInput>): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('ind_items').update(patch).eq('id', id)
  if (error) { console.error('updateItem:', error); return false }
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
