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

  const cardRows: {
    collection_id: string; level: number; lesson: number; position: number; ab: string; zh?: string
  }[] = []

  levels.forEach((lv, li) => {
    lv.lessons.forEach((ls, lsi) => {
      ls.cards.forEach((c, ci) => {
        if (c.ab.trim()) {
          cardRows.push({
            collection_id: col.id,
            level:    li + 1,
            lesson:   lsi + 1,
            position: ci + 1,
            ab: c.ab.trim(),
            zh: c.zh?.trim() || undefined,
          })
        }
      })
    })
  })

  if (cardRows.length > 0) {
    const { error: cardsErr } = await supabase.from('ind_learn_cards').insert(cardRows)
    if (cardsErr) return null
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
  position: number
  ab: string
  zh: string | null
}

export async function listCollectionCards(collectionId: string): Promise<CollectionCard[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_learn_cards')
    .select('id, level, lesson, position, ab, zh')
    .eq('collection_id', collectionId)
    .order('level').order('lesson').order('position')
  return (data ?? []) as CollectionCard[]
}
