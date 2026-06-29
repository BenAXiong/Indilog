import { createClient } from '@/lib/supabase/client'

export type PriorityDeckFilterConfig = {
  level: number
  lesson: number
  label: string
}

export type PriorityDeck = {
  id: string
  user_id: string
  collection_id: string | null
  note_source: string | null
  position: number
  in_simulation: boolean
  simulation_deadline: string | null
  filter_config: PriorityDeckFilterConfig | null
}

export type CurriculumUnit = {
  level: number
  lesson: number
  label: string
}

export const VIRTUAL_DECK_LABELS: Record<string, string> = {
  captured:   'Captures',
  dict:       'Dictionary',
  curriculum: 'ePark Saved',
}

// Consistent priority match used by review and learn pages.
// Generic virtual deck (filter_config=null) matches all cards with that note_source.
// Unit rows match only cards whose level+lesson match the filter_config.
export function matchesPriorityDeck(
  deck: PriorityDeck,
  colId: string | null | undefined,
  src: string | null | undefined,
  level?: number | null,
  lesson?: number | null,
): boolean {
  if (deck.collection_id) return deck.collection_id === colId
  if (!deck.note_source || deck.note_source !== src) return false
  if (deck.filter_config) return deck.filter_config.level === level && deck.filter_config.lesson === lesson
  return true
}

export async function listPriorityDecks(userId: string): Promise<PriorityDeck[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_priority_decks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  return (data ?? []) as PriorityDeck[]
}

// Returns distinct (level, lesson) pairs for curriculum items, sorted by level then lesson.
// Relies on RLS; no user_id filter needed client-side.
export async function listCurriculumUnits(): Promise<CurriculumUnit[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_items')
    .select('level, lesson, lesson_title')
    .eq('note_source', 'curriculum')
    .not('level', 'is', null)
    .not('lesson', 'is', null)
  if (!data) return []
  const seen = new Set<string>()
  const units: CurriculumUnit[] = []
  for (const row of data as { level: number; lesson: number; lesson_title: string | null }[]) {
    const key = `${row.level}:${row.lesson}`
    if (seen.has(key)) continue
    seen.add(key)
    units.push({ level: row.level, lesson: row.lesson, label: row.lesson_title ?? `L${row.level}-${row.lesson}` })
  }
  return units.sort((a, b) => a.level - b.level || a.lesson - b.lesson)
}

async function nextPosition(userId: string): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_priority_decks')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
  return ((data?.[0]?.position as number) ?? 0) + 1
}

export async function addPriorityDeck(userId: string, collectionId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_priority_decks').insert({
    user_id: userId,
    collection_id: collectionId,
    position: await nextPosition(userId),
  })
}

export async function addVirtualPriorityDeck(userId: string, noteSource: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_priority_decks').insert({
    user_id: userId,
    note_source: noteSource,
    position: await nextPosition(userId),
  })
}

export async function addCurriculumUnitDeck(
  userId: string,
  level: number,
  lesson: number,
  label: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_priority_decks').insert({
    user_id: userId,
    note_source: 'curriculum',
    filter_config: { level, lesson, label },
    position: await nextPosition(userId),
  })
}

export async function removePriorityDeckById(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('ind_priority_decks')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
  const { data: remaining } = await supabase
    .from('ind_priority_decks')
    .select('id')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (!remaining?.length) return
  for (let i = 0; i < remaining.length; i++) {
    await supabase
      .from('ind_priority_decks')
      .update({ position: i + 1 })
      .eq('id', remaining[i].id)
  }
}

export async function reorderPriorityDecks(userId: string, orderedIds: string[]): Promise<void> {
  const supabase = createClient()
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('ind_priority_decks')
      .update({ position: 10000 + i + 1 })
      .eq('id', orderedIds[i])
      .eq('user_id', userId)
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('ind_priority_decks')
      .update({ position: i + 1 })
      .eq('id', orderedIds[i])
      .eq('user_id', userId)
  }
}

export async function setPriorityDeckSimulation(
  userId: string,
  collectionId: string,
  inSimulation: boolean,
  deadline?: string | null,
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('ind_priority_decks')
    .update({
      in_simulation: inSimulation,
      ...(deadline !== undefined ? { simulation_deadline: deadline } : {}),
    })
    .eq('user_id', userId)
    .eq('collection_id', collectionId)
}
