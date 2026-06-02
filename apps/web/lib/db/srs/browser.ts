'use client'

import { createClient } from '@/lib/supabase/client'
export { suspendCard, unsuspendCard, setFlagColor } from './flashcards'

export type BrowserCard = {
  id:            string        // note ID — primary identity
  card_id:       string | null // flashcard ID (null if ensureFlashcards hasn't run yet)
  ab: string
  zh: string | null
  created_at: string
  // SRS state (defaults when no card)
  due_at:        string | null
  ease_factor:   number
  interval_days: number
  repetitions:   number
  suspended_at:  string | null
  flag_color:    string | null
  card_type:     string
  metadata:      Record<string, unknown> | null
  // Note fields
  source:        string
  note_source:   string
  notes:         string | null
  audio:         string | null
  note_type:     string
  language:      string
  dialect:       string | null
  place_heard:   string | null
  tags:          string[] | null
  target_word:   string | null
  source_id:     string | null
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

  const SEL = 'id, ab, zh, notes, audio, type, language, dialect, place_heard, tags, target_word, note_source, source_id, collection_id, created_at, ind_flashcards(id, due_at, ease_factor, interval_days, repetitions, suspended_at, flag_color, card_type, metadata), ind_learn_collections(name)'

  // Two parallel queries so captured items are never crowded out by the server 1000-row cap
  const [capturedRes, collectionRes] = await Promise.all([
    supabase.from('ind_items').select(SEL).eq('user_id', user.id).eq('note_source', 'captured').order('created_at', { ascending: false }),
    supabase.from('ind_items').select(SEL).eq('user_id', user.id).eq('note_source', 'collection').order('created_at', { ascending: false }),
  ])

  const data = [...(capturedRes.data ?? []), ...(collectionRes.data ?? [])]
  if (!data.length) return []

  const now = new Date().toISOString()

  type CardJoin = {
    id: string; due_at: string | null; ease_factor: number; interval_days: number
    repetitions: number; suspended_at: string | null; flag_color: string | null
    card_type: string; metadata: Record<string, unknown> | null
  }

  let results: BrowserCard[] = data.map(row => {
    const cardArr = row.ind_flashcards as unknown as CardJoin[] | null
    const card    = Array.isArray(cardArr) ? (cardArr[0] ?? null) : null
    const col     = row.ind_learn_collections as unknown as { name: string } | null
    const source  = col?.name ?? (row.note_source === 'collection' ? '—' : 'Captured')
    return {
      id:            row.id,
      card_id:       card?.id ?? null,
      ab:            row.ab ?? '',
      zh:            row.zh ?? null,
      created_at:    row.created_at,
      due_at:        card?.due_at ?? null,
      ease_factor:   card?.ease_factor ?? 2.5,
      interval_days: card?.interval_days ?? 0,
      repetitions:   card?.repetitions ?? 0,
      suspended_at:  card?.suspended_at ?? null,
      flag_color:    card?.flag_color ?? null,
      card_type:     card?.card_type ?? 'default',
      metadata:      card?.metadata ?? null,
      source,
      note_source:   row.note_source ?? 'captured',
      notes:         row.notes ?? null,
      audio:         row.audio ?? null,
      note_type:     row.type ?? 'word',
      language:      row.language ?? '',
      dialect:       row.dialect ?? null,
      place_heard:   row.place_heard ?? null,
      tags:          Array.isArray(row.tags) ? (row.tags as string[]) : null,
      target_word:   row.target_word ?? null,
      source_id:     row.source_id ?? null,
    }
  })

  // Post-filter for SRS state
  switch (filter) {
    case 'due':
      results = results.filter(c => c.card_id && !c.suspended_at && (!c.due_at || c.due_at <= now))
      break
    case 'new':
      results = results.filter(c => c.card_id && c.repetitions === 0 && !c.suspended_at)
      break
    case 'flagged':
      results = results.filter(c => c.card_id && !c.suspended_at && c.flag_color !== null)
      if (flagColorFilter) results = results.filter(c => c.flag_color === flagColorFilter)
      break
    case 'suspended':
      results = results.filter(c => c.card_id && c.suspended_at !== null)
      break
  }

  // Sort ('added' already ordered by created_at desc from DB)
  if (sort === 'due') {
    results.sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0
      if (!a.due_at) return -1
      if (!b.due_at) return 1
      return a.due_at < b.due_at ? -1 : 1
    })
  } else if (sort === 'ease') {
    results.sort((a, b) => a.ease_factor - b.ease_factor)
  }

  return results
}

export async function updateNoteFields(
  noteId: string,
  patch: Partial<{ ab: string; zh: string | null; notes: string | null; place_heard: string | null }>
): Promise<void> {
  const supabase = createClient()
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v
  await supabase.from('ind_items').update(clean).eq('id', noteId)
}

export async function setCardLayout(cardId: string, layout: 'word' | 'sentence', currentMeta: Record<string, unknown> | null): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ metadata: { ...currentMeta, layout } }).eq('id', cardId)
}

export async function batchDeleteNotes(noteIds: string[]): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_items').delete().in('id', noteIds)
}

export async function batchSuspendCards(noteIds: string[]): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards')
    .update({ suspended_at: new Date().toISOString() })
    .in('note_id', noteIds)
}

export async function batchSetFlag(noteIds: string[], flagColor: string | null): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ flag_color: flagColor }).in('note_id', noteIds)
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_items').delete().eq('id', noteId)
}

export async function resetCardEase(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({
    ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null,
  }).eq('id', id)
}
