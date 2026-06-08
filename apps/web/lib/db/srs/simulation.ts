import { createClient } from '@/lib/supabase/server'

export type SimulationResult = {
  learnTarget: number
  reviewTarget: number
  tomorrowLearnTarget: number | null  // null when not from simulation
  /** true when targets come from the simulation, false when using manual caps */
  fromSimulation: boolean
}

export async function computeSimulation(
  userId: string,
  prefs: { learn_cap: number; review_cap: number },
): Promise<SimulationResult> {
  const supabase = await createClient()

  const { data: simDecks } = await supabase
    .from('ind_priority_decks')
    .select('collection_id, simulation_deadline')
    .eq('user_id', userId)
    .eq('in_simulation', true)

  if (!simDecks?.length) {
    return { learnTarget: prefs.learn_cap, reviewTarget: prefs.review_cap, tomorrowLearnTarget: null, fromSimulation: false }
  }

  const collectionIds = simDecks.map(d => d.collection_id as string)
  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const PAGE = 1000
  type CardRow = {
    repetitions: number
    suspended_at: string | null
    due_at: string | null
    ind_items: { collection_id: string | null } | null
  }
  const allCards: CardRow[] = []
  let from = 0
  while (true) {
    const { data: page } = await supabase
      .from('ind_flashcards')
      .select('repetitions, suspended_at, due_at, ind_items!inner(collection_id)')
      .eq('user_id', userId)
      .in('ind_items.collection_id', collectionIds)
      .range(from, from + PAGE - 1)
    if (page?.length) allCards.push(...(page as unknown as CardRow[]))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }

  let totalNewCards = 0
  let existingReviewDue = 0
  let minDaysRemaining = Infinity

  for (const deck of simDecks) {
    const deadline = deck.simulation_deadline as string | null
    if (!deadline) continue

    const daysRemaining = Math.max(
      1,
      Math.ceil((new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000),
    )
    if (daysRemaining < minDaysRemaining) minDaysRemaining = daysRemaining

    const deckCards = allCards.filter(
      c => c.ind_items?.collection_id === deck.collection_id && !c.suspended_at,
    )
    totalNewCards += deckCards.filter(c => c.repetitions === 0).length
    existingReviewDue += deckCards.filter(
      c => c.repetitions > 0 && c.due_at != null && c.due_at <= now,
    ).length
  }

  if (minDaysRemaining === Infinity) {
    return { learnTarget: prefs.learn_cap, reviewTarget: prefs.review_cap, tomorrowLearnTarget: null, fromSimulation: false }
  }

  const learnTarget = Math.max(1, Math.ceil(totalNewCards / minDaysRemaining))
  const reviewTarget = Math.max(prefs.review_cap ?? 100, existingReviewDue)

  // Tomorrow: one day consumed, learnTarget fewer new cards remaining
  const tomorrowNewCards    = Math.max(0, totalNewCards - learnTarget)
  const tomorrowDaysLeft    = Math.max(1, minDaysRemaining - 1)
  const tomorrowLearnTarget = minDaysRemaining > 1
    ? Math.max(1, Math.ceil(tomorrowNewCards / tomorrowDaysLeft))
    : 0

  return { learnTarget, reviewTarget, tomorrowLearnTarget, fromSimulation: true }
}
