import { createClient } from '@/lib/supabase/client'

export type DeckRootedStats = { total: number; rooted: number }

export async function getDeckRootedStats(collectionId: string): Promise<DeckRootedStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, rooted: 0 }

  const [totalRes, rootedRes] = await Promise.all([
    supabase
      .from('ind_flashcards')
      .select('id, ind_items!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_items.collection_id', collectionId)
      .is('suspended_at', null),
    supabase
      .from('ind_flashcards')
      .select('id, ind_items!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_items.collection_id', collectionId)
      .is('suspended_at', null)
      .gte('interval_days', 21)
      .gte('repetitions', 5)
      .gte('ease_factor', 2.5),
  ])

  return { total: totalRes.count ?? 0, rooted: rootedRes.count ?? 0 }
}

export type DeckMasteryStats = { total: number; seed: number; planted: number; rooted: number; blooming: number }

export async function getDeckMasteryStats(collectionId: string): Promise<DeckMasteryStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, seed: 0, planted: 0, rooted: 0, blooming: 0 }

  const sel = 'id, ind_items!inner(collection_id)'
  const base = { count: 'exact' as const, head: true }
  const match = (q: ReturnType<typeof supabase.from>) =>
    q.select(sel, base).eq('user_id', user.id).eq('ind_items.collection_id', collectionId)

  const [totalRes, seedRes, bloomingRes, rootedRes] = await Promise.all([
    match(supabase.from('ind_flashcards')).is('suspended_at', null),
    match(supabase.from('ind_flashcards')).is('suspended_at', null).eq('repetitions', 0),
    match(supabase.from('ind_flashcards')).is('suspended_at', null).gt('repetitions', 0).gte('interval_days', 60),
    match(supabase.from('ind_flashcards')).is('suspended_at', null).gte('repetitions', 5).gte('interval_days', 21).lt('interval_days', 60).gte('ease_factor', 2.5),
  ])

  const total    = totalRes.count    ?? 0
  const seed     = seedRes.count     ?? 0
  const blooming = bloomingRes.count ?? 0
  const rooted   = rootedRes.count   ?? 0
  return { total, seed, blooming, rooted, planted: Math.max(0, total - seed - blooming - rooted) }
}

