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
    language: card.ind_items?.language ?? '',
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
    supabase.from('ind_items').select('id, target_word').eq('user_id', user.id),
  ])

  if (!items?.length) return
  const existingIds = new Set(existing?.map(r => r.note_id) ?? [])
  const newItems = items.filter(i => !existingIds.has(i.id))
  if (!newItems.length) return

  await supabase.from('ind_flashcards').insert(
    newItems.map(item => ({
      user_id: user.id,
      note_id: item.id,
      ...(item.target_word ? {
        card_type: 'sts',
        metadata: { target_word: item.target_word, layout: 'word' },
      } : {}),
    }))
  )
}

export async function setTargetWord(noteId: string, targetWord: string | null): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('ind_items').update({ target_word: targetWord }).eq('id', noteId).eq('user_id', user.id)

  const { data: existing } = await supabase
    .from('ind_flashcards').select('id').eq('note_id', noteId).eq('user_id', user.id).maybeSingle()

  const cardType = targetWord ? 'sts' : 'default'
  const metadata = targetWord ? { target_word: targetWord, layout: 'word' } : null

  if (existing) {
    await supabase.from('ind_flashcards').update({ card_type: cardType, metadata }).eq('id', existing.id)
  } else {
    await supabase.from('ind_flashcards').insert({ user_id: user.id, note_id: noteId, card_type: cardType, metadata })
  }
}


function getStudyDate(): string {
  const resetHour = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
    : 4
  const now = new Date()
  if (now.getHours() < resetHour) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return now.toISOString().slice(0, 10)
}

export async function getExcludeFromReview(): Promise<{ collections: string[]; captures: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { collections: [], captures: false }
  const [colRes, profRes] = await Promise.all([
    supabase.from('ind_learn_collections').select('id').eq('user_id', user.id).eq('include_in_review', false),
    supabase.from('ind_profiles').select('include_in_review').eq('user_id', user.id).maybeSingle(),
  ])
  return {
    collections: (colRes.data ?? []).map(r => r.id as string),
    captures:    !((profRes.data?.include_in_review as boolean) ?? true),
  }
}

export type DueStats = {
  total: number
  captures: number
  byCollection: Record<string, number>
}

export async function listUserLanguages(): Promise<string[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('ind_items')
    .select('language')
    .eq('user_id', user.id)
    .limit(10000)
  return [...new Set((data ?? []).map(r => r.language).filter(Boolean) as string[])].sort()
}

export async function getDueStats(
  opts: { excludeLangs?: string[]; excludeCollections?: string[]; excludeCaptures?: boolean } = {},
): Promise<DueStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, captures: 0, byCollection: {} }

  const now = new Date().toISOString()
  const { data } = await supabase
    .from('ind_flashcards')
    .select('note_id, ind_items(note_source, collection_id, language)')
    .eq('user_id', user.id)
    .or(`due_at.is.null,due_at.lte.${now}`)
    .is('suspended_at', null)
    .limit(10000)

  if (!data) return { total: 0, captures: 0, byCollection: {} }

  let total = 0
  let captures = 0
  const byCollection: Record<string, number> = {}
  type NoteRef = { note_source: string; collection_id: string | null; language: string }
  for (const row of data) {
    const note = row.ind_items as unknown as NoteRef | null
    if (opts.excludeLangs?.length && opts.excludeLangs.includes(note?.language ?? '')) continue
    const colId = note?.note_source === 'collection' ? note.collection_id : null
    if (colId) {
      if (opts.excludeCollections?.includes(colId)) continue
      total++
      byCollection[colId] = (byCollection[colId] ?? 0) + 1
    } else {
      if (opts.excludeCaptures) continue
      total++
      captures++
    }
  }
  return { total, captures, byCollection }
}

export type ListDueOpts = {
  flagColor?:          string | 'any'
  // global exclusions (Review all mode)
  excludeLangs?:       string[]
  excludeCollections?: string[]
  excludeCaptures?:    boolean
  // custom session inclusions (bypass exclusions)
  includeLangs?:       string[]
  includeDialect?:     string
  includeCollectionId?: string
  capturesOnly?:       boolean
  dueOnly?:            boolean   // default true; false = all non-suspended cards
}

