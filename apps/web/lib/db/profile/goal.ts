import { createClient } from '@/lib/supabase/client'

export type GoalData = {
  daily_goal:          number
  goal_collection_id:  string | null
  goal_due_date:       string | null  // YYYY-MM-DD
}

export async function getGoalData(): Promise<GoalData> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { daily_goal: 20, goal_collection_id: null, goal_due_date: null }

  const { data } = await supabase
    .from('ind_profiles')
    .select('daily_goal, goal_collection_id, goal_due_date')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    daily_goal:         data?.daily_goal         ?? 20,
    goal_collection_id: data?.goal_collection_id ?? null,
    goal_due_date:      data?.goal_due_date       ?? null,
  }
}

export async function saveGoalData(patch: Partial<GoalData>): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('ind_profiles').update(patch).eq('user_id', user.id)
}

export async function clearGoal(): Promise<void> {
  await saveGoalData({ goal_collection_id: null, goal_due_date: null })
}

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
      .eq('ind_items.collection_id', collectionId),
    supabase
      .from('ind_flashcards')
      .select('id, ind_items!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_items.collection_id', collectionId)
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
    match(supabase.from('ind_flashcards')),
    match(supabase.from('ind_flashcards')).eq('repetitions', 0),
    match(supabase.from('ind_flashcards')).gt('repetitions', 0).gte('interval_days', 60),
    match(supabase.from('ind_flashcards')).gte('repetitions', 5).gte('interval_days', 21).lt('interval_days', 60).gte('ease_factor', 2.5),
  ])

  const total    = totalRes.count    ?? 0
  const seed     = seedRes.count     ?? 0
  const blooming = bloomingRes.count ?? 0
  const rooted   = rootedRes.count   ?? 0
  return { total, seed, blooming, rooted, planted: Math.max(0, total - seed - blooming - rooted) }
}

export type DeckGoalStats = { total: number; mastered: number }

export async function getDeckGoalStats(collectionId: string): Promise<DeckGoalStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, mastered: 0 }

  const [totalRes, masteredRes] = await Promise.all([
    supabase
      .from('ind_flashcards')
      .select('id, ind_items!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_items.collection_id', collectionId),
    supabase
      .from('ind_flashcards')
      .select('id, ind_items!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_items.collection_id', collectionId)
      .gte('interval_days', 21),
  ])

  return {
    total:   totalRes.count   ?? 0,
    mastered: masteredRes.count ?? 0,
  }
}
