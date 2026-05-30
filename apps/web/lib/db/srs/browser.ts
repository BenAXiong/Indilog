'use client'

import { createClient } from '@/lib/supabase/client'
export { suspendCard, unsuspendCard, setFlagColor } from './flashcards'

export type BrowserCard = {
  id: string
  note_id: string
  ab: string
  zh: string | null
  due_at: string | null
  ease_factor: number
  interval_days: number
  repetitions: number
  created_at: string
  suspended_at: string | null
  flag_color:   string | null
  card_type:    string
  source: string
  note_source: string
}

export type BrowserFilter = 'all' | 'due' | 'new' | 'flagged' | 'suspended'
export type BrowserSort   = 'due' | 'ease' | 'added'

export async function listBrowserCards(
  filter: BrowserFilter,
  sort: BrowserSort,
  flagColorFilter?: string | null,
): Promise<BrowserCard[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const now = new Date().toISOString()

  let q = supabase
    .from('ind_flashcards')
    .select('id, note_id, due_at, ease_factor, interval_days, repetitions, created_at, suspended_at, flag_color, card_type, ind_items(ab, zh, note_source, collection_id, ind_learn_collections(name))')
    .eq('user_id', user.id)

  switch (filter) {
    case 'due':       q = q.or(`due_at.is.null,due_at.lte.${now}`).is('suspended_at', null); break
    case 'new':       q = q.eq('repetitions', 0).is('suspended_at', null); break
    case 'flagged':
      q = q.not('flag_color', 'is', null).is('suspended_at', null)
      if (flagColorFilter) q = q.eq('flag_color', flagColorFilter)
      break
    case 'suspended': q = q.not('suspended_at', 'is', null); break
  }

  switch (sort) {
    case 'due':   q = q.order('due_at',      { ascending: true, nullsFirst: true }); break
    case 'ease':  q = q.order('ease_factor', { ascending: true }); break
    case 'added': q = q.order('created_at',  { ascending: false }); break
  }

  const { data } = await q.limit(500)
  if (!data) return []

  return data.map(row => {
    type NoteJoin = { ab: string; zh: string | null; note_source: string; collection_id: string | null; ind_learn_collections: { name: string } | null } | null
    const note   = row.ind_items as unknown as NoteJoin
    const source = note?.ind_learn_collections?.name ?? (note?.note_source === 'collection' ? '—' : 'Captures')
    return {
      id:            row.id,
      note_id:       row.note_id,
      ab:            note?.ab ?? '',
      zh:            note?.zh ?? null,
      due_at:        row.due_at,
      ease_factor:   row.ease_factor,
      interval_days: row.interval_days,
      repetitions:   row.repetitions,
      created_at:    row.created_at,
      suspended_at:  row.suspended_at,
      flag_color:    row.flag_color ?? null,
      card_type:     row.card_type ?? 'default',
      source,
      note_source:   note?.note_source ?? 'captured',
    }
  })
}

export async function updateNoteContent(noteId: string, ab: string, zh: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_items').update({ ab, zh }).eq('id', noteId)
}

export async function resetCardEase(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({
    ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null,
  }).eq('id', id)
}
