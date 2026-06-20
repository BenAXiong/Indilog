import { createClient } from '@/lib/supabase/client'
import { nextFormoSRS1, nextRelearn, type SMState, type Rating } from './schedule'
import { listPriorityDecks } from './priority'

export type { Rating } from './schedule'

export type PendingReviewEvent = {
  flashcard_id: string
  rating: string
  due_at: string | null
  mode: string | null
  phase: string
  reviewed_at: string
}

export async function flushReviewEvents(events: PendingReviewEvent[]): Promise<void> {
  if (!events.length) return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('ind_reviews').insert(events.map(e => ({ ...e, user_id: user.id })))
}

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
    target_word: string | null
    level: number | null; lesson: number | null; position: number | null
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

const CARD_SEL = '*, ind_items(ab, zh, audio, type, language, dialect, note_source, collection_id, level, lesson, position, tags, place_heard, target_word, ind_learn_collections(name, language))'

export async function paginate<T>(buildQ: () => any, tag?: string): Promise<T[]> {
  const PAGE = 1000
  const results: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQ().range(from, from + PAGE - 1)
    if (error) { console.error(tag ?? 'paginate:', error); break }
    if (data?.length) results.push(...(data as T[]))
    if (!data?.length || data.length < PAGE) break
    from += PAGE
  }
  return results
}

export async function ensureFlashcards(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Paginate both queries in parallel — plain .select() is capped at 1000 rows server-side
  const [existingRows, allItems] = await Promise.all([
    paginate<{ note_id: string }>(() => supabase.from('ind_flashcards').select('note_id').eq('user_id', user.id)),
    paginate<{ id: string; target_word: string | null }>(() => supabase.from('ind_items').select('id, target_word').eq('user_id', user.id)),
  ])
  const existingIds = new Set(existingRows.map(r => r.note_id))

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


// Branded type: only produced by localDateStr() or getStudyDate().
// Plain strings from new Date().toISOString().slice(0,10) are NOT assignable here,
// forcing an explicit cast that is visible in code review.
declare const __localDate: unique symbol
export type LocalDateString = string & { readonly [__localDate]: true }

export function localDateStr(date: Date = new Date()): LocalDateString {
  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return s as LocalDateString
}

export function getStudyDate(): LocalDateString {
  const resetHour = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
    : 4
  const now = new Date()
  if (now.getHours() < resetHour) {
    const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    return localDateStr(prev)
  }
  return localDateStr(now)
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
  const rows = await paginate<{ language: string }>(
    () => supabase.from('ind_items').select('language').eq('user_id', user.id),
  )
  return [...new Set(rows.map(r => r.language).filter(Boolean))].sort()
}

type DueStatRow = { note_source: string; collection_id: string | null }

export function computeDueStats(rows: DueStatRow[]): DueStats {
  let total = 0, captures = 0
  const byCollection: Record<string, number> = {}
  for (const note of rows) {
    const colId = note.note_source === 'collection' ? note.collection_id : null
    if (colId) {
      total++
      byCollection[colId] = (byCollection[colId] ?? 0) + 1
    } else {
      total++
      captures++
    }
  }
  return { total, captures, byCollection }
}

export async function getDueStats(
  opts: { excludeLangs?: string[]; excludeCollections?: string[]; excludeCaptures?: boolean } = {},
): Promise<DueStats> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, captures: 0, byCollection: {} }

  const now = new Date().toISOString()
  function buildQ() {
    let q = supabase.from('ind_flashcards')
      .select('ind_items(note_source, collection_id)')
      .eq('user_id', user!.id)
      .lte('due_at', now)
      .gt('repetitions', 0)
      .is('suspended_at', null)
    if (opts.excludeLangs?.length)
      q = q.filter('ind_items.language', 'not.in', `(${opts.excludeLangs.join(',')})`)
    if (opts.excludeCollections?.length && opts.excludeCaptures) {
      q = q.filter('ind_items.note_source', 'eq', 'collection')
      q = q.filter('ind_items.collection_id', 'not.in', `(${opts.excludeCollections.join(',')})`)
    } else if (opts.excludeCollections?.length) {
      q = q.or(`note_source.neq.collection,collection_id.not.in.(${opts.excludeCollections.join(',')})`, { foreignTable: 'ind_items' })
    } else if (opts.excludeCaptures) {
      q = q.filter('ind_items.note_source', 'eq', 'collection')
    }
    return q
  }

  const rows = await paginate<{ ind_items: unknown }>(buildQ, 'getDueStats')
  return computeDueStats(rows.map(r => (r.ind_items as DueStatRow | null) ?? { note_source: '', collection_id: null }))
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
  includeNoteSource?:   string     // filter by ind_items.note_source (exact match)
  includeUnseen?:       boolean    // include rep=0 items (skips SRS "new" gate); use with dueOnly:false for full-pool review
  includeNoteTypes?:    string[]   // filter by ind_items.type
  includeTags?:        string[]   // OR logic: any of these tags
  includeFlagColors?:  string[]   // OR logic: any of these colors (post-filter; flagColor handles single/any/none at DB level)
  includePlaceHeard?:  string     // exact match on place_heard
  dueOnly?:            boolean    // default true; false = all non-suspended cards
  advanceUntil?:       string     // ISO timestamp ceiling; when set, queries cards due between now and this time, rep>=2 only
}

