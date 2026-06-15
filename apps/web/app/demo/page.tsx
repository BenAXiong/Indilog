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
    title_zh?:  string
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
  const colOrder: string[] = []
  const colNames: Record<string, string> = {}
  const groups: Record<string, VideoCard[]> = {}

  for (const raw of raws) {
    const colId = String(raw.ilrdf_id)
    if (!groups[colId]) {
      groups[colId] = []
      colOrder.push(colId)
      colNames[colId] = raw.metadata.title_zh ?? `Video ${raw.ilrdf_id}`
    }
    const seg = String(raw.seg_n).padStart(4, '0')
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
        image:      VIDEO_BASE + `ilrdf/${raw.ilrdf_id}/seg_${seg}.jpg`,
      },
      flashcard_id: null,
      flag_color:   null,
      suspended_at: null,
    })
  }

  return {
    collections:       colOrder.map(id => ({ id, name: colNames[id] })),
    cardsByCollection: groups,
  }
}

export default function DemoPage() {
  const [phase, setPhase] = useState<'landing' | 'loading' | 'demo'>('landing')
  const [collections,       setCollections]       = useState<VideoCollection[]>([])
  const [cardsByCollection, setCardsByCollection] = useState<Record<string, VideoCard[]>>({})
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [authError,  setAuthError]  = useState<string | null>(null)
  const [signingIn,  setSigningIn]  = useState(false)

  async function handleGuest() {
    setPhase('loading')
    const res  = await fetch('/demo/cards.json')
    const raws: RawCard[] = await res.json()
    const { collections, cardsByCollection } = transformCards(raws)
    setCollections(collections)
    setCardsByCollection(cardsByCollection)
    setPhase('demo')
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    setSigningIn(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(error.message)
      setSigningIn(false)
    } else {
      window.location.href = '/video'
    }
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
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 32 }}>

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
          display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 2px 12px rgba(80,40,20,0.07)',
        }}>
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              style={{
                height: 42, borderRadius: 10, border: `1px solid ${T.line}`,
                background: T.paper, color: T.ink,
                fontSize: 14, padding: '0 12px', outline: 'none',
              }}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              style={{
                height: 42, borderRadius: 10, border: `1px solid ${T.line}`,
                background: T.paper, color: T.ink,
                fontSize: 14, padding: '0 12px', outline: 'none',
              }}
            />
            {authError && (
              <p style={{ fontSize: 12, color: T.crimson, margin: 0 }}>{authError}</p>
            )}
            <button type="submit" disabled={signingIn} style={{
              height: 42, borderRadius: 10, border: 'none',
              background: T.ink, color: T.cream,
              fontSize: 14, fontWeight: 600,
              cursor: signingIn ? 'default' : 'pointer',
              opacity: signingIn ? 0.6 : 1,
            }}>
              {signingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

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
