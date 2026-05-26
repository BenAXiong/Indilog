import { createClient } from '@/lib/supabase/client'

export type DashboardStats = {
  streak: number
  capturedTotal: number
  capturedToday: number
  reviewedToday: number
  dueCount: number
  recentItems: {
    id: string
    text: string
    type: string
    language: string
    created_at: string
  }[]
}

export async function getDashboardStats(language?: string): Promise<DashboardStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const empty: DashboardStats = {
    streak: 0, capturedTotal: 0, capturedToday: 0,
    reviewedToday: 0, dueCount: 0, recentItems: [],
  }
  if (!user) return empty

  const today = new Date().toISOString().slice(0, 10)

  const [statsRes, totalRes, recentRes, dueRes] = await Promise.all([
    // Today's daily stats row
    supabase
      .from('ind_daily_stats')
      .select('captured_count, reviewed_count, streak_day')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),

    // All-time captured count
    supabase
      .from('ind_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    // 5 most recent items
    supabase
      .from('ind_items')
      .select('id, text, type, language, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Due flashcards count
    supabase
      .from('ind_reviews')
      .select('flashcard_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lte('due_at', new Date().toISOString()),
  ])

  // Streak: count consecutive days with captured_count > 0 ending today
  const { data: streakRows } = await supabase
    .from('ind_daily_stats')
    .select('date, captured_count')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(60)

  let streak = 0
  if (streakRows) {
    const dateSet = new Set(
      streakRows.filter(r => r.captured_count > 0).map(r => r.date)
    )
    const cursor = new Date()
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  return {
    streak,
    capturedTotal: totalRes.count ?? 0,
    capturedToday: statsRes.data?.captured_count ?? 0,
    reviewedToday: statsRes.data?.reviewed_count ?? 0,
    dueCount: dueRes.count ?? 0,
    recentItems: recentRes.data ?? [],
  }
}

export async function incrementCapturedToday(userId: string): Promise<void> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  await supabase.rpc('increment_captured_today', { p_user_id: userId, p_date: today })
}
