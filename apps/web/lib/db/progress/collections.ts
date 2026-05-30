import { createClient } from '@/lib/supabase/client'

export type CardInput    = { ab: string; zh?: string }
export type LessonInput  = { title?: string; cards: CardInput[] }
export type LevelInput   = { lessons: LessonInput[] }

export async function saveCollection(
  name: string,
  language: string,
  levels: LevelInput[],
): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: col, error: colErr } = await supabase
    .from('ind_learn_collections')
    .insert({ user_id: user.id, name, language })
    .select('id')
    .single()
  if (colErr || !col) return null

  const noteRows: {
    user_id: string; collection_id: string; ab: string; zh?: string
    type: string; note_source: string; language: string
    level: number; lesson: number; lesson_title?: string; position: number
  }[] = []

  levels.forEach((lv, li) => {
    lv.lessons.forEach((ls, lsi) => {
      ls.cards.forEach((c, ci) => {
        if (c.ab.trim()) {
          noteRows.push({
            user_id:      user.id,
            collection_id: col.id,
            ab:           c.ab.trim(),
            zh:           c.zh?.trim() || undefined,
            type:         'word',
            note_source:  'collection',
            language:     language,
            level:        li + 1,
            lesson:       lsi + 1,
            lesson_title: ls.title || undefined,
            position:     ci + 1,
          })
        }
      })
    })
  })

  // Insert in chunks of 200 to stay under PostgREST body size limits
  const CHUNK = 200
  for (let i = 0; i < noteRows.length; i += CHUNK) {
    const { error } = await supabase.from('ind_items').insert(noteRows.slice(i, i + CHUNK))
    if (error) {
      console.error('saveCollection notes chunk failed:', error)
      await supabase.from('ind_learn_collections').delete().eq('id', col.id)
      return null
    }
  }

  return col.id
}

export type CollectionMeta = {
  id: string
  name: string
  language: string
  created_at: string
  card_count: number
}

export async function listCollections(language?: string): Promise<CollectionMeta[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  let q = supabase
    .from('ind_learn_collections')
    .select('id, name, language, created_at, ind_learn_cards(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (language) q = q.eq('language', language)
  const { data } = await q
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id:         row.id as string,
    name:       row.name as string,
    language:   row.language as string,
    created_at: row.created_at as string,
    card_count: (row.ind_learn_cards as { count: number }[])?.[0]?.count ?? 0,
  }))
}

export type CollectionCard = {
  id: string
  level: number
  lesson: number
  lesson_title: string | null
  position: number
  ab: string
  zh: string | null
}

export async function listCollectionCards(collectionId: string): Promise<CollectionCard[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_items')
    .select('id, level, lesson, lesson_title, position, ab, zh')
    .eq('collection_id', collectionId)
    .order('level', { ascending: true }).order('lesson', { ascending: true }).order('position', { ascending: true })
    .limit(10000)
  return (data ?? []) as CollectionCard[]
}

export async function renameCollection(id: string, name: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('ind_learn_collections')
    .update({ name })
    .eq('id', id)
  return !error
}

export async function deleteCollection(id: string): Promise<boolean> {
  const supabase = createClient()
  // Delete notes first (flashcards cascade via note_id FK after M3; ind_items has collection_id FK with ON DELETE SET NULL so delete notes explicitly)
  await supabase.from('ind_items').delete().eq('collection_id', id)
  const { error } = await supabase.from('ind_learn_collections').delete().eq('id', id)
  return !error
}
