import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DashboardStats = {
  // SRS widgets
  streak: number
  chain: boolean[]          // last 7 days: reviewed_count > 0
  reviewedToday: number
  dailyGoal: number
  dueCount: number
  dueTomorrow: number
  heatmap: number[][]       // [week 0..15][day 0..6], level 0-4, week 0 = oldest
  monthLabels: (string | null)[]  // label per week column, null if mid-month
  mastered: number          // ease_factor >= 2.5 AND interval_days >= 21
  active: number            // total flashcards
  thisWeek: number          // sum reviewed_count last 7 days
  // Goal
  goalCollectionId: string | null
  goalDueDate: string | null
  // Legacy
  capturedTotal: number
  capturedToday: number
  recentItems: {
    id: string; ab: string; type: string; language: string; created_at: string
  }[]
}

const EMPTY: DashboardStats = {
  streak: 0, chain: new Array(7).fill(false) as boolean[],
  reviewedToday: 0, dailyGoal: 20,
  dueCount: 0, dueTomorrow: 0,
  heatmap: Array.from({ length: 16 }, () => new Array(7).fill(0) as number[]),
  monthLabels: new Array(16).fill(null) as (string | null)[],
  mastered: 0, active: 0, thisWeek: 0,
  goalCollectionId: null, goalDueDate: null,
  capturedTotal: 0, capturedToday: 0, recentItems: [],
}

function reviewLevel(count: number): number {
  if (count >= 30) return 4
  if (count >= 15) return 3
  if (count >= 6)  return 2
  if (count >= 1)  return 1
  return 0
}

export async function getDashboardStats(language = 'ami'): Promise<DashboardStats> {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const now   = new Date().toISOString()
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // 120-day window covers 16-week heatmap + streak computation
  const from120 = new Date()
  from120.setDate(from120.getDate() - 119)
  const fromDate = from120.toISOString().slice(0, 10)

  const [
    dailyRes,
    dueRes,
    dueTomorrowRes,
    masteredRes,
    activeRes,
    totalItemsRes,
    recentRes,
    profileRes,
  ] = await Promise.all([
    supabase
      .from('ind_daily_stats')
      .select('date, reviewed_count, captured_count')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: false }),

    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or(`due_at.is.null,due_at.lte.${now}`)
      .is('suspended_at', null),

    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('due_at', now)
      .lte('due_at', in24h)
      .is('suspended_at', null),

    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('ease_factor', 2.5)
      .gte('interval_days', 21),

    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('ind_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('ind_items')
      .select('id, ab, type, language, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('ind_profiles')
      .select('daily_goal, goal_collection_id, goal_due_date, preferences')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const dailyRows = dailyRes.data ?? []

  // Build lookup map
  const statsMap = new Map<string, { reviewed: number; captured: number }>()
  for (const r of dailyRows) {
    statsMap.set(r.date, { reviewed: r.reviewed_count ?? 0, captured: r.captured_count ?? 0 })
  }

  // Streak — based on reviewed_count (not captured)
  const reviewSet = new Set(
    dailyRows.filter(r => (r.reviewed_count ?? 0) > 0).map(r => r.date)
  )
  let streak = 0
  const cursor = new Date()
  while (reviewSet.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  // 7-day chain
  const chain: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    chain.push(reviewSet.has(d.toISOString().slice(0, 10)))
  }

  // This week (last 7 days)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)
  const thisWeek = dailyRows
    .filter(r => r.date >= weekAgoStr)
    .reduce((sum, r) => sum + (r.reviewed_count ?? 0), 0)

  // 16-week heatmap [week][day], week 0 = oldest, day 0 = oldest in week
  const heatmap: number[][] = []
  const monthLabels: (string | null)[] = []
  let lastMonth = -1

  for (let w = 0; w < 16; w++) {
    const week: number[] = []
    for (let d = 0; d < 7; d++) {
      const daysAgo = 111 - (w * 7 + d)   // 111 = oldest, 0 = today
      const date = new Date()
      date.setDate(date.getDate() - daysAgo)
      const dateStr = date.toISOString().slice(0, 10)
      week.push(reviewLevel(statsMap.get(dateStr)?.reviewed ?? 0))
    }
    heatmap.push(week)

    // Month label: first week of each new month
    const firstDayOfWeek = new Date()
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (111 - w * 7))
    const month = firstDayOfWeek.getMonth()
    if (month === lastMonth) {
      monthLabels.push(null)
    } else {
      monthLabels.push(firstDayOfWeek.toLocaleString('en', { month: 'short' }))
      lastMonth = month
    }
  }

  const profileData = profileRes.data
  const prefs       = (profileData?.preferences as Record<string, unknown>) ?? {}

  // Honour the user's daily reset hour when determining "today"
  const resetHour   = (prefs.reset_hour as number) ?? 4
  const studyDate   = new Date()
  if (studyDate.getHours() < resetHour) studyDate.setDate(studyDate.getDate() - 1)
  const today       = studyDate.toISOString().slice(0, 10)

  const todayStats    = statsMap.get(today)
  const reviewedToday = todayStats?.reviewed ?? 0
  const cap           = (prefs.daily_cap as number) ?? 100
  // Cards left today: slots remaining in the cap, bounded by what's actually due
  const dueCount      = Math.min(dueRes.count ?? 0, Math.max(0, cap - reviewedToday))

  return {
    streak,
    chain,
    reviewedToday,
    dailyGoal:     profileData?.daily_goal ?? 20,
    dueCount,
    dueTomorrow:   dueTomorrowRes.count ?? 0,
    heatmap,
    monthLabels,
    mastered:      masteredRes.count ?? 0,
    active:        activeRes.count ?? 0,
    thisWeek,
    goalCollectionId: profileData?.goal_collection_id ?? null,
    goalDueDate:      profileData?.goal_due_date       ?? null,
    capturedTotal: totalItemsRes.count ?? 0,
    capturedToday: todayStats?.captured ?? 0,
    recentItems:   recentRes.data ?? [],
  }
}
