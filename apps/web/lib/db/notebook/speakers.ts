import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/supabase/session'

export type Speaker = {
  id: string
  user_id: string
  name: string
  notes?: string
  created_at: string
}

export async function createSpeaker(name: string): Promise<Speaker | null> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('ind_speakers')
    .insert({ name, user_id: user.id })
    .select()
    .single()

  if (error) { console.error('createSpeaker:', error); return null }
  return data
}

export async function listSpeakers(): Promise<Speaker[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('ind_speakers').select('*').order('name')
  if (error) { console.error('listSpeakers:', error); return [] }
  return data ?? []
}
