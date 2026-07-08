import { createClient } from '@/lib/supabase/client'
import { nextFormoSRS1, nextRelearn, type SMState, type Rating } from './schedule'
import { listPriorityDecks, matchesPriorityDeck, NOTE_SOURCE_LABELS } from './priority'
import { getSessionUser } from '@/lib/supabase/session'
import { fetchReviewPrefsSnapshot, DEFAULT_PREFERENCES, type ReviewPrefsSnapshot } from '@/lib/db/profile/preferences'

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
  const user = await getSessionUser()
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
    metadata: Record<string, unknown> | null
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

// !inner is load-bearing: without it, PostgREST filters on ind_items.* null the
// embed instead of excluding the row — custom sessions received the ENTIRE due
// pool with blank item data (verified live 2026-07-03; broken since the
// predicate-pushdown refactor f42db26). Every card has a note (0 null note_ids),
// so the join never drops legitimate rows.
const CARD_SEL = '*, ind_items!inner(ab, zh, audio, type, language, dialect, note_source, collection_id, level, lesson, position, tags, place_heard, target_word, metadata, ind_learn_collections(name, language))'

export async function paginate<T>(buildQ: () => any, tag?: string): Promise<T[]> {
  // Pages are fetched in parallel batches (perf S11a) — sequential pages paid one
  // Sydney round trip each. Speculative pages beyond the result set come back
  // empty (or PGRST103) and cost ~nothing. The `.order('id')` tiebreaker makes
  // page boundaries deterministic — callers without their own ORDER BY were
  // technically unsound under OFFSET pagination.
  const PAGE = 1000
  const BATCH = 4
  const results: T[] = []
  for (let batch = 0; ; batch++) {
    const pages = await Promise.all(
      Array.from({ length: BATCH }, (_, i) => {
        const from = (batch * BATCH + i) * PAGE
        return buildQ().order('id', { ascending: true }).range(from, from + PAGE - 1)
      }),
    )
    for (const { data, error } of pages) {
      if (error) {
        // PGRST103 = range beyond result set — expected for speculative pages
        if (error.code !== 'PGRST103') console.error(tag ?? 'paginate:', error)
        return results
      }
      if (data?.length) results.push(...(data as T[]))
      if (!data || data.length < PAGE) return results
    }
  }
}

export async function ensureFlashcards(): Promise<void> {
  // Server-side insert-select RPC (SECURITY INVOKER, RLS applies) — replaces the
  // client download-and-diff of every note/card id (perf S4). Same contract:
  // one default Card per unmatched Note (architecture.md § Card generation).
  const supabase = createClient()
  const { error } = await supabase.rpc('ensure_flashcards')
  if (error) console.error('ensureFlashcards:', error)
}

export async function setTargetWord(noteId: string, targetWord: string | null): Promise<void> {
  const supabase = createClient()
  const user = await getSessionUser()
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

export type ReviewExclusions = {
  collections:   string[]
  captures:      boolean
  showAllLangs:  boolean
  excludedLangs: string[]
  prefs:         ReviewPrefsSnapshot['prefs']
}

// Authoritative review-filter fetch — sources language exclusions from ind_profiles.preferences
// (via fetchReviewPrefsSnapshot), not localStorage, which can be stale on a device/tab that
// hasn't opened SettingsSheet yet this session. Exposes the full prefs snapshot too, so callers
// that also need e.g. review_target don't have to fetch ind_profiles a second time.
export async function getExcludeFromReview(): Promise<ReviewExclusions> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return { collections: [], captures: false, showAllLangs: true, excludedLangs: [], prefs: DEFAULT_PREFERENCES }
  const [colRes, snap] = await Promise.all([
    supabase.from('ind_learn_collections').select('id').eq('user_id', user.id).eq('include_in_review', false),
    fetchReviewPrefsSnapshot(user.id),
  ])
  return {
    collections:   (colRes.data ?? []).map(r => r.id as string),
    captures:      !snap.includeInReview,
    showAllLangs:  snap.prefs.show_all_langs,
    excludedLangs: snap.prefs.excluded_langs,
    prefs:         snap.prefs,
  }
}

export type DueStats = {
  total: number
  captures: number
  byCollection: Record<string, number>
}

export async function listCustomSessionMeta(): Promise<{ types: string[]; tags: string[]; places: string[] }> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return { types: [], tags: [], places: [] }
  const { data } = await supabase.from('ind_items').select('type, tags, place_heard').eq('user_id', user.id)
  const types  = [...new Set((data ?? []).map(r => r.type).filter(Boolean) as string[])].sort()
  const tags   = [...new Set((data ?? []).flatMap(r => (r.tags ?? []) as string[]).filter(Boolean))].sort()
  const places = [...new Set((data ?? []).map(r => r.place_heard).filter(Boolean) as string[])].sort()
  return { types, tags, places }
}