export async function listDueFlashcards(opts: ListDueOpts = {}): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const now = new Date().toISOString()

  function buildQ() {
    let q = supabase.from('ind_flashcards').select(CARD_SEL)
      .is('suspended_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
    if (!opts.includeUnseen) {
      // advance mode: rep>=2 (exclude freshly-graduated New cards); normal: rep>=1
      q = q.gt('repetitions', opts.advanceUntil ? 1 : 0)
    }
    if (opts.advanceUntil)           q = q.gt('due_at', now).lte('due_at', opts.advanceUntil)
    else if (opts.dueOnly !== false)  q = q.lte('due_at', now)
    if      (opts.flagColor === 'any')  q = q.not('flag_color', 'is', null)
    else if (opts.flagColor === 'none') q = q.is('flag_color', null)
    else if (opts.flagColor)            q = q.eq('flag_color', opts.flagColor)
    // Global exclusions — push to DB to reduce pagination payload for large vaults
    if (opts.excludeLangs?.length)
      q = q.filter('ind_items.language', 'not.in', `(${opts.excludeLangs.join(',')})`)
    if (opts.excludeCollections?.length && opts.excludeCaptures) {
      q = q.filter('ind_items.note_source', 'eq', 'collection')
      q = q.filter('ind_items.collection_id', 'not.in', `(${opts.excludeCollections.join(',')})`)
    } else if (opts.excludeCollections?.length) {
      q = q.or(`note_source.neq.collection,collection_id.not.in.(${opts.excludeCollections.join(',')})`, { foreignTable: 'ind_items' })
    } else if (opts.excludeCaptures) {
      q = q.filter('ind_items.note_source', 'eq', 'collection')
    }
    // Custom session inclusions — push to DB
    if (opts.includeLangs?.length)
      q = q.filter('ind_items.language', 'in', `(${opts.includeLangs.join(',')})`)
    if (opts.includeDialect)
      q = q.filter('ind_items.dialect', 'eq', opts.includeDialect)
    if (opts.includeCollectionId)
      q = q.filter('ind_items.collection_id', 'eq', opts.includeCollectionId)
    else if (opts.capturesOnly)
      q = q.filter('ind_items.note_source', 'in', '(captured,dict,import)')
    if (opts.includeNoteSource)
      q = q.filter('ind_items.note_source', 'eq', opts.includeNoteSource)
    if (opts.includeNoteTypes?.length)
      q = q.filter('ind_items.type', 'in', `(${opts.includeNoteTypes.join(',')})`)
    if (opts.includeFlagColors?.length)
      q = q.in('flag_color', opts.includeFlagColors)
    if (opts.includePlaceHeard)
      q = q.filter('ind_items.place_heard', 'eq', opts.includePlaceHeard)
    return q
  }

  let results = await paginate<FlashcardWithItem>(buildQ, 'listDueFlashcards')

  // includeTags stays client-side: OR across an array column has no clean PostgREST pushdown
  if (opts.includeTags?.length)
    results = results.filter(c => opts.includeTags!.some(t => (c.ind_items?.tags ?? []).includes(t)))

  return results
}

export async function graduateLearnCard(
  flashcardId: string,
  type: 'good' | 'easy',
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const today = getStudyDate()
  const { error } = await supabase.rpc('graduate_learn_card', {
    p_flashcard_id: flashcardId,
    p_user_id:      user.id,
    p_type:         type,
    p_date:         today,
  })
  if (error) throw new Error(`graduateLearnCard: ${error.message}`)
}

