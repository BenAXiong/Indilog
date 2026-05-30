import { createClient } from '@/lib/supabase/client'
import { nextFormoSRS1, nextRelearn, type SMState, type Rating } from './schedule'

export type { Rating } from './schedule'

export type Flashcard = {
  id: string
  item_id: string | null
  collection_card_id: string | null
  front: string
  back: string
  due_at: string | null
  created_at: string
  ease_factor: number
  interval_days: number
  repetitions: number
  suspended_at: string | null
  flag_color:   string | null
  card_type:    string
  audio_url:    string | null
  metadata:     Record<string, unknown> | null
}

export type FlashcardWithItem = Flashcard & {
  ind_items:       { type: string; language: string; dialect: string | null; audio_url: string | null } | null
  ind_learn_cards: { audio_url: string | null; ind_learn_collections: { name: string; language: string } | null } | null
}

// Extract display metadata regardless of flashcard source
export function cardMeta(card: FlashcardWithItem) {
  if (card.ind_items) {
    return {
      language: card.ind_items.language,
      dialect:  card.ind_items.dialect,
      type:     card.ind_items.type,
    }
  }
  return {
    language: card.ind_learn_cards?.ind_learn_collections?.language ?? '',
    dialect:  null,
    type:     'word',
  }
}

// Resolve audio URL — priority: card snapshot (curriculum) › captured item › collection card
export function cardAudio(card: FlashcardWithItem): string | null {
  return card.audio_url
    ?? card.ind_items?.audio_url
    ?? card.ind_learn_cards?.audio_url
    ?? null
}

export async function ensureFlashcards(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [{ data: existing }, { data: items }] = await Promise.all([
    supabase.from('ind_flashcards').select('item_id').eq('user_id', user.id).not('item_id', 'is', null),
    supabase.from('ind_items').select('id, text, notes, meaning, type').eq('user_id', user.id),
  ])

  if (!items?.length) return
  const existingIds = new Set(existing?.map(r => r.item_id) ?? [])
  const newItems = items.filter(i => !existingIds.has(i.id))
  if (!newItems.length) return

  await supabase.from('ind_flashcards').insert(
    newItems.map(item => ({
      user_id: user.id,
      item_id: item.id,
      front: item.text,
      back: item.meaning?.trim() || item.notes?.trim() || (item.type === 'word' ? '(no definition)' : '(no translation)'),
    }))
  )
}

export async function generateFlashcardsFromCollection(collectionId: string): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const [{ data: cards }, { data: existing }] = await Promise.all([
    supabase
      .from('ind_learn_cards')
      .select('id, ab, zh')
      .eq('collection_id', collectionId)
      .limit(10000),
    supabase
      .from('ind_flashcards')
      .select('collection_card_id, card_type')
      .eq('user_id', user.id)
      .not('collection_card_id', 'is', null),
  ])

  if (!cards?.length) return 0
  const existingKeys = new Set(existing?.map(r => `${r.collection_card_id}:${r.card_type ?? 'forward'}`) ?? [])
  const newCards = cards.filter(c => !existingKeys.has(`${c.id}:forward`))
  if (!newCards.length) return 0

  const CHUNK = 200
  for (let i = 0; i < newCards.length; i += CHUNK) {
    const { error } = await supabase.from('ind_flashcards').insert(
      newCards.slice(i, i + CHUNK).map(c => ({
        user_id:            user.id,
        collection_card_id: c.id,
        front: c.ab,
        back:  c.zh ?? '(no translation)',
        card_type: 'forward',
      }))
    )
    if (error) { console.error('generateFlashcardsFromCollection chunk:', error); return i }
  }

  return newCards.length
}

export async function generateReverseCardsForCollection(collectionId: string): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const [{ data: cards }, { data: existing }] = await Promise.all([
    supabase
      .from('ind_learn_cards')
      .select('id, ab, zh')
      .eq('collection_id', collectionId)
      .not('zh', 'is', null)
      .limit(10000),
    supabase
      .from('ind_flashcards')
      .select('collection_card_id, card_type')
      .eq('user_id', user.id)
      .eq('card_type', 'reverse')
      .not('collection_card_id', 'is', null),
  ])

  if (!cards?.length) return 0
  const existingIds = new Set(existing?.map(r => r.collection_card_id) ?? [])
  const newCards = cards.filter(c => !existingIds.has(c.id))
  if (!newCards.length) return 0

  const CHUNK = 200
  for (let i = 0; i < newCards.length; i += CHUNK) {
    const { error } = await supabase.from('ind_flashcards').insert(
      newCards.slice(i, i + CHUNK).map(c => ({
        user_id:            user.id,
        collection_card_id: c.id,
        front: c.zh!,
        back:  c.ab,
        card_type: 'reverse',
      }))
    )
    if (error) { console.error('generateReverseCards chunk:', error); return i }
  }

  return newCards.length
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
    .select('item_id, collection_card_id, ind_learn_cards(collection_id)')
    .eq('user_id', user.id)
    .or(`due_at.is.null,due_at.lte.${now}`)
    .is('suspended_at', null)
    .limit(10000)

  if (!data) return { total: 0, captures: 0, byCollection: {} }

  let captures = 0
  const byCollection: Record<string, number> = {}
  for (const row of data) {
    if (row.item_id) {
      captures++
    } else {
      // PostgREST returns a single object for many-to-one joins
      const card = (row.ind_learn_cards as unknown as { collection_id: string } | null)
      if (card?.collection_id) {
        byCollection[card.collection_id] = (byCollection[card.collection_id] ?? 0) + 1
      }
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
    .select('*, ind_items(type, language, dialect, audio_url), ind_learn_cards(audio_url, ind_learn_collections(name, language))')
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
