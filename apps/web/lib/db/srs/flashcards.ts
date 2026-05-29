import { createClient } from '@/lib/supabase/client'

export type Flashcard = {
  id: string
  item_id: string | null
  collection_card_id: string | null
  front: string
  back: string
  due_at: string | null
  created_at: string
}

export type FlashcardWithItem = Flashcard & {
  ind_items: { type: string; language: string; dialect: string | null } | null
  ind_learn_cards: { ind_learn_collections: { name: string; language: string } | null } | null
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

export type Rating = 'again' | 'hard' | 'good' | 'easy'

const INTERVALS: Record<Rating, number> = {
  again: 10 * 60 * 1000,
  hard:  1  * 24 * 60 * 60 * 1000,
  good:  3  * 24 * 60 * 60 * 1000,
  easy:  7  * 24 * 60 * 60 * 1000,
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
      .select('collection_card_id')
      .eq('user_id', user.id)
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
        front: c.ab,
        back:  c.zh ?? '(no translation)',
      }))
    )
    if (error) { console.error('generateFlashcardsFromCollection chunk:', error); return i }
  }

  return newCards.length
}

export async function listDueFlashcards(): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ind_flashcards')
    .select('*, ind_items(type, language, dialect), ind_learn_cards(ind_learn_collections(name, language))')
    .or(`due_at.is.null,due_at.lte.${now}`)
    .order('due_at', { ascending: true, nullsFirst: true })
    .limit(20)

  if (error) { console.error('listDueFlashcards:', error); return [] }
  return (data ?? []) as FlashcardWithItem[]
}

export async function rateCard(flashcardId: string, rating: Rating): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const due_at = new Date(Date.now() + INTERVALS[rating]).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  await Promise.all([
    supabase.from('ind_flashcards').update({ due_at }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating, due_at }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
}
