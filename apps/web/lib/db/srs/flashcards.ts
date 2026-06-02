import { createClient } from '@/lib/supabase/client'
import { nextFormoSRS1, nextRelearn, type SMState, type Rating } from './schedule'

export type { Rating } from './schedule'

export type Flashcard = {
  id: string
  note_id: string
  due_at: string | null
  created_at: string
  ease_factor: number
  interval_days: number
  repetitions: number
  suspended_at: string | null
  flag_color: string | null
  audio:      string | null
}

export type FlashcardWithItem = Flashcard & {
  ind_items: {
    ab: string; zh: string | null; audio: string | null
    type: string; language: string; dialect: string | null; note_source: string
    collection_id: string | null; tags: string[] | null; place_heard: string | null
    ind_learn_collections: { name: string; language: string } | null
  } | null
}

// Extract display metadata from the joined Note
export function cardMeta(card: FlashcardWithItem) {
  return {
    language: card.ind_items?.language ?? '',
    dialect:  card.ind_items?.dialect ?? null,
    type:     card.ind_items?.type ?? 'word',
  }
}

// Resolve audio — priority: card snapshot (curriculum) › note join
export function cardAudio(card: FlashcardWithItem): string | null {
  return card.audio ?? card.ind_items?.audio ?? null
}

export async function ensureFlashcards(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const PAGE = 1000

  // Paginate both queries in parallel — plain .select() is capped at 1000 rows server-side
  const [existingIds, allItems] = await Promise.all([
    (async () => {
      const ids = new Set<string>()
      let from = 0
      while (true) {
        const { data } = await supabase.from('ind_flashcards').select('note_id').eq('user_id', user.id).range(from, from + PAGE - 1)
        if (data?.length) data.forEach(r => ids.add(r.note_id))
        if (!data?.length || data.length < PAGE) break
        from += PAGE
      }
      return ids
    })(),
    (async () => {
      const items: { id: string; target_word: string | null }[] = []
      let from = 0
      while (true) {
        const { data } = await supabase.from('ind_items').select('id, target_word').eq('user_id', user.id).range(from, from + PAGE - 1)
        if (data?.length) items.push(...(data as { id: string; target_word: string | null }[]))
        if (!data?.length || data.length < PAGE) break
        from += PAGE
      }
      return items
    })(),
  ])

  if (!allItems.length) return
  const newItems = allItems.filter(i => !existingIds.has(i.id))
  if (!newItems.length) return

  await supabase.from('ind_flashcards').insert(
    newItems.map(item => ({
      user_id: user.id,
      note_id: item.id,
    }))
  )
}

export async function setTargetWord(noteId: string, targetWord: string | null): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('ind_items').update({ target_word: targetWord }).eq('id', noteId).eq('user_id', user.id)

  const { data: existing } = await supabase
    .from('ind_flashcards').select('id').eq('note_id', noteId).eq('user_id', user.id).maybeSingle()

  if (!existing) {
    await supabase.from('ind_flashcards').insert({ user_id: user.id, note_id: noteId })
  }
}


function getStudyDate(): string {
  const resetHour = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
    : 4
  const now = new Date()
  if (now.getHours() < resetHour) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return now.toISOString().slice(0, 10)
}

export async function getExcludeFromReview(): Promise<{ collections: string[]; captures: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { collections: [], captures: false }
  const [colRes, profRes] = await Promise.all([
    supabase.from('ind_learn_collections').select('id').eq('user_id', user.id).eq('include_in_review', false),
    supabase.from('ind_profiles').select('include_in_review').eq('user_id', user.id).maybeSingle(),
  ])
  return {
    collections: (colRes.data ?? []).map(r => r.id as string),
    captures:    !((profRes.data?.include_in_review as boolean) ?? true),
  }
}

export type DueStats = {
  total: number
  captures: number
  byCollection: Record<string, number>
}

export async function listCustomSessionMeta(): Promise<{ types: string[]; tags: string[]; places: string[] }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { types: [], tags: [], places: [] }
  const { data } = await supabase.from('ind_items').select('type, tags, place_heard').eq('user_id', user.id)
  const types  = [...new Set((data ?? []).map(r => r.type).filter(Boolean) as string[])].sort()
  const tags   = [...new Set((data ?? []).flatMap(r => (r.tags ?? []) as string[]).filter(Boolean))].sort()
  const places = [...new Set((data ?? []).map(r => r.place_heard).filter(Boolean) as string[])].sort()
  return { types, tags, places }
}

export async function listUserLanguages(): Promise<string[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const PAGE = 1000
  const langs: string[] = []
  let from = 0
  while (true) {
    const { data: page } = await supabase.from('ind_items').select('language').eq('user_id', user.id).range(from, from + PAGE - 1)
    if (page?.length) langs.push(...(page.map(r => r.language).filter(Boolean) as string[]))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }
  return [...new Set(langs)].sort()
}