export async function listUserLanguages(): Promise<string[]> {
  const supabase = createClient()
  const user = await getSessionUser()
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
  // Grouped counts via RPC (perf S5) — was paginating every due row to count
  // client-side. True join semantics: excluded rows no longer leak into captures
  // (the old non-inner embed filters nulled ind_items instead of dropping the row).
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_due_stats', {
    p_exclude_langs:       opts.excludeLangs ?? [],
    p_exclude_collections: opts.excludeCollections ?? [],
    p_exclude_captures:    opts.excludeCaptures ?? false,
  })
  if (error || !data) {
    console.error('getDueStats:', error)
    return { total: 0, captures: 0, byCollection: {} }
  }

  let total = 0, captures = 0
  const byCollection: Record<string, number> = {}
  for (const row of data as { collection_id: string | null; captures: boolean; n: number }[]) {
    total += row.n
    if (row.captures) captures += row.n
    else if (row.collection_id) byCollection[row.collection_id] = (byCollection[row.collection_id] ?? 0) + row.n
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
  includeNoteSource?:   string     // filter by ind_items.note_source (exact match)
  includeUnseen?:       boolean    // include rep=0 items (skips SRS "new" gate); use with dueOnly:false for full-pool review
  includeNoteTypes?:    string[]   // filter by ind_items.type
  includeTags?:        string[]   // OR logic: any of these tags
  includeFlagColors?:  string[]   // OR logic: any of these colors (post-filter; flagColor handles single/any/none at DB level)
  includePlaceHeard?:  string     // exact match on place_heard
  dueOnly?:            boolean    // default true; false = all non-suspended cards
  advanceUntil?:       string     // ISO timestamp ceiling; when set, queries cards due between now and this time, rep>=2 only
}

// Shared predicate builder — the queue fetch and the landing count (S11c) must
// apply IDENTICAL filters. `now` is passed in so paginated pages share one cutoff.
function buildDueQuery(
  supabase: ReturnType<typeof createClient>,
  opts: ListDueOpts,
  select: string,
  now: string,
  head = false,
) {
  let q = supabase.from('ind_flashcards')
    .select(select, head ? { count: 'exact', head: true } : undefined)
    .is('suspended_at', null)
  if (!head) q = q.order('due_at', { ascending: true, nullsFirst: false })
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

export async function listDueFlashcards(opts: ListDueOpts = {}): Promise<FlashcardWithItem[]> {
  const supabase = createClient()
  const now = new Date().toISOString()

  let results = await paginate<FlashcardWithItem>(
    () => buildDueQuery(supabase, opts, CARD_SEL, now),
    'listDueFlashcards',
  )

  // includeTags stays client-side: OR across an array column has no clean PostgREST pushdown
  if (opts.includeTags?.length)
    results = results.filter(c => opts.includeTags!.some(t => (c.ind_items?.tags ?? []).includes(t)))

  return results
}

// Fast landing count (perf S11c) — same predicates as listDueFlashcards, zero rows
// transferred. includeTags filters client-side in the list call, so tag-filtered
// sessions may briefly overcount here until the loaded queue reconciles the number.
export async function countDueFlashcards(opts: ListDueOpts = {}): Promise<number> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { count, error } = await buildDueQuery(supabase, opts, 'id, ind_items!inner(id)', now, true)
  if (error) { console.error('countDueFlashcards:', error); return 0 }
  return count ?? 0
}

// Fast landing count for Learn (perf S11c). Language exclusions apply client-side
// in the learn page, so the estimate reconciles when the queue lands.
export async function countLearnFlashcards(collectionId?: string): Promise<number> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return 0
  let q = supabase.from('ind_flashcards')
    .select(collectionId ? 'id, ind_items!inner(collection_id)' : 'id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('repetitions', 0)
    .is('suspended_at', null)
  if (collectionId) q = q.filter('ind_items.collection_id', 'eq', collectionId)
  const { count, error } = await q
  if (error) { console.error('countLearnFlashcards:', error); return 0 }
  return count ?? 0
}