export async function listLearnFlashcards(opts: { collectionId?: string } = {}): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const pages = await paginate<FlashcardWithItem>(
    () => {
      let q = supabase.from('ind_flashcards').select(CARD_SEL).eq('user_id', user.id).eq('repetitions', 0).is('suspended_at', null)
      if (opts.collectionId) q = q.filter('ind_items.collection_id', 'eq', opts.collectionId)
      return q
    },
    'listLearnFlashcards',
  )

  if (!pages.length) return []

  const byPos = (a: FlashcardWithItem, b: FlashcardWithItem) => {
    const aLv = a.ind_items?.level ?? 0,    bLv = b.ind_items?.level ?? 0
    const aLe = a.ind_items?.lesson ?? 0,   bLe = b.ind_items?.lesson ?? 0
    const aPo = a.ind_items?.position ?? 0, bPo = b.ind_items?.position ?? 0
    return aLv !== bLv ? aLv - bLv : aLe !== bLe ? aLe - bLe : aPo - bPo
  }

  if (opts.collectionId) return pages.sort(byPos)

  // Priority sort: deck position → level → lesson → position; non-priority last
  const priorityDecks = await listPriorityDecks(user.id)
  const priorityMap = new Map<string, number>()
  for (const deck of priorityDecks) if (deck.collection_id) priorityMap.set(deck.collection_id, deck.position)

  return pages.sort((a, b) => {
    const aCol = a.ind_items?.collection_id ?? null
    const bCol = b.ind_items?.collection_id ?? null
    const aPri = aCol != null ? (priorityMap.get(aCol) ?? Infinity) : Infinity
    const bPri = bCol != null ? (priorityMap.get(bCol) ?? Infinity) : Infinity
    if (aPri !== bPri) return aPri - bPri
    if (aPri !== Infinity) return byPos(a, b)
    return 0
  })
}

// Used when a mature card completes its relearn burst (Good/Easy = 50% recovery).
export async function rateCardRelearn(
  flashcardId: string,
  rating: 'good' | 'easy' | 'again',
  currentState: SMState,
  lapsedInterval: number,
  mode?: string,
  storeRating?: string,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { due_at, new_state } = nextRelearn(currentState, rating, lapsedInterval)
  const today = getStudyDate()

  const [cardRes, , rpcRes] = await Promise.all([
    supabase.from('ind_flashcards').update({
      due_at,
      ease_factor:   new_state.ease_factor,
      interval_days: new_state.interval_days,
      repetitions:   new_state.repetitions,
    }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating: storeRating ?? rating, due_at, mode }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
  if (cardRes.error) throw new Error(`rateCardRelearn flashcard update: ${cardRes.error.message}`)
  if (rpcRes.error)  throw new Error(`rateCardRelearn increment: ${rpcRes.error.message}`)
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
  const rows = await paginate<{ id: string }>(
    () => supabase.from('ind_items').select('id').eq('collection_id', collectionId),
  )
  const ids = rows.map(r => r.id)
  if (!ids.length) return
  await wipeReviewsAndReset(supabase, user.id, ids)
}

export async function resetCapturesSRS(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const rows = await paginate<{ id: string }>(
    () => supabase.from('ind_items').select('id').eq('user_id', user.id).neq('note_source', 'collection'),
  )
  const ids = rows.map(r => r.id)
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

export async function setDueAt(cardId: string, dueAt: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ due_at: dueAt }).eq('id', cardId)
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

export async function undoDefer(cardId: string, prevDueAt: string | null): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ due_at: prevDueAt }).eq('id', cardId)
}

export async function undoGraduateLearnCard(
  cardId: string,
  prevState: { ease_factor: number; interval_days: number; repetitions: number; due_at: string | null },
): Promise<void> {
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
      .eq('mode', 'learn')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: stats } = await supabase
    .from('ind_daily_stats')
    .select('learned_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  await Promise.all([
    review ? supabase.from('ind_reviews').delete().eq('id', review.id) : Promise.resolve(),
    stats && (stats.learned_count ?? 0) > 0
      ? supabase.from('ind_daily_stats')
          .update({ learned_count: stats.learned_count - 1 })
          .eq('user_id', user.id).eq('date', today)
      : Promise.resolve(),
  ])
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

  const [cardRes, , rpcRes] = await Promise.all([
    supabase.from('ind_flashcards').update({
      due_at,
      ease_factor:   new_state.ease_factor,
      interval_days: new_state.interval_days,
      repetitions:   new_state.repetitions,
    }).eq('id', flashcardId),
    supabase.from('ind_reviews').insert({ user_id: user.id, flashcard_id: flashcardId, rating, due_at, mode }),
    supabase.rpc('increment_reviewed_today', { p_user_id: user.id, p_date: today }),
  ])
  if (cardRes.error) throw new Error(`rateCard flashcard update: ${cardRes.error.message}`)
  if (rpcRes.error)  throw new Error(`rateCard increment: ${rpcRes.error.message}`)
}
