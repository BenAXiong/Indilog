import { createClient } from '@/lib/supabase/client'

export type PriorityDeck = {
  id: string
  user_id: string
  collection_id: string | null
  note_source: string | null
  position: number
  in_simulation: boolean
  simulation_deadline: string | null
}

export const VIRTUAL_DECK_LABELS: Record<string, string> = {
  captured:   'Captures',
  dict:       'Dictionary',
  curriculum: 'ePark Saved',
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