export async function getDueStats(
  opts: { excludeLangs?: string[]; excludeCollections?: string[]; excludeCaptures?: boolean } = {},
): Promise<DueStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, captures: 0, byCollection: {} }

  const now = new Date().toISOString()
  function buildQ() {
    return supabase.from('ind_flashcards')
      .select('note_id, ind_items(note_source, collection_id, language)')
      .eq('user_id', user!.id)
      .or(`due_at.is.null,due_at.lte.${now}`)
      .is('suspended_at', null)
  }

  const PAGE = 1000
  const allRows: { note_id: string; ind_items: unknown }[] = []
  let from = 0
  while (true) {
    const { data: page } = await buildQ().range(from, from + PAGE - 1)
    if (page?.length) allRows.push(...(page as typeof allRows))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }
  const data = allRows
  if (!data.length) return { total: 0, captures: 0, byCollection: {} }

  let total = 0
  let captures = 0
  const byCollection: Record<string, number> = {}
  type NoteRef = { note_source: string; collection_id: string | null; language: string }
  for (const row of data) {
    const note = row.ind_items as unknown as NoteRef | null
    if (opts.excludeLangs?.length && opts.excludeLangs.includes(note?.language ?? '')) continue
    const colId = note?.note_source === 'collection' ? note.collection_id : null
    if (colId) {
      if (opts.excludeCollections?.includes(colId)) continue
      total++
      byCollection[colId] = (byCollection[colId] ?? 0) + 1
    } else {
      if (opts.excludeCaptures) continue
      total++
      captures++
    }
  }
  return { total, captures, byCollection }
}

export type ListDueOpts = {
  flagColor?:           string | 'any' | 'none'
  // global exclusions (Review all mode)
  excludeLangs?:        string[]
  excludeCollections?:  string[]
  excludeCaptures?:     boolean
  // custom session inclusions (bypass exclusions)
  includeLangs?:        string[]
  includeDialect?:      string
  includeCollectionId?: string
  capturesOnly?:        boolean
  includeNoteTypes?:    string[]   // filter by ind_items.type
  includeTags?:        string[]   // OR logic: any of these tags
  includeFlagColors?:  string[]   // OR logic: any of these colors (post-filter; flagColor handles single/any/none at DB level)
  includePlaceHeard?:  string     // exact match on place_heard
  dueOnly?:            boolean    // default true; false = all non-suspended cards
}

export async function listDueFlashcards(opts: ListDueOpts = {}): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const SEL = '*, ind_items(ab, zh, audio, type, language, dialect, note_source, collection_id, level, lesson, position, tags, place_heard, target_word, ind_learn_collections(name, language))'

  // Paginate to work around Supabase's server-side 1000-row cap
  function buildQ() {
    let q = supabase.from('ind_flashcards').select(SEL)
      .is('suspended_at', null)
      .order('due_at', { ascending: true, nullsFirst: true })
    if (opts.dueOnly !== false) q = q.or(`due_at.is.null,due_at.lte.${now}`)
    if      (opts.flagColor === 'any')  q = q.not('flag_color', 'is', null)
    else if (opts.flagColor === 'none') q = q.is('flag_color', null)
    else if (opts.flagColor)            q = q.eq('flag_color', opts.flagColor)
    return q
  }

  const PAGE = 1000
  const pages: FlashcardWithItem[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQ().range(from, from + PAGE - 1)
    if (error) { console.error('listDueFlashcards:', error); break }
    if (data?.length) pages.push(...(data as FlashcardWithItem[]))
    if (!data?.length || data.length < PAGE) break
    from += PAGE
  }
  let results = pages

  // Global exclusions (Review all)
  if (opts.excludeLangs?.length)
    results = results.filter(c => !opts.excludeLangs!.includes(c.ind_items?.language ?? ''))
  if (opts.excludeCollections?.length || opts.excludeCaptures)
    results = results.filter(c => {
      const note = c.ind_items
      if (note?.note_source === 'collection' && note.collection_id)
        return !opts.excludeCollections?.includes(note.collection_id)
      return !opts.excludeCaptures
    })

  // Custom session inclusions
  if (opts.includeLangs?.length)
    results = results.filter(c => opts.includeLangs!.includes(c.ind_items?.language ?? ''))
  if (opts.includeDialect)
    results = results.filter(c => c.ind_items?.dialect === opts.includeDialect)
  if (opts.includeCollectionId)
    results = results.filter(c => c.ind_items?.collection_id === opts.includeCollectionId)
  else if (opts.capturesOnly)
    results = results.filter(c => c.ind_items?.note_source !== 'collection')
  if (opts.includeNoteTypes?.length)
    results = results.filter(c => opts.includeNoteTypes!.includes(c.ind_items?.type ?? ''))
  if (opts.includeTags?.length)
    results = results.filter(c => opts.includeTags!.some(t => (c.ind_items?.tags ?? []).includes(t)))
  if (opts.includeFlagColors?.length)
    results = results.filter(c => opts.includeFlagColors!.includes(c.flag_color ?? ''))
  if (opts.includePlaceHeard)
    results = results.filter(c => c.ind_items?.place_heard === opts.includePlaceHeard)

  return results
}

