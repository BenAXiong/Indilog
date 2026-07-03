import { createClient } from '@/lib/supabase/client'
import { localDateStr } from './flashcards'
import { getSessionUser } from '@/lib/supabase/session'

export type SimulationDay   = { day: number; learn: number; review: number }
export type SimulationCurve = Array<{ label: string; learnTarget: number; reviewTarget: number }>
export type TodayTarget     = { learnTarget: number; reviewTarget: number }

// ─── FormoSRS-1 deterministic advance (Good rating, no fuzz) ─────────────────
// Mirrors nextFormoSRS1 'good' branch in schedule.ts without randomisation.

function advanceGood(rep: number, interval: number, ease: number) {
  const nextInterval = rep === 0
    ? 1
    : Math.max(1, Math.round(interval * ease))
  return {
    rep:      rep + 1,
    interval: nextInterval,
    ease:     Math.min(4, ease + 0.02),
  }
}

// Collect every day this card will be reviewed, starting from `firstDay`,
// up to (but not including) `maxDay`.
// `state` is the card's state *at* `firstDay` (i.e., when it next comes due).
function reviewDaysFrom(
  firstDay: number,
  state: { rep: number; interval: number; ease: number },
  maxDay: number,
): number[] {
  const days: number[] = []
  let d = firstDay
  let s = state
  while (d < maxDay) {
    days.push(d)
    const next = advanceGood(s.rep, s.interval, s.ease)
    d += Math.ceil(next.interval)
    s  = next
  }
  return days
}

// ─── Main projection ──────────────────────────────────────────────────────────

export async function projectSimulation(params: {
  collectionIds: string[]
  deadline:      string
  learnTarget:      number
}): Promise<{ days: SimulationDay[]; learnTarget: number } | null> {
  const { collectionIds, deadline, learnTarget } = params
  if (!collectionIds.length || !deadline) return null

  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return null

  const todayMs  = new Date(localDateStr()).getTime()
  const daysLeft = Math.max(1, Math.ceil(
    (new Date(deadline).getTime() - todayMs) / 86_400_000,
  ))

  // Fetch current card states for all sim-deck collections
  const PAGE = 1000
  type CardRow = {
    repetitions:   number
    ease_factor:   number
    interval_days: number
    suspended_at:  string | null
    due_at:        string | null
    ind_items: { collection_id: string | null } | null
  }
  const all: CardRow[] = []
  let from = 0
  while (true) {
    const { data: page } = await supabase
      .from('ind_flashcards')
      .select('repetitions, ease_factor, interval_days, suspended_at, due_at, ind_items!inner(collection_id)')
      .eq('user_id', user.id)
      .in('ind_items.collection_id', collectionIds)
      .range(from, from + PAGE - 1)
    if (page?.length) all.push(...(page as unknown as CardRow[]))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }

  const active    = all.filter(c => !c.suspended_at)
  const newCards  = active.filter(c => c.repetitions === 0)
  const graduated = active.filter(c => c.repetitions > 0)

  // Subtract the minimum ripening window so we only count days where a card
  // introduced today can still reach Rooted (interval >= 21d) by the deadline.
  const TIME_TO_ROOTED  = 21
  const effectiveWindow = Math.max(1, daysLeft - TIME_TO_ROOTED)
  const effectiveLearnTarget = Math.max(1, Math.min(learnTarget, Math.ceil(newCards.length / effectiveWindow)))

  // Per-day counters
  const learnLoad  = new Array<number>(daysLeft).fill(0)
  const reviewLoad = new Array<number>(daysLeft).fill(0)

  // ── 1. Already-graduated cards: project from their current due_at ──────────
  for (const card of graduated) {
    const dueDayF = card.due_at
      ? (new Date(card.due_at).getTime() - todayMs) / 86_400_000
      : 0
    const firstDay = Math.max(0, Math.ceil(dueDayF))
    for (const d of reviewDaysFrom(
      firstDay,
      { rep: card.repetitions, interval: card.interval_days, ease: card.ease_factor },
      daysLeft,
    )) {
      reviewLoad[d]++
    }
  }

  // ── 2. New cards graduated at learnTarget/day ─────────────────────────────
  // All cards graduating on day g share the same review schedule, so compute
  // once and multiply — avoids O(n_cards) loops for large decks.
  let remaining = newCards.length
  for (let g = 0; g < daysLeft && remaining > 0; g++) {
    const graduating = Math.min(effectiveLearnTarget, remaining)
    remaining    -= graduating
    learnLoad[g]  = graduating

    // Learn graduation: rep=1, interval=0.5d, ease=2.5 (matches graduateLearnCard)
    // First review: g + ceil(0.5) = g+1
    const reviewDays = reviewDaysFrom(
      g + 1,
      { rep: 1, interval: 0.5, ease: 2.5 },
      daysLeft,
    )
    for (const d of reviewDays) reviewLoad[d] += graduating
  }

  const days: SimulationDay[] = Array.from({ length: daysLeft }, (_, d) => ({
    day:    d,
    learn:  learnLoad[d],
    review: reviewLoad[d],
  }))

  return { days, learnTarget: effectiveLearnTarget }
}

// ─── Curve table for GoalSheet ────────────────────────────────────────────────

export function buildCurveFromDays(
  days: SimulationDay[],
): SimulationCurve {
  function row(label: string, d: SimulationDay) {
    return { label, learnTarget: d.learn, reviewTarget: d.review }
  }
  function pick(targetDay: number) {
    return days[Math.min(targetDay, days.length - 1)]
  }

  const curve: SimulationCurve = [row('Today', pick(0))]
  if (days.length > 14) curve.push(row('2 weeks',  pick(14)))
  if (days.length > 60) curve.push(row('At deadline', pick(Math.floor(days.length * 0.8))))
  else                  curve.push(row('At deadline', pick(days.length - 1)))

  return curve
}
