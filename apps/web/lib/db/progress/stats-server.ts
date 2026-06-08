import { unstable_noStore as noStore } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { computeSimulation } from '@/lib/db/srs/simulation'
import type { LocalDateString } from '@/lib/db/srs/flashcards'

function dateStep(dateStr: LocalDateString, days: number): LocalDateString {
  const [y, m, d] = dateStr.split('-').map(Number)
  const r = new Date(y, m - 1, d + days)
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}` as LocalDateString
}

export type DashboardStats = {
  // SRS widgets
  streak: number
  chain: boolean[]          // last 7 days: reviewed_count > 0
  reviewedToday: number
  learnedToday: number
  dailyGoal: number
  dueCount: number
  totalDue: number
  newCount: number          // repetitions===0, not suspended
  dueTomorrow: number
  learnTarget: number       // frozen for today, from simulation or learn_cap pref
  reviewTarget: number      // frozen for today, from simulation or review_cap pref
  tomorrowLearnTarget: number | null
  tomorrowReviewTarget: number | null
  simulationActive: boolean
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
  reviewedToday: 0, learnedToday: 0, dailyGoal: 20,
  dueCount: 0, totalDue: 0, newCount: 0, dueTomorrow: 0,
  learnTarget: 10, reviewTarget: 100, tomorrowLearnTarget: null, tomorrowReviewTarget: null, simulationActive: false,
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
    newCountRes,
    totalItemsRes,
    recentRes,
    profileRes,
  ] = await Promise.all([
    supabase
      .from('ind_daily_stats')
      .select('date, reviewed_count, captured_count, learned_count, learn_target, review_target')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: false }),

    // 2F: due reviews only — repetitions>0 ensures new cards excluded
    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lte('due_at', now)
      .gt('repetitions', 0)
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

    // 2E: new cards available to learn
    supabase
      .from('ind_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('repetitions', 0)
      .is('suspended_at', null),

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

  // Build lookup map — keyed by LocalDateString so plain toISOString().slice() strings are rejected
  const statsMap = new Map<LocalDateString, { reviewed: number; captured: number; learned: number }>()
  for (const r of dailyRows) {
    statsMap.set(r.date as LocalDateString, {
      reviewed: r.reviewed_count ?? 0,
      captured: r.captured_count ?? 0,
      learned:  (r as Record<string, unknown>).learned_count as number ?? 0,
    })
  }

  const profileData = profileRes.data
  const prefs       = (profileData?.preferences as Record<string, unknown>) ?? {}

  // Use client-set srs_study_date cookie as source of truth
  const cookieStore = await cookies()
  const cookieDate  = cookieStore.get('srs_study_date')?.value
  const resetHour   = (prefs.reset_hour as number) ?? 4
  const today: LocalDateString = (cookieDate ?? (() => {
    const d = new Date()
    if (d.getHours() < resetHour) d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()) as LocalDateString

  // Streak — based on reviewed_count (not captured)
  const reviewSet = new Set(
    dailyRows.filter(r => (r.reviewed_count ?? 0) > 0).map(r => r.date)
  )
  let streak = 0
  let streakCursor = today
  while (reviewSet.has(streakCursor)) {
    streak++
    streakCursor = dateStep(streakCursor, -1)
  }

  // 7-day chain
  const chain: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    chain.push(reviewSet.has(dateStep(today, -i)))
  }

  // This week (last 7 days)
  const weekAgoStr = dateStep(today, -6)
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
      const dateStr = dateStep(today, -daysAgo)
      week.push(reviewLevel(statsMap.get(dateStr)?.reviewed ?? 0))
    }
    heatmap.push(week)

    // Month label: first week of each new month
    const firstDayOfWeekStr = dateStep(today, -(111 - w * 7))
    const firstDayOfWeek = new Date(firstDayOfWeekStr + 'T12:00:00')
    const month = firstDayOfWeek.getMonth()
    if (month === lastMonth) {
      monthLabels.push(null)
    } else {
      monthLabels.push(firstDayOfWeek.toLocaleString('en', { month: 'short' }))
      lastMonth = month
    }
  }


  const todayStats    = statsMap.get(today)
  const reviewedToday = todayStats?.reviewed ?? 0
  const learnedToday  = todayStats?.learned  ?? 0
  const reviewCap     = (prefs.review_cap as number) ?? 100

  // 2E: simulation targets (falls back to pref caps when no sim decks)
  const sim = await computeSimulation(user.id, {
    learn_cap:  (prefs.learn_cap  as number) ?? 10,
    review_cap: reviewCap,
  })

  // Frozen targets: use stored value if already set for today, otherwise use sim output.
  // Fire-and-forget freeze so subsequent loads see the same target even after sessions change counts.
  const frozenLearnTarget  = (todayStats as Record<string, unknown> | undefined)?.learn_target  as number | null ?? null
  const frozenReviewTarget = (todayStats as Record<string, unknown> | undefined)?.review_target as number | null ?? null
  const learnTarget  = frozenLearnTarget  ?? sim.learnTarget
  const reviewTarget = frozenReviewTarget ?? sim.reviewTarget
  if (frozenLearnTarget === null) {
    supabase.rpc('freeze_daily_targets', {
      p_user_id: user.id, p_date: today,
      p_learn_target: learnTarget, p_review_target: reviewTarget,
    }).then(() => {})
  }

  // Cards left today: slots remaining in the review target, bounded by what's actually due
  const dueCount = Math.min(dueRes.count ?? 0, Math.max(0, reviewTarget - reviewedToday))

  return {
    streak,
    chain,
    reviewedToday,
    learnedToday,
    dailyGoal:      profileData?.daily_goal ?? 20,
    dueCount,
    totalDue:       dueRes.count      ?? 0,
    newCount:       newCountRes.count ?? 0,
    dueTomorrow:    dueTomorrowRes.count ?? 0,
    learnTarget,
    reviewTarget,
    tomorrowLearnTarget:  sim.tomorrowLearnTarget,
    tomorrowReviewTarget: sim.fromSimulation ? sim.reviewTarget : null,
    simulationActive: sim.fromSimulation,
    heatmap,
    monthLabels,
    mastered:       masteredRes.count ?? 0,
    active:         activeRes.count   ?? 0,
    thisWeek,
    goalCollectionId: profileData?.goal_collection_id ?? null,
    goalDueDate:      profileData?.goal_due_date       ?? null,
    capturedTotal:  totalItemsRes.count ?? 0,
    capturedToday:  todayStats?.captured ?? 0,
    recentItems:    recentRes.data ?? [],
  }
}