export async function listDueFlashcards(opts: ListDueOpts = {}): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  let q = supabase
    .from('ind_flashcards')
    .select('*, ind_items(ab, zh, audio, type, language, dialect, note_source, collection_id, ind_learn_collections(name, language))')
    .is('suspended_at', null)
    .order('due_at', { ascending: true, nullsFirst: true })
    .limit(10000)

  if (opts.dueOnly !== false) q = q.or(`due_at.is.null,due_at.lte.${now}`)
  if (opts.flagColor === 'any') q = q.not('flag_color', 'is', null)
  else if (opts.flagColor)      q = q.eq('flag_color', opts.flagColor)

  const { data, error } = await q
  if (error) { console.error('listDueFlashcards:', error); return [] }
  let results = (data ?? []) as FlashcardWithItem[]

  // Global exclusions (Review all)
  if (opts.excludeLangs?.length)
    results = results.filter(c => !opts.excludeLangs!.includes(c.ind_items?.language ?? ''))
  if (opts.excludeCollections?.length || opts.excludeCaptures)
    results = results.filter(c => {
      const note = c.ind_items
      if (note?.note_source === 'collection' && note.collection_id)
        return !opts.excludeCollections?.includes(note.collection_id)
      return !opts.excludeCaptures
    })

  // Custom session inclusions
  if (opts.includeLangs?.length)
    results = results.filter(c => opts.includeLangs!.includes(c.ind_items?.language ?? ''))
  if (opts.includeDialect)
    results = results.filter(c => c.ind_items?.dialect === opts.includeDialect)
  if (opts.includeCollectionId)
    results = results.filter(c => c.ind_items?.collection_id === opts.includeCollectionId)
  else if (opts.capturesOnly)
    results = results.filter(c => c.ind_items?.note_source !== 'collection')

  return results
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
  const today = getStudyDate()

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

async function wipeReviewsAndReset(supabase: ReturnType<typeof createClient>, userId: string, noteIds: string[]): Promise<void> {
  const CHUNK = 100
  // Collect flashcard IDs so we can wipe ind_reviews (one Card per Note, but chunk for safety)
  const cardIds: string[] = []
  for (let i = 0; i < noteIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('ind_flashcards')
      .select('id')
      .eq('user_id', userId)
      .in('note_id', noteIds.slice(i, i + CHUNK))
    cardIds.push(...(data ?? []).map((c: { id: string }) => c.id))
  }
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    await supabase.from('ind_reviews')
      .delete()
      .eq('user_id', userId)
      .in('flashcard_id', cardIds.slice(i, i + CHUNK))
  }
  for (let i = 0; i < noteIds.length; i += CHUNK) {
    await supabase.from('ind_flashcards')
      .update({ ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null })
      .eq('user_id', userId)
      .in('note_id', noteIds.slice(i, i + CHUNK))
  }
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
  await wipeReviewsAndReset(supabase, user.id, notes.map(n => n.id))
}

export async function resetCapturesSRS(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: notes } = await supabase
    .from('ind_items')
    .select('id')
    .eq('user_id', user.id)
    .neq('note_source', 'collection')
    .limit(10000)

  if (!notes?.length) return
  await wipeReviewsAndReset(supabase, user.id, notes.map(n => n.id))
}

export async function deferCard(cardId: string): Promise<void> {
  const supabase = createClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  await supabase.from('ind_flashcards').update({ due_at: tomorrow.toISOString() }).eq('id', cardId)
}

type PrevSMState = { ease_factor: number; interval_days: number; repetitions: number; due_at: string | null }

export async function undoRating(cardId: string, prevState: PrevSMState): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const today = getStudyDate()

  const [, { data: review }] = await Promise.all([
    supabase.from('ind_flashcards').update({
      ease_factor:   prevState.ease_factor,
      interval_days: prevState.interval_days,
      repetitions:   prevState.repetitions,
      due_at:        prevState.due_at,
    }).eq('id', cardId),
    supabase.from('ind_reviews')
      .select('id')
      .eq('flashcard_id', cardId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: stats } = await supabase
    .from('ind_daily_stats')
    .select('reviewed_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  await Promise.all([
    review ? supabase.from('ind_reviews').delete().eq('id', review.id) : Promise.resolve(),
    stats && stats.reviewed_count > 0
      ? supabase.from('ind_daily_stats')
          .update({ reviewed_count: stats.reviewed_count - 1 })
          .eq('user_id', user.id).eq('date', today)
      : Promise.resolve(),
  ])
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
  const today = getStudyDate()

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
