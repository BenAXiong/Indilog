import { createClient } from '@/lib/supabase/client'

export type BrowserCard = {
  id: string
  front: string
  back: string
  due_at: string | null
  ease_factor: number
  interval_days: number
  repetitions: number
  created_at: string
  source: string
  sourceType: 'collection' | 'capture'
}

export type BrowserFilter = 'all' | 'due' | 'new'
export type BrowserSort   = 'due' | 'ease' | 'added'

export async function listBrowserCards(
  filter: BrowserFilter,
  sort: BrowserSort,
): Promise<BrowserCard[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const now = new Date().toISOString()

  let q = supabase
    .from('ind_flashcards')
    .select('id, front, back, due_at, ease_factor, interval_days, repetitions, created_at, item_id, ind_learn_cards(collection_id, ind_learn_collections(name))')
    .eq('user_id', user.id)

  if (filter === 'due') {
    q = q.or(`due_at.is.null,due_at.lte.${now}`)
  } else if (filter === 'new') {
    q = q.eq('repetitions', 0)
  }

  switch (sort) {
    case 'due':   q = q.order('due_at',   { ascending: true, nullsFirst: true }); break
    case 'ease':  q = q.order('ease_factor', { ascending: true }); break
    case 'added': q = q.order('created_at', { ascending: false }); break
  }

  const { data } = await q.limit(500)
  if (!data) return []

  return data.map(row => {
    type LC = { collection_id: string; ind_learn_collections: { name: string } | null } | null
    const lc     = row.ind_learn_cards as unknown as LC
    const source = lc?.ind_learn_collections?.name ?? (row.item_id ? 'Captures' : '—')
    return {
      id:            row.id,
      front:         row.front,
      back:          row.back,
      due_at:        row.due_at,
      ease_factor:   row.ease_factor,
      interval_days: row.interval_days,
      repetitions:   row.repetitions,
      created_at:    row.created_at,
      source,
      sourceType: row.item_id ? 'capture' : 'collection',
    } as BrowserCard
  })
}

export async function updateCardFrontBack(id: string, front: string, back: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ front, back }).eq('id', id)
}

export async function resetCardEase(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({
    ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null,
  }).eq('id', id)
}
