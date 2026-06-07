import { createClient } from '@/lib/supabase/client'
import { localDateStr } from './flashcards'

export type CollectionStat = {
  id: string
  name: string
  total: number
  known: number    // interval_days >= 21
}

export type StudyStats = {
  totalCards: number
  dueToday: number
  known: number        // ease_factor >= 2.5 AND interval_days >= 21 (used for coverage bars)
  rooted: number       // interval_days >= 21 AND repetitions >= 5 AND ease_factor >= 2.5
  blooming: number     // interval_days >= 60
  captures: CollectionStat   // non-collection notes (captured, dict, curriculum)
  collections: CollectionStat[]
  dailyCounts: Array<{ date: string; count: number }>  // last 14 days
  avgPerDay: number
}

const EMPTY: StudyStats = {
  totalCards: 0, dueToday: 0, known: 0, rooted: 0, blooming: 0,
  captures: { id: 'captures', name: 'Captures & lookups', total: 0, known: 0 },
  collections: [], dailyCounts: [], avgPerDay: 0,
}

type NoteJoin = {
  note_source: string
  collection_id: string | null
  ind_learn_collections: { id: string; name: string } | null
} | null

function accumulateCard(
  note: NoteJoin,
  isKnown: boolean,
  colMap: Map<string, CollectionStat>,
  captures: { total: number; known: number },
): void {
  if (note?.note_source === 'collection' && note.collection_id) {
    const colId   = note.collection_id
    const colName = note.ind_learn_collections?.name ?? colId
    const existing = colMap.get(colId)
    const entry = existing ?? { id: colId, name: colName, total: 0, known: 0 }
    if (!existing) colMap.set(colId, entry)
    entry.total++
    if (isKnown) entry.known++
  } else {
    captures.total++
    if (isKnown) captures.known++
  }
}

export async function getStudyStats(): Promise<StudyStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const now = new Date().toISOString()
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)
  const fromDate = localDateStr(twoWeeksAgo)

  const [cardsRes, dailyRes] = await Promise.all([
    supabase
      .from('ind_flashcards')
      .select('ease_factor, interval_days, repetitions, due_at, suspended_at, ind_items(note_source, collection_id, ind_learn_collections(id, name))')
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
  let dueToday = 0, known = 0, rooted = 0, blooming = 0
  const captures = { total: 0, known: 0 }
  const colMap   = new Map<string, CollectionStat>()

  for (const card of cards) {
    const suspended = !!card.suspended_at
    const isKnown   = card.ease_factor >= 2.5 && card.interval_days >= 21
    const isDue     = (!card.due_at || card.due_at <= now) && !suspended

    if (isKnown) known++
    if (card.interval_days >= 60) blooming++
    if (card.interval_days >= 21 && (card as Record<string, unknown>).repetitions as number >= 5 && card.ease_factor >= 2.5) rooted++
    if (isDue)   dueToday++

    accumulateCard(card.ind_items as unknown as NoteJoin, isKnown, colMap, captures) // NOSONAR — TS2352 without unknown bridge
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
    const dateStr = localDateStr(d)
    dailyCounts.push({ date: dateStr, count: dailyMap.get(dateStr) ?? 0 })
  }

  const activeDays    = dailyCounts.filter(d => d.count > 0).length
  const totalReviewed = dailyCounts.reduce((s, d) => s + d.count, 0)
  const avgPerDay     = activeDays > 0 ? Math.round(totalReviewed / activeDays) : 0

  return {
    totalCards: cards.length,
    dueToday,
    known,
    rooted,
    blooming,
    captures: { id: 'captures', name: 'Captures & lookups', total: captures.total, known: captures.known },
    collections: Array.from(colMap.values()).sort((a, b) => b.total - a.total),
    dailyCounts,
    avgPerDay,
  }
}