export async function graduateLearnCard(
  flashcardId: string,
  type: 'good' | 'easy',
): Promise<void> {
  const supabase = createClient()
  const user = await getSessionUser()
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
  const user = await getSessionUser()
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

  // Priority sort: deck position → level → lesson → position; non-priority last.
  // Matches the same deck (collection OR virtual note_source+filter_config) used by review/learn toast logic.
  const priorityDecks = await listPriorityDecks(user.id)
  const priorityIdx = (c: FlashcardWithItem) => {
    const i = priorityDecks.findIndex(d => matchesPriorityDeck(d, {
      collectionId: c.ind_items?.collection_id,
      noteSource:   c.ind_items?.note_source,
      level:        c.ind_items?.level,
      lesson:       c.ind_items?.lesson,
      language:     c.ind_items?.language,
      dialect:      c.ind_items?.dialect,
      tags:         c.ind_items?.tags,
      metadata:     c.ind_items?.metadata,
    }))
    return i === -1 ? Infinity : i
  }

  return pages.sort((a, b) => {
    const aPri = priorityIdx(a)
    const bPri = priorityIdx(b)
    if (aPri !== bPri) return aPri - bPri
    if (aPri !== Infinity) return byPos(a, b)
    return 0
  })
}

export type DeckBreakdownRow = { label: string; count: number; priority: boolean }

// Labels for non-priority buckets that aren't a named collection (mirrors NOTE_SOURCE_LABELS,
// extended with sources that have no dedicated virtual-deck entry).
const FALLBACK_SOURCE_LABELS: Record<string, string> = {
  captured:   'Captures',
  dict:       'Dictionary',
  curriculum: 'Curriculum (unprioritized)',
  import:     'Imported',
}

type BreakdownItemRow = {
  ind_items: {
    collection_id: string | null
    note_source:   string
    level:         number | null
    lesson:        number | null
    language:      string
    dialect:       string | null
    tags:          string[] | null
    metadata:      Record<string, unknown> | null
    ind_learn_collections: { name: string } | null
  } | null
}

// Due/new cards grouped by priority deck (in configured order), with everything else bucketed
// by its actual collection/note_source — informational only, for the session-size picker's
// "Decks" tab (DEC-SRS?? follow-up to DEC-SRS15). Deliberately client-side: reuses
// matchesPriorityDeck() instead of a SQL port, so this can never drift from what a real
// review/learn session actually prioritizes. Fetches a slim projection (no ab/zh/audio/joined
// corpus content) — fine at this app's per-user card volume; would need revisiting (e.g. a
// grouped RPC) if this ever ran against a much larger per-user due/new count.
export async function getDeckBreakdown(pool: 'due' | 'new'): Promise<DeckBreakdownRow[]> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return []

  const priorityDecks = await listPriorityDecks(user.id)
  const now = new Date().toISOString()
  const sel = 'id, ind_items!inner(collection_id, note_source, level, lesson, language, dialect, tags, metadata, ind_learn_collections(name))'

  const rows = await paginate<BreakdownItemRow>(() => {
    let q = supabase.from('ind_flashcards').select(sel).eq('user_id', user.id).is('suspended_at', null)
    q = pool === 'due' ? q.gt('repetitions', 0).lte('due_at', now) : q.eq('repetitions', 0)
    return q
  }, 'getDeckBreakdown')

  type Bucket = { label: string; count: number; priority: boolean; position: number }
  const buckets = new Map<string, Bucket>()

  for (const r of rows) {
    const item = r.ind_items
    if (!item) continue
    const idx = priorityDecks.findIndex(d => matchesPriorityDeck(d, {
      collectionId: item.collection_id,
      noteSource:   item.note_source,
      level:        item.level,
      lesson:       item.lesson,
      language:     item.language,
      dialect:      item.dialect,
      tags:         item.tags,
      metadata:     item.metadata,
    }))

    let key: string, bucket: Omit<Bucket, 'count'>
    if (idx !== -1) {
      const deck = priorityDecks[idx]
      key = deck.id
      bucket = {
        label: deck.filter_config?.label
          ?? (deck.note_source ? NOTE_SOURCE_LABELS[deck.note_source] : undefined)
          ?? item.ind_learn_collections?.name
          ?? 'Priority deck',
        priority: true,
        position: idx,
      }
    } else {
      key = item.collection_id ?? `src:${item.note_source}`
      bucket = {
        label: item.ind_learn_collections?.name ?? FALLBACK_SOURCE_LABELS[item.note_source] ?? item.note_source,
        priority: false,
        position: Infinity,
      }
    }
    const existing = buckets.get(key)
    if (existing) existing.count++
    else buckets.set(key, { ...bucket, count: 1 })
  }

  return [...buckets.values()]
    .sort((a, b) => a.position !== b.position ? a.position - b.position : b.count - a.count)
    .map(({ label, count, priority }) => ({ label, count, priority }))
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
  const user = await getSessionUser()
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
  const user = await getSessionUser()
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
  const user = await getSessionUser()
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
  const user = await getSessionUser()
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
  const user = await getSessionUser()
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
  const user = await getSessionUser()
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
