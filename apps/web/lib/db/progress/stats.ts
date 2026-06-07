import { createClient } from '@/lib/supabase/client'
import { getStudyDate } from '@/lib/db/srs/flashcards'

export type DashboardStats = {
  streak: number
  capturedTotal: number
  capturedToday: number
  reviewedToday: number
  dueCount: number
  recentItems: {
    id: string
    ab: string
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

  const today = getStudyDate()

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
      .select('id, ab, type, language, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Due flashcards count (null due_at = new card, immediately due)
    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or(`due_at.is.null,due_at.lte.${new Date().toISOString()}`),
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
    let cursor = today
    while (dateSet.has(cursor)) {
      streak++
      const [y,m,d] = cursor.split('-').map(Number); const p = new Date(y,m-1,d-1)
      cursor = `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`
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
  const today = getStudyDate()

  await supabase.rpc('increment_captured_today', { p_user_id: userId, p_date: today })
}
