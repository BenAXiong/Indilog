import { createClient } from '@/lib/supabase/client'

export type CollectionStat = {
  id: string
  name: string
  total: number
  known: number    // interval_days >= 21
}

export type StudyStats = {
  totalCards: number
  dueToday: number
  known: number        // ease_factor >= 2.5 AND interval_days >= 21
  mastered: number     // interval_days >= 60
  captures: CollectionStat   // item_id-backed cards
  collections: CollectionStat[]
  dailyCounts: Array<{ date: string; count: number }>  // last 14 days
  avgPerDay: number
}

const EMPTY: StudyStats = {
  totalCards: 0, dueToday: 0, known: 0, mastered: 0,
  captures: { id: 'captures', name: 'Captures & lookups', total: 0, known: 0 },
  collections: [], dailyCounts: [], avgPerDay: 0,
}

export async function getStudyStats(): Promise<StudyStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const now = new Date().toISOString()
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)
  const fromDate = twoWeeksAgo.toISOString().slice(0, 10)

  const [cardsRes, dailyRes] = await Promise.all([
    supabase
      .from('ind_flashcards')
      .select('ease_factor, interval_days, due_at, suspended_at, item_id, collection_card_id, ind_learn_cards(collection_id, ind_learn_collections(id, name))')
      .eq('user_id', user.id)
      .limit(10000),
    supabase
      .from('ind_daily_stats')
      .select('date, reviewed_count')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: true }),
  ])

  const cards = cardsRes.data ?? []

  let totalCards = cards.length
  let dueToday = 0
  let known = 0
  let mastered = 0
  let capturesTotal = 0
  let capturesKnown = 0
  const colMap = new Map<string, CollectionStat>()

  for (const card of cards) {
    const suspended  = !!(card as Record<string, unknown>).suspended_at
    const isKnown    = card.ease_factor >= 2.5 && card.interval_days >= 21
    const isMastered = card.interval_days >= 60
    const isDue      = (!card.due_at || card.due_at <= now) && !suspended

    if (isKnown)    known++
    if (isMastered) mastered++
    if (isDue)      dueToday++

    if (card.item_id) {
      capturesTotal++
      if (isKnown) capturesKnown++
    } else {
      type LearnCard = {
        collection_id: string
        ind_learn_collections: { id: string; name: string } | null
      } | null
      const lc = card.ind_learn_cards as unknown as LearnCard
      if (lc?.collection_id) {
        const colName = lc.ind_learn_collections?.name ?? lc.collection_id
        if (!colMap.has(lc.collection_id)) {
          colMap.set(lc.collection_id, { id: lc.collection_id, name: colName, total: 0, known: 0 })
        }
        const entry = colMap.get(lc.collection_id)!
        entry.total++
        if (isKnown) entry.known++
      }
    }
  }

  // Fill 14-day counts including zeros
  const dailyMap = new Map<string, number>()
  for (const r of (dailyRes.data ?? [])) {
    dailyMap.set(r.date, r.reviewed_count ?? 0)
  }

  const dailyCounts: Array<{ date: string; count: number }> = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    dailyCounts.push({ date: dateStr, count: dailyMap.get(dateStr) ?? 0 })
  }

  const activeDays    = dailyCounts.filter(d => d.count > 0).length
  const totalReviewed = dailyCounts.reduce((s, d) => s + d.count, 0)
  const avgPerDay     = activeDays > 0 ? Math.round(totalReviewed / activeDays) : 0

  return {
    totalCards,
    dueToday,
    known,
    mastered,
    captures: { id: 'captures', name: 'Captures & lookups', total: capturesTotal, known: capturesKnown },
    collections: Array.from(colMap.values()).sort((a, b) => b.total - a.total),
    dailyCounts,
    avgPerDay,
  }
}
