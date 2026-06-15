'use client'

import { createClient } from '@/lib/supabase/client'
import { setFlagColor, suspendCard, unsuspendCard } from '@/lib/db/srs/flashcards'

export { setFlagColor, suspendCard, unsuspendCard }

export type VideoCard = {
  id:           string
  ab:           string
  zh:           string | null
  audio:        string | null
  language:     string
  dialect:      string | null
  created_at:   string
  metadata: {
    video_clip?:     string | null
    video_segments?: string[]
    audio_segments?: string[]
    image?:          string | null
    merged_from?:    string[]
    merged_into?:    string
  } | null
  flashcard_id:  string | null
  flag_color:    string | null
  suspended_at:  string | null
}

export type VideoCollection = {
  id:   string
  name: string
}

export async function listVideoCollections(): Promise<VideoCollection[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: videoItems } = await supabase
    .from('ind_items')
    .select('collection_id')
    .eq('user_id', user.id)
    .or('metadata->>video_clip.not.is.null,metadata->>image.not.is.null')
    .is('metadata->>merged_into', null)

  const collectionIds = [...new Set(
    (videoItems ?? [])
      .map(r => r.collection_id as string | null)
      .filter((id): id is string => !!id)
  )]
  if (collectionIds.length === 0) return []

  const { data } = await supabase
    .from('ind_learn_collections')
    .select('id, name')
    .eq('user_id', user.id)
    .in('id', collectionIds)
    .order('created_at', { ascending: true })
  return (data ?? []) as VideoCollection[]
}

export async function listCollectionVideoCards(collectionId: string): Promise<VideoCard[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('ind_items')
    .select('id, ab, zh, audio, language, dialect, metadata, created_at, ind_flashcards(id, flag_color, suspended_at)')
    .eq('user_id', user.id)
    .eq('collection_id', collectionId)
    .or('metadata->>video_clip.not.is.null,metadata->>image.not.is.null')
    .is('metadata->>merged_into', null)
    .order('created_at', { ascending: true })
  if (!data) return []
  type FC = { id: string; flag_color: string | null; suspended_at: string | null }
  return data.map(row => {
    const fc = (Array.isArray(row.ind_flashcards) ? row.ind_flashcards[0] : null) as FC | null
    return {
      id:          row.id,
      ab:          row.ab ?? '',
      zh:          row.zh ?? null,
      audio:       row.audio ?? null,
      language:    row.language ?? '',
      dialect:     row.dialect ?? null,
      created_at:  row.created_at,
      metadata:    row.metadata as VideoCard['metadata'],
      flashcard_id: fc?.id ?? null,
      flag_color:   fc?.flag_color ?? null,
      suspended_at: fc?.suspended_at ?? null,
    }
  })
}

export async function mergeVideoCards(
  collectionId: string,
  cards: VideoCard[],
): Promise<VideoCard | null> {
  if (cards.length < 2) return null
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const first = cards[0]
  const ab = cards.map(c => c.ab).join(' · ')
  const zh = cards.map(c => c.zh).filter(Boolean).join(' · ') || null

  const videoSegs = cards
    .flatMap(c => c.metadata?.video_segments ?? (c.metadata?.video_clip ? [c.metadata.video_clip] : []))
    .filter((s): s is string => !!s)
  const audioSegs = cards
    .flatMap(c => c.metadata?.audio_segments ?? (c.audio ? [c.audio] : []))
    .filter((s): s is string => !!s)

  const { data: inserted, error } = await supabase
    .from('ind_items')
    .insert({
      user_id:       user.id,
      collection_id: collectionId,
      ab,
      zh,
      audio:       audioSegs[0] ?? null,
      note_source: 'collection',
      language:    first.language,
      dialect:     first.dialect,
      type:        'sentence',
      created_at:  first.created_at,
      metadata: {
        video_clip:     videoSegs[0] ?? null,
        video_segments: videoSegs,
        audio_segments: audioSegs,
        merged_from:    cards.map(c => c.id),
      },
    })
    .select('id, created_at')
    .single()

  if (error || !inserted) return null

  await Promise.all(cards.map(c =>
    supabase
      .from('ind_items')
      .update({ metadata: { ...(c.metadata ?? {}), merged_into: inserted.id } })
      .eq('id', c.id)
  ))

  return {
    id:          inserted.id,
    ab, zh,
    audio:       audioSegs[0] ?? null,
    language:    first.language,
    dialect:     first.dialect,
    created_at:  inserted.created_at,
    metadata: {
      video_clip:     videoSegs[0] ?? null,
      video_segments: videoSegs,
      audio_segments: audioSegs,
      merged_from:    cards.map(c => c.id),
    },
    flashcard_id: null,
    flag_color:   null,
    suspended_at: null,
  }
}
