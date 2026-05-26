import { createClient } from '@/lib/supabase/server'

export type DashboardStats = {
  streak: number
  capturedTotal: number
  capturedToday: number
  reviewedToday: number
  dueCount: number
  lessonsCompleted: number
  recentItems: {
    id: string
    text: string
    type: string
    language: string
    created_at: string
  }[]
}

const EMPTY: DashboardStats = {
  streak: 0, capturedTotal: 0, capturedToday: 0,
  reviewedToday: 0, dueCount: 0, lessonsCompleted: 0, recentItems: [],
}

export async function getDashboardStats(language = 'ami'): Promise<DashboardStats> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const today = new Date().toISOString().slice(0, 10)
  const now   = new Date().toISOString()

  const [statsRes, totalRes, recentRes, dueRes, streakRows, lessonsRes] = await Promise.all([
    supabase
      .from('ind_daily_stats')
      .select('captured_count, reviewed_count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),

    supabase
      .from('ind_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('ind_items')
      .select('id, text, type, language, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or(`due_at.is.null,due_at.lte.${now}`),

    supabase
      .from('ind_daily_stats')
      .select('date, captured_count')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(60),

    supabase.rpc('get_completion_count', { p_user_id: user.id, p_language: language }),
  ])

  let streak = 0
  if (streakRows.data) {
    const dateSet = new Set(
      streakRows.data.filter(r => r.captured_count > 0).map(r => r.date)
    )
    const cursor = new Date()
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  return {
    streak,
    capturedTotal:    totalRes.count ?? 0,
    capturedToday:    statsRes.data?.captured_count ?? 0,
    reviewedToday:    statsRes.data?.reviewed_count ?? 0,
    dueCount:         dueRes.count ?? 0,
    lessonsCompleted: (lessonsRes.data as number | null) ?? 0,
    recentItems:      recentRes.data ?? [],
  }
}
