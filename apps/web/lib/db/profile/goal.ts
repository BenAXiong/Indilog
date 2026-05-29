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

export type DeckGoalStats = { total: number; mastered: number }

export async function getDeckGoalStats(collectionId: string): Promise<DeckGoalStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, mastered: 0 }

  const [totalRes, masteredRes] = await Promise.all([
    supabase
      .from('ind_flashcards')
      .select('id, ind_learn_cards!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_learn_cards.collection_id', collectionId),
    supabase
      .from('ind_flashcards')
      .select('id, ind_learn_cards!inner(collection_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ind_learn_cards.collection_id', collectionId)
      .gte('interval_days', 21),
  ])

  return {
    total:   totalRes.count   ?? 0,
    mastered: masteredRes.count ?? 0,
  }
}
