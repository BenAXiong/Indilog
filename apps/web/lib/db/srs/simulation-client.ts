import { createClient } from '@/lib/supabase/client'

export type SimulationCurve = {
  learnTarget: number
  reviewTarget: number
}

/**
 * Client-side simulation for the GoalSheet Simulate tab.
 * Computes learnTarget/reviewTarget for a specific set of decks + deadline,
 * regardless of the `in_simulation` flags in the DB.
 */
export async function runSimulation(params: {
  collectionIds: string[]
  deadline: string
  learnCap: number
  reviewCap: number
}): Promise<SimulationCurve> {
  const { collectionIds, deadline, learnCap, reviewCap } = params
  if (!collectionIds.length || !deadline) {
    return { learnTarget: learnCap, reviewTarget: reviewCap }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { learnTarget: learnCap, reviewTarget: reviewCap }

  const today = new Date().toISOString().slice(0, 10)
  const now   = new Date().toISOString()
  const daysRemaining = Math.max(
    1,
    Math.ceil((new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000),
  )

  const PAGE = 1000
  type CardRow = { repetitions: number; suspended_at: string | null; due_at: string | null }
  const allCards: CardRow[] = []
  let from = 0
  while (true) {
    const { data: page } = await supabase
      .from('ind_flashcards')
      .select('repetitions, suspended_at, due_at, ind_items!inner(collection_id)')
      .eq('user_id', user.id)
      .in('ind_items.collection_id', collectionIds)
      .range(from, from + PAGE - 1)
    if (page?.length) allCards.push(...(page as unknown as CardRow[]))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }

  const unsuspended = allCards.filter(c => !c.suspended_at)
  const newCards = unsuspended.filter(c => c.repetitions === 0).length
  const reviewDue = unsuspended.filter(c => c.repetitions > 0 && c.due_at != null && c.due_at <= now).length

  const learnTarget  = Math.max(1, Math.ceil(newCards / daysRemaining))
  // v+: replace with proper SM-2 forward projection per card
  const reviewTarget = Math.max(5, Math.round((reviewDue + learnTarget * 2) / 5) * 5)

  return { learnTarget, reviewTarget }
}

/**
 * 3-row projection curve for the Simulate tab output table.
 * Returns today / 2-week / 3-month estimates.
 */
export function buildCurve(
  today: SimulationCurve,
  totalNewCards: number,
): Array<{ label: string; learnTarget: number; reviewTarget: number }> {
  const learned2w = Math.min(today.learnTarget * 14, totalNewCards)
  const remaining2w = Math.max(0, totalNewCards - learned2w)
  const learn2w  = remaining2w > 0 ? today.learnTarget : 0
  const review2w = Math.max(5, Math.round((today.reviewTarget * 1.2) / 5) * 5)

  // At 3 months, assume all new cards are learned; review is steady-state
  const learn3mo  = 0
  const review3mo = Math.max(5, Math.round((totalNewCards / 21) / 5) * 5)

  return [
    { label: 'Today',    learnTarget: today.learnTarget,  reviewTarget: today.reviewTarget },
    { label: '2 weeks',  learnTarget: learn2w,            reviewTarget: review2w           },
    { label: '3 months', learnTarget: learn3mo,           reviewTarget: review3mo          },
  ]
}
