'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { createClient } from '@/lib/supabase/client'
import VideoPage from '@/components/video/VideoPage'
import type { VideoCard, VideoCollection } from '@/lib/db/video/queries'

type RawCard = {
  id:       string
  ilrdf_id: number
  seg_n:    number
  ab:       string
  zh:       string | null
  audio:    string | null
  language: string
  dialect:  string | null
  metadata: {
    title_zh?:   string
    video_clip?: string | null
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const AUDIO_BASE   = `${SUPABASE_URL}/storage/v1/object/public/ind-audio/`
const VIDEO_BASE   = `${SUPABASE_URL}/storage/v1/object/public/ind-video/`
const DEMO_DATE    = '2026-01-01T00:00:00.000Z'

function transformCards(raws: RawCard[]): {
  collections: VideoCollection[]
  cardsByCollection: Record<string, VideoCard[]>
} {
  const colOrder:      string[]                       = []
  const colNames:      Record<string, string>         = {}
  const colCount:      Record<string, number>         = {}
  const colFirstImage: Record<string, string | null>  = {}
  const groups:        Record<string, VideoCard[]>    = {}

  for (const raw of raws) {
    const colId = String(raw.ilrdf_id)
    const seg   = String(raw.seg_n).padStart(4, '0')
    const image = VIDEO_BASE + `ilrdf/${raw.ilrdf_id}/seg_${seg}.jpg`

    if (!groups[colId]) {
      groups[colId]        = []
      colOrder.push(colId)
      colNames[colId]      = raw.metadata.title_zh ?? `Video ${raw.ilrdf_id}`
      colFirstImage[colId] = image
    }
    colCount[colId] = (colCount[colId] ?? 0) + 1

    groups[colId].push({
      id:          raw.id,
      ab:          raw.ab,
      zh:          raw.zh ?? null,
      audio:       raw.audio ? AUDIO_BASE + raw.audio : null,
      language:    raw.language,
      dialect:     raw.dialect ?? null,
      created_at:  DEMO_DATE,
      metadata: {
        video_clip: raw.metadata.video_clip ? VIDEO_BASE + raw.metadata.video_clip : null,
        image,
      },
      flashcard_id: null,
      flag_color:   null,
      suspended_at: null,
    })
  }

  return {
    collections: colOrder.map(id => ({
      id,
      name:        colNames[id],
      item_count:  colCount[id]      ?? 0,
      first_image: colFirstImage[id] ?? null,
    })),
    cardsByCollection: groups,
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#fff" fillOpacity=".9"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#fff" fillOpacity=".8"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#fff" fillOpacity=".7"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#fff" fillOpacity=".6"/>
    </svg>
  )
}

export default function DemoPage() {
  const [phase,   setPhase]   = useState<'landing' | 'loading' | 'demo'>('landing')
  const [signingIn, setSigningIn] = useState(false)
  const [collections,       setCollections]       = useState<VideoCollection[]>([])
  const [cardsByCollection, setCardsByCollection] = useState<Record<string, VideoCard[]>>({})

  async function handleGoogle() {
    setSigningIn(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function handleGuest() {
    setPhase('loading')
    const res  = await fetch('/demo/cards.json')
    const raws: RawCard[] = await res.json()
    const { collections, cardsByCollection } = transformCards(raws)
    setCollections(collections)
    setCardsByCollection(cardsByCollection)
    setPhase('demo')
  }

  if (phase === 'demo') {
    return <VideoPage demoCollections={collections} demoCardsByCollection={cardsByCollection} />
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: T.cream,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 32 }}>

        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 42, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.03em', lineHeight: 1,
          }}>Indilog</span>
        </div>

        <div style={{
          background: T.paperHi,
          border: `1px solid ${T.lineSoft}`,
          borderRadius: 18, padding: '28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 2px 12px rgba(80,40,20,0.07)',
        }}>
          <button
            onClick={handleGoogle}
            disabled={signingIn}
            style={{
              width: '100%', padding: '13px 20px',
              background: signingIn ? T.inkFaint : T.crimson,
              color: T.cream, borderRadius: 14, border: 'none',
              fontSize: 15, fontWeight: 600,
              cursor: signingIn ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <GoogleIcon />
            {signingIn ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: T.lineSoft }} />
            <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace' }}>or</span>
            <div style={{ flex: 1, height: 1, background: T.lineSoft }} />
          </div>

          <button
            onClick={handleGuest}
            disabled={phase === 'loading'}
            style={{
              height: 42, borderRadius: 10,
              border: `1px solid ${T.line}`,
              background: 'transparent', color: T.inkSoft,
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {phase === 'loading' ? 'Loading…' : 'Try as guest →'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: T.inkFaint, margin: 0, lineHeight: 1.6 }}>
          Guest mode plays sample Amis video cards.<br />Sign in to access your own collection.
        </p>

      </div>
    </div>
  )
}
