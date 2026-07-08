'use client'

import { createClient } from '@/lib/supabase/client'
import { paginate } from './flashcards'
import { getSessionUser } from '@/lib/supabase/session'
export { suspendCard, unsuspendCard, setFlagColor } from './flashcards'

export type BrowserCard = {
  id:            string        // note ID — primary identity
  card_id:       string | null // flashcard ID (null if ensureFlashcards hasn't run yet)
  ab: string
  zh: string | null
  created_at: string
  // SRS state (defaults when no card)
  due_at:        string | null
  ease_factor:   number
  interval_days: number
  repetitions:   number
  suspended_at:  string | null
  flag_color:    string | null
  // Note fields
  source:        string
  note_source:   string
  notes:         string | null
  audio:         string | null
  video_clip:    string | null
  note_type:     string
  language:      string
  dialect:       string | null
  place_heard:   string | null
  tags:          string[] | null
  target_word:   string | null
  source_id:     string | null
}

export type BrowserFilter = 'all' | 'due' | 'new' | 'flagged' | 'suspended'
export type BrowserSort   = 'due' | 'ease' | 'added'

export async function listBrowserCards(
  filter: BrowserFilter,
  sort: BrowserSort,
  flagColorFilter?: string | null,
  videoOnly?: boolean,
): Promise<BrowserCard[]> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return []

  const now = new Date().toISOString()
  // !inner when a card-level filter is active — otherwise PostgREST keeps every
  // item and just empties the embed, so due/new/flagged/suspended showed the
  // whole vault with defaulted SRS values (same bug as CARD_SEL, fixed 2026-07-03)
  const inner = filter === 'all' ? '' : '!inner'
  const SEL = `id, ab, zh, notes, audio, metadata, type, language, dialect, place_heard, tags, target_word, note_source, source_id, collection_id, created_at, ind_flashcards${inner}(id, due_at, ease_factor, interval_days, repetitions, suspended_at, flag_color), ind_learn_collections(name)`

  function withVideoFilter(q: any): any {
    if (!videoOnly) return q
    return q
      .or('metadata->>video_clip.not.is.null,metadata->>image.not.is.null')
      .is('metadata->>merged_into', null)
  }

  // Push filter to DB so pagination fetches only matching rows, not the full vault
  function applyFilter(q: any): any {
    switch (filter) {
      case 'due':
        return q.is('ind_flashcards.suspended_at', null)
                .or(`due_at.is.null,due_at.lte.${now}`, { foreignTable: 'ind_flashcards' })
      case 'new':
        return q.filter('ind_flashcards.repetitions', 'eq', 0)
                .is('ind_flashcards.suspended_at', null)
      case 'flagged': {
        let fq = q.not('ind_flashcards.flag_color', 'is', null).is('ind_flashcards.suspended_at', null)
        if (flagColorFilter) fq = fq.filter('ind_flashcards.flag_color', 'eq', flagColorFilter)
        return fq
      }
      case 'suspended':
        return q.not('ind_flashcards.suspended_at', 'is', null)
      default:
        return q
    }
  }

  // Two parallel paginated queries — one per note_source so collection items
  // (potentially 1000+) never crowd out captured notes within the same page window
  const [capturedRows, collectionRows] = await Promise.all([
    paginate<any>(
      () => applyFilter(withVideoFilter(supabase.from('ind_items').select(SEL).eq('user_id', user.id).neq('note_source', 'collection').order('created_at', { ascending: false }).order('id', { ascending: true }))),
      'listBrowserCards:captured',
    ),
    paginate<any>(
      () => applyFilter(withVideoFilter(supabase.from('ind_items').select(SEL).eq('user_id', user.id).eq('note_source', 'collection').order('created_at', { ascending: false }).order('id', { ascending: true }))),
      'listBrowserCards:collection',
    ),
  ])

  // Dedup defensively in case created_at ties still produce overlap at page boundaries
  const seen = new Set<string>()
  const data = [...capturedRows, ...collectionRows].filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  if (!data.length) return []

  type CardJoin = {
    id: string; due_at: string | null; ease_factor: number; interval_days: number
    repetitions: number; suspended_at: string | null; flag_color: string | null
  }

  const results: BrowserCard[] = data.map(row => {
    const cardArr = row.ind_flashcards as unknown as CardJoin[] | null
    const card    = Array.isArray(cardArr) ? (cardArr[0] ?? null) : null
    const col     = row.ind_learn_collections as unknown as { name: string } | null
    const source  = col?.name ?? ({ dict: 'Dict', curriculum: 'Curriculum', import: 'Imported' }[row.note_source as string] ?? 'Captured')
    return {
      id:            row.id,
      card_id:       card?.id ?? null,
      ab:            row.ab ?? '',
      zh:            row.zh ?? null,
      created_at:    row.created_at,
      due_at:        card?.due_at ?? null,
      ease_factor:   card?.ease_factor ?? 2.5,
      interval_days: card?.interval_days ?? 0,
      repetitions:   card?.repetitions ?? 0,
      suspended_at:  card?.suspended_at ?? null,
      flag_color:    card?.flag_color ?? null,
      source,
      note_source:   row.note_source ?? 'captured',
      notes:         row.notes ?? null,
      audio:         row.audio ?? null,
      video_clip:    (row.metadata as any)?.video_clip ?? null,
      note_type:     row.type ?? 'word',
      language:      row.language ?? '',
      dialect:       row.dialect ?? null,
      place_heard:   row.place_heard ?? null,
      tags:          Array.isArray(row.tags) ? (row.tags as string[]) : null,
      target_word:   row.target_word ?? null,
      source_id:     row.source_id ?? null,
    }
  })

  // Sort — 'added' is already chronological from DB order; 'due' and 'ease' sort
  // the O(result) set after transform (PostgREST can't ORDER BY embedded columns)
  if (sort === 'due') {
    results.sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0
      if (!a.due_at) return -1
      if (!b.due_at) return 1
      return a.due_at < b.due_at ? -1 : 1
    })
  } else if (sort === 'ease') {
    results.sort((a, b) => a.ease_factor - b.ease_factor)
  }

  return results
}

export async function updateNoteFields(
  noteId: string,
  patch: Partial<{ ab: string; zh: string | null; notes: string | null; place_heard: string | null }>
): Promise<void> {
  const supabase = createClient()
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v
  await supabase.from('ind_items').update(clean).eq('id', noteId)
}


export async function batchDeleteNotes(noteIds: string[]): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_items').delete().in('id', noteIds)
}

export async function batchSuspendCards(noteIds: string[]): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards')
    .update({ suspended_at: new Date().toISOString() })
    .in('note_id', noteIds)
}

export async function batchSetFlag(noteIds: string[], flagColor: string | null): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({ flag_color: flagColor }).in('note_id', noteIds)
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_items').delete().eq('id', noteId)
}

// Unsave from a bookmark surface (curriculum, dict). Delete outright if the
// card was never reviewed — nothing to lose. If it has review history,
// suspend instead of delete so the history + heatmap stay intact (DEC-SRS14).
export type UnsaveOutcome = 'deleted' | 'suspended'

export async function unsaveItem(noteId: string): Promise<UnsaveOutcome> {
  const supabase = createClient()
  const { data: card } = await supabase
    .from('ind_flashcards')
    .select('repetitions')
    .eq('note_id', noteId)
    .maybeSingle()

  if (!card || card.repetitions === 0) {
    await deleteNote(noteId)
    return 'deleted'
  }
  await batchSuspendCards([noteId])
  return 'suspended'
}

export async function resetCardEase(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('ind_flashcards').update({
    ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null,
  }).eq('id', id)
}