// Used when a mature card completes its relearn burst (Good/Easy = 50% recovery).
export async function rateCardRelearn(
  flashcardId: string,
  rating: 'good' | 'easy' | 'again',
  currentState: SMState,
  lapsedInterval: number,
  mode?: string,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { due_at, new_state } = nextRelearn(currentState, rating, lapsedInterval)
  const today = getStudyDate()

  await Promise.all([
    supabase.from('ind_flashcards').update({
      due_at,
      ease_factor:   new_state.ease_factor,
      interval_days: new_state.interval_days,
      repetitions:   new_state.repetitions,
    }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating, due_at, mode }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
}

async function wipeReviewsAndReset(supabase: ReturnType<typeof createClient>, userId: string, noteIds: string[]): Promise<void> {
  const CHUNK = 100
  // Collect flashcard IDs so we can wipe ind_reviews (one Card per Note, but chunk for safety)
  const cardIds: string[] = []
  for (let i = 0; i < noteIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('ind_flashcards')
      .select('id')
      .eq('user_id', userId)
      .in('note_id', noteIds.slice(i, i + CHUNK))
    cardIds.push(...(data ?? []).map((c: { id: string }) => c.id))
  }
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    await supabase.from('ind_reviews')
      .delete()
      .eq('user_id', userId)
      .in('flashcard_id', cardIds.slice(i, i + CHUNK))
  }
  for (let i = 0; i < noteIds.length; i += CHUNK) {
    await supabase.from('ind_flashcards')
      .update({ ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null })
      .eq('user_id', userId)
      .in('note_id', noteIds.slice(i, i + CHUNK))
  }
}

export async function resetCollectionSRS(collectionId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const PAGE = 1000; const ids: string[] = []; let from = 0
  while (true) {
    const { data: page } = await supabase.from('ind_items').select('id').eq('collection_id', collectionId).range(from, from + PAGE - 1)
    if (page?.length) ids.push(...page.map((r: { id: string }) => r.id))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }
  if (!ids.length) return
  await wipeReviewsAndReset(supabase, user.id, ids)
}

export async function resetCapturesSRS(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const PAGE = 1000; const ids: string[] = []; let from = 0
  while (true) {
    const { data: page } = await supabase.from('ind_items').select('id').eq('user_id', user.id).neq('note_source', 'collection').range(from, from + PAGE - 1)
    if (page?.length) ids.push(...page.map((r: { id: string }) => r.id))
    if (!page?.length || page.length < PAGE) break
    from += PAGE
  }
  if (!ids.length) return
  await wipeReviewsAndReset(supabase, user.id, ids)
}

export async function deferCard(cardId: string): Promise<void> {
  const supabase = createClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  await supabase.from('ind_flashcards').update({ due_at: tomorrow.toISOString() }).eq('id', cardId)
}

type PrevSMState = { ease_factor: number; interval_days: number; repetitions: number; due_at: string | null }

export async function undoRating(cardId: string, prevState: PrevSMState): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const today = getStudyDate()

  const [, { data: review }] = await Promise.all([
    supabase.from('ind_flashcards').update({
      ease_factor:   prevState.ease_factor,
      interval_days: prevState.interval_days,
      repetitions:   prevState.repetitions,
      due_at:        prevState.due_at,
    }).eq('id', cardId),
    supabase.from('ind_reviews')
      .select('id')
      .eq('flashcard_id', cardId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: stats } = await supabase
    .from('ind_daily_stats')
    .select('reviewed_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  await Promise.all([
    review ? supabase.from('ind_reviews').delete().eq('id', review.id) : Promise.resolve(),
    stats && stats.reviewed_count > 0
      ? supabase.from('ind_daily_stats')
          .update({ reviewed_count: stats.reviewed_count - 1 })
          .eq('user_id', user.id).eq('date', today)
      : Promise.resolve(),
  ])
}

export async function suspendCard(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ suspended_at: new Date().toISOString() }).eq('id', id)
}

export async function unsuspendCard(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ suspended_at: null }).eq('id', id)
}

export async function setFlagColor(id: string, color: string | null): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ flag_color: color }).eq('id', id)
}

// currentState is passed in from the caller (already loaded via listDueFlashcards)
// to avoid an extra DB round-trip.
export async function rateCard(
  flashcardId: string,
  rating: Rating,
  currentState: SMState,
  mode?: string,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { due_at, new_state } = nextFormoSRS1(currentState, rating)
  const today = getStudyDate()

  await Promise.all([
    supabase.from('ind_flashcards').update({
      due_at,
      ease_factor:   new_state.ease_factor,
      interval_days: new_state.interval_days,
      repetitions:   new_state.repetitions,
    }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating, due_at, mode }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
}
