import { createClient } from '@/lib/supabase/client'
import { nextFormoSRS1, nextRelearn, type SMState, type Rating } from './schedule'

export type { Rating } from './schedule'

export type Flashcard = {
  id: string
  note_id: string
  due_at: string | null
  created_at: string
  ease_factor: number
  interval_days: number
  repetitions: number
  suspended_at: string | null
  flag_color:   string | null
  card_type:    string
  audio:    string | null
  metadata: Record<string, unknown> | null
}

export type FlashcardWithItem = Flashcard & {
  ind_items: {
    ab: string; zh: string | null; audio: string | null
    type: string; language: string; dialect: string | null; note_source: string
    collection_id: string | null
    ind_learn_collections: { name: string; language: string } | null
  } | null
}

// Extract display metadata from the joined Note
export function cardMeta(card: FlashcardWithItem) {
  return {
    language: card.ind_items?.language ?? card.ind_items?.ind_learn_collections?.language ?? '',
    dialect:  card.ind_items?.dialect ?? null,
    type:     card.ind_items?.type ?? 'word',
  }
}

// Resolve audio — priority: card snapshot (curriculum) › note join
export function cardAudio(card: FlashcardWithItem): string | null {
  return card.audio ?? card.ind_items?.audio ?? null
}

export async function ensureFlashcards(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [{ data: existing }, { data: items }] = await Promise.all([
    supabase.from('ind_flashcards').select('note_id').eq('user_id', user.id),
    supabase.from('ind_items').select('id').eq('user_id', user.id),
  ])

  if (!items?.length) return
  const existingIds = new Set(existing?.map(r => r.note_id) ?? [])
  const newItems = items.filter(i => !existingIds.has(i.id))
  if (!newItems.length) return

  await supabase.from('ind_flashcards').insert(
    newItems.map(item => ({
      user_id: user.id,
      note_id: item.id,
    }))
  )
}


export type DueStats = {
  total: number
  captures: number
  byCollection: Record<string, number>
}

export async function getDueStats(): Promise<DueStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, captures: 0, byCollection: {} }

  const now = new Date().toISOString()
  const { data } = await supabase
    .from('ind_flashcards')
    .select('note_id, ind_items(note_source, collection_id)')
    .eq('user_id', user.id)
    .or(`due_at.is.null,due_at.lte.${now}`)
    .is('suspended_at', null)
    .limit(10000)

  if (!data) return { total: 0, captures: 0, byCollection: {} }

  let captures = 0
  const byCollection: Record<string, number> = {}
  for (const row of data) {
    const note = row.ind_items as unknown as { note_source: string; collection_id: string | null } | null
    if (note?.note_source === 'collection' && note.collection_id) {
      byCollection[note.collection_id] = (byCollection[note.collection_id] ?? 0) + 1
    } else {
      captures++
    }
  }
  return { total: data.length, captures, byCollection }
}

export async function listDueFlashcards(
  opts: { flagColor?: string | 'any' } = {},
): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  let q = supabase
    .from('ind_flashcards')
    .select('*, ind_items(ab, zh, audio, type, language, dialect, note_source, collection_id, ind_learn_collections(name, language))')
    .or(`due_at.is.null,due_at.lte.${now}`)
    .is('suspended_at', null)
    .order('due_at', { ascending: true, nullsFirst: true })
    .limit(20)

  if (opts.flagColor === 'any') q = q.not('flag_color', 'is', null)
  else if (opts.flagColor)      q = q.eq('flag_color', opts.flagColor)

  const { data, error } = await q
  if (error) { console.error('listDueFlashcards:', error); return [] }
  return (data ?? []) as FlashcardWithItem[]
}

// Used when a mature card completes its relearn burst (Good/Easy = 50% recovery).
export async function rateCardRelearn(
  flashcardId: string,
  rating: 'good' | 'easy' | 'again',
  currentState: SMState,
  lapsedInterval: number,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { due_at, new_state } = nextRelearn(currentState, rating, lapsedInterval)
  const today = new Date().toISOString().slice(0, 10)

  await Promise.all([
    supabase.from('ind_flashcards').update({
      due_at,
      ease_factor:   new_state.ease_factor,
      interval_days: new_state.interval_days,
      repetitions:   new_state.repetitions,
    }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating, due_at }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
}

export async function resetCollectionSRS(collectionId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: notes } = await supabase
    .from('ind_items')
    .select('id')
    .eq('collection_id', collectionId)
    .limit(10000)

  if (!notes?.length) return
  const noteIds = notes.map(n => n.id)

  const CHUNK = 100
  for (let i = 0; i < noteIds.length; i += CHUNK) {
    await supabase.from('ind_flashcards')
      .update({ ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null })
      .eq('user_id', user.id)
      .in('note_id', noteIds.slice(i, i + CHUNK))
  }
}

export async function resetCapturesSRS(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Reset flashcards whose note is not a collection card
  const { data: notes } = await supabase
    .from('ind_items')
    .select('id')
    .eq('user_id', user.id)
    .neq('note_source', 'collection')
    .limit(10000)

  if (!notes?.length) return
  const noteIds = notes.map(n => n.id)

  const CHUNK = 100
  for (let i = 0; i < noteIds.length; i += CHUNK) {
    await supabase.from('ind_flashcards')
      .update({ ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null })
      .eq('user_id', user.id)
      .in('note_id', noteIds.slice(i, i + CHUNK))
  }
}

export async function suspendCard(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ suspended_at: new Date().toISOString() }).eq('id', id)
}

export async function unsuspendCard(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ suspended_at: null }).eq('id', id)
}

export async function setFlagColor(id: string, color: string | null): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ flag_color: color }).eq('id', id)
}

// currentState is passed in from the caller (already loaded via listDueFlashcards)
// to avoid an extra DB round-trip.
export async function rateCard(
  flashcardId: string,
  rating: Rating,
  currentState: SMState,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { due_at, new_state } = nextFormoSRS1(currentState, rating)
  const today = new Date().toISOString().slice(0, 10)

  await Promise.all([
    supabase.from('ind_flashcards').update({
      due_at,
      ease_factor:   new_state.ease_factor,
      interval_days: new_state.interval_days,
      repetitions:   new_state.repetitions,
    }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating, due_at }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
}
