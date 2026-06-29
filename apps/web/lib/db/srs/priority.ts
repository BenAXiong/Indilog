import { createClient } from '@/lib/supabase/client'
import { getLanguage } from '@/lib/languages'

// filter_config is a flexible bag — curriculum rows use curriculum_source; capture rows use language/dialect.
// Optional fields allow both shapes without a DB migration.
export type PriorityDeckFilterConfig = {
  curriculum_source?: string
  language?: string
  dialect?: string | null
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

export type CaptureLangOption = {
  language: string
  dialect: string | null
  label: string
}

export const VIRTUAL_DECK_LABELS: Record<string, string> = {
  captured: 'Captures',
  dict:     'Dictionary',
}

export const EPARK_SOURCES: { id: string; label: string }[] = [
  { id: 'twelve',       label: 'Lessons'       },
  { id: 'grmpts',       label: 'Patterns'      },
  { id: 'essay',        label: 'Essays'         },
  { id: 'dialogue',     label: 'Dialogues'      },
  { id: 'con_practice', label: 'Conversations'  },
]

// Consistent priority match used by review and learn pages.
// Generic virtual deck (filter_config=null) matches all cards with that note_source.
// Curriculum source: 'twelve' matches items with level set; others share the unlabelled pool.
// Capture filter: matches by language, then optionally dialect (null = any dialect).
export function matchesPriorityDeck(
  deck: PriorityDeck,
  colId: string | null | undefined,
  src: string | null | undefined,
  level?: number | null,
  lesson?: number | null,
  language?: string | null,
  dialect?: string | null,
): boolean {
  if (deck.collection_id) return deck.collection_id === colId
  if (!deck.note_source || deck.note_source !== src) return false
  if (deck.filter_config) {
    const fc = deck.filter_config
    if (fc.curriculum_source) {
      if (fc.curriculum_source === 'twelve') return level != null
      return level == null
    }
    if (fc.language) {
      if (fc.language !== language) return false
      if (fc.dialect && fc.dialect !== dialect) return false
      return true
    }
    return false
  }
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

// Returns distinct (language, dialect) pairs from the user's capture items, sorted by count desc.
export async function listCaptureLanguages(): Promise<CaptureLangOption[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_items')
    .select('language, dialect')
    .eq('note_source', 'captured')
  if (!data) return []
  const seen = new Map<string, CaptureLangOption>()
  for (const row of data as { language: string; dialect: string | null }[]) {
    const key = `${row.language}:${row.dialect ?? ''}`
    if (seen.has(key)) continue
    const langName = getLanguage(row.language)?.name ?? row.language
    const label = row.dialect ?? langName
    seen.set(key, { language: row.language, dialect: row.dialect, label })
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
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

export async function addCurriculumSourceDeck(
  userId: string,
  curriculumSource: string,
  label: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_priority_decks').insert({
    user_id: userId,
    note_source: 'curriculum',
    filter_config: { curriculum_source: curriculumSource, label },
    position: await nextPosition(userId),
  })
}

export async function addCaptureFilterDeck(
  userId: string,
  language: string,
  dialect: string | null,
  label: string,
): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_priority_decks').insert({
    user_id: userId,
    note_source: 'captured',
    filter_config: { language, ...(dialect ? { dialect } : {}), label },
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
