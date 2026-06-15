'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { FlagPicker } from '@/components/study/FlagPicker'
import BrowserView from '@/components/study/BrowserView'
import { flagColorHex } from '@/lib/db/srs/flags'
import {
  listVideoCollections, listCollectionVideoCards, mergeVideoCards,
  setFlagColor, suspendCard, unsuspendCard,
  type VideoCard, type VideoCollection,
} from '@/lib/db/video/queries'

// ─── Gloss helpers ────────────────────────────────────────────────────────────────────────

function tokenizeAmis(text: string): Array<{ display: string; key: string }> {
  return text.split(/\s+/).filter(Boolean).map(raw => ({
    display: raw,
    key: raw.toLowerCase()
      .replace(/^[.,;:!?()\[\]\u201C\u201D\u2018\u2019]+|[.,;:!?()\[\]\u201C\u201D\u2018\u2019]+$/g, '')
      .replace(/[\u2018\u2019\u02BC\uA78C]/g, "'"),
  })).filter(t => t.key.length > 0)
}

function cleanDef(s: string): string {
  return s.replace(/[^ -~\u00A0-\u024F\u1E00-\u1EFF\u2000-\u206F\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/g, ' ')
           .replace(/\s+/g, ' ').trim()
}

function shortGloss(wordCh: string): string {
  const first = cleanDef(wordCh.split(' \u00B7 ')[0] ?? '')
    .replace(/\uFF08[^\uFF09]*\uFF09|\([^)]*\)/g, '')
    .replace(/^[)\uFF09\s]+/, '')
    .trim()
    .replace(/\u3002+$/, '')
  const chars = [...first]
  return chars.length <= 10 ? first : chars.slice(0, 8).join('') + '\u2026'
}

// ─── Card shell ───────────────────────────────────────────────────────────────

function VideoCardDisplay({
  card,
  alwaysRevealed,
  revealed,
  onReveal,
  videoRef,
  videoSegs,
  vidSegIdx,
  imageUrl,
  cardMode,
  hasAudio,
  audioPlaying,
  onAudioToggle,
  onVideoEnded,
  onVideoTap,
  onSuspend,
  showFlagPicker,
  onFlagToggle,
  onFlagSelect,
  isPreview,
  isDemo,
  glossMode,
  glosses,
  glossLoading,
  isDesktop,
  onTokenTap,
  onTokenHover,
  onTokenHoverEnd,
}: {
  card: VideoCard
  alwaysRevealed: boolean
  revealed: boolean
  onReveal: () => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  videoSegs: string[]
  vidSegIdx: number
  imageUrl: string | null
  cardMode: 'video' | 'image' | 'audio'
  hasAudio: boolean
  audioPlaying: boolean
  onAudioToggle: () => void
  onVideoEnded: () => void
  onVideoTap: () => void
  onSuspend: () => void
  showFlagPicker: boolean
  onFlagToggle: () => void
  onFlagSelect: (c: string | null) => void
  isPreview?: boolean
  isDemo?: boolean
  glossMode: boolean
  glosses: Record<string, string>
  glossLoading: boolean
  isDesktop: boolean
  onTokenTap?: (tok: { display: string; key: string }) => void
  onTokenHover?: (tok: { display: string; key: string }, anchor: { x: number; y: number; vpH: number }) => void
  onTokenHoverEnd?: () => void
}) {
  const flagHex = flagColorHex(card.flag_color)
  const showBack = alwaysRevealed || revealed

  return (
    <div style={{
      position: 'relative',
      background: T.paperHi,
      borderRadius: 22,
      border: `1px solid ${isPreview ? T.amber : flagHex ? flagHex + '55' : T.lineSoft}`,
      padding: '26px 22px',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
    }}>
      {/* Flag — top left, expands right */}
      {!isDemo && (
      <FlagPicker
        currentFlag={card.flag_color}
        showPicker={showFlagPicker}
        onToggle={onFlagToggle}
        onSelect={onFlagSelect}
        side="left"
        expandDir="row"
      />
      )}

      {/* Suspend — top right */}
      {!isDemo && (
      <div style={{ position: 'absolute', top: 10, right: 12 }} onClick={e => e.stopPropagation()}>
        <button onClick={onSuspend} aria-label="Suspend" style={{
          width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: card.suspended_at ? T.amber : T.inkFaint,
        }}>
          <Icon name="pause" size={15} strokeWidth={1.8} />
        </button>
      </div>
      )}

      {/* Preview badge */}
      {isPreview && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: T.amber, background: T.amberBg, border: `1px solid #EBD49A`,
            padding: '2px 7px', borderRadius: 5,
          }}>preview</span>
        </div>
      )}

      {/* Media — video, still image, or audio player */}
      {cardMode === 'video' && videoSegs.length > 0 ? (
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          marginTop: 22, marginBottom: 18,
          aspectRatio: '16/9', background: '#000',
        }}>
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            key={`${card.id}-${vidSegIdx}`}
            src={videoSegs[vidSegIdx]}
            autoPlay
            muted
            playsInline
            onEnded={onVideoEnded}
            onClick={onVideoTap}
            style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer', display: 'block' }}
          />
        </div>
      ) : cardMode === 'image' && imageUrl ? (
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          marginTop: 22, marginBottom: 18,
          aspectRatio: '16/9', background: '#000',
        }}>
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      ) : hasAudio ? (
        <div style={{
          marginTop: 22, marginBottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button
            onClick={e => { e.stopPropagation(); onAudioToggle() }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 999,
              background: T.crimson, border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(180,40,30,0.2)',
            }}
          >
            <Icon name={audioPlaying ? 'stop' : 'speaker'} size={16} strokeWidth={1.6} color="#fff" />
          </button>
        </div>
      ) : null}

      {/* Front — ab: always tokenized so each word is tappable */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: glossMode ? '12px 22px' : '0px 8px', justifyContent: 'center' }}>
          {tokenizeAmis(card.ab).map((tok, i) => {
            const isPunct = tok.key.length <= 2 && !/[a-zA-Z]/.test(tok.key)
            return (
            <span
              key={i}
              onClick={!isDesktop ? () => onTokenTap?.(tok) : undefined}
              onMouseEnter={isDesktop ? e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onTokenHover?.(tok, { x: r.left + r.width / 2, y: r.top, vpH: window.innerHeight }) } : undefined}
              onMouseLeave={isDesktop ? () => onTokenHoverEnd?.() : undefined}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: isDesktop ? 'default' : 'pointer', marginLeft: isPunct ? (glossMode ? -20 : -6) : 0 }}
            >
              <span style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: glossMode ? 26 : 28, fontWeight: 500, color: T.ink,
                letterSpacing: '-0.02em', lineHeight: glossMode ? 1.2 : 1.25,
              }}>{tok.display}</span>
              {glossMode && (
                <span style={{
                  fontSize: 13, color: T.inkMute,
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: '0.02em', lineHeight: 1,
                }}>
                  {glossLoading ? '...' : (glosses[tok.key] ?? (tok.key.length < 3 ? tok.key : '?'))}
                </span>
              )}
            </span>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.lineSoft, flexShrink: 0 }} />

      {/* Back — zh */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', paddingTop: 16, minHeight: 60,
      }}>
        {showBack ? (
          <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {card.zh || <span style={{ color: T.inkFaint, fontStyle: 'italic' }}>—</span>}
          </div>
        ) : (
          <button onClick={onReveal} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, fontWeight: 600, color: T.inkMute,
            padding: '8px 16px',
          }}>中</button>
        )}
      </div>
    </div>
  )
}

// ─── Merge strip ──────────────────────────────────────────────────────────────

function MergeStrip({
  cards,
  currentIndex,
  selection,
  onToggle,
  onPreview,
  onCombine,
  onCancel,
  combining,
}: {
  cards: VideoCard[]
  currentIndex: number
  selection: Set<string>
  onToggle: (id: string) => void
  onPreview: () => void
  onCombine: () => void
  onCancel: () => void
  combining: boolean
}) {
  const from = Math.max(0, currentIndex - 3)
  const to   = Math.min(cards.length - 1, currentIndex + 3)
  const visible = cards.slice(from, to + 1)
  const canAct = selection.size >= 2

  const chipBtn = (selected: boolean, current: boolean): React.CSSProperties => ({
    flexShrink: 0, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
    border: `1px solid ${selected ? T.ink : T.lineSoft}`,
    background: selected ? T.ink : current ? T.paper : 'transparent',
    color: selected ? T.cream : current ? T.ink : T.inkMute,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
    textAlign: 'left',
  })

  return (
    <div style={{
      background: T.paperHi, border: `1px solid ${T.lineSoft}`,
      borderRadius: 16, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {visible.map((card, i) => {
          const absIdx = from + i
          const selected = selection.has(card.id)
          const current  = absIdx === currentIndex
          return (
            <button key={card.id} onClick={() => onToggle(card.id)} style={chipBtn(selected, current)}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                color: selected ? T.cream : T.inkFaint,
              }}>{absIdx + 1}</span>
              <span style={{ fontSize: 11, fontWeight: 500, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.ab.slice(0, 22)}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onPreview} disabled={!canAct} style={{
          height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
          cursor: canAct ? 'pointer' : 'default', opacity: canAct ? 1 : 0.4,
        }}>Preview</button>
        <button onClick={onCombine} disabled={!canAct || combining} style={{
          height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: canAct ? T.ink : T.lineSoft, border: 'none',
          color: canAct ? T.cream : T.inkFaint,
          cursor: canAct && !combining ? 'pointer' : 'default', opacity: combining ? 0.6 : 1,
        }}>{combining ? 'Combining…' : 'Combine'}</button>
        <button onClick={onCancel} style={{
          height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12,
          background: 'none', border: `1px solid ${T.lineSoft}`, color: T.inkFaint, cursor: 'pointer', marginLeft: 'auto',
        }}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VideoPage({
  demoCollections,
  demoCardsByCollection,
}: {
  demoCollections?: VideoCollection[]
  demoCardsByCollection?: Record<string, VideoCard[]>
} = {}) {
  const isDemo = !!demoCollections
  const [collections,    setCollections]    = useState<VideoCollection[]>([])
  const [collectionId,   setCollectionId]   = useState<string | null>(null)
  const [cards,          setCards]          = useState<VideoCard[]>([])
  const [currentIndex,   setCurrentIndex]   = useState(0)
  const [loading,        setLoading]        = useState(false)
  const [alwaysRevealed, setAlwaysRevealed] = useState(true)
  const [revealed,       setRevealed]       = useState(false)
  const [viewMode,       setViewMode]       = useState<'landing' | 'video' | 'list'>('landing')

  // Merge
  const [mergeMode,   setMergeMode]   = useState(false)
  const [mergeSel,    setMergeSel]    = useState<Set<string>>(new Set())
  const [previewCard, setPreviewCard] = useState<VideoCard | null>(null)
  const [combining,   setCombining]   = useState(false)

  // Flag
  const [showFlagPicker, setShowFlagPicker] = useState(false)

  // Gloss
  const [glossMode,    setGlossMode]    = useState(false)
  const [glosses,      setGlosses]      = useState<Record<string, string>>({})
  const [glossLoading, setGlossLoading] = useState(false)
  const glossCache = useRef(new Map<string, string>())

  // Word lookup — bottom sheet (mobile) or tooltip (desktop)
  type Anchor = { x: number; y: number; vpH: number }
  type LookupState = { display: string; key: string; wordAb: string | null; wordCh: string | null; loading: boolean; anchor: Anchor | null }
  const [lookup, setLookup] = useState<LookupState | null>(null)
  const lookupFullCache = useRef(new Map<string, { wordAb: string; wordCh: string } | null>())
  const [isDesktop, setIsDesktop] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Video / audio refs
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const audioCardId = useRef<string | null>(null)   // tracks which card's audio is loaded
  const [vidSegIdx, setVidSegIdx] = useState(0)
  const [cardMode, setCardMode] = useState<'video' | 'image' | 'audio'>('video')
  const [audioPlaying, setAudioPlaying] = useState(false)

  const activeCard = previewCard ?? cards[currentIndex] ?? null

  const videoSegs = activeCard?.metadata?.video_segments
    ?? (activeCard?.metadata?.video_clip ? [activeCard.metadata.video_clip] : [])
  const audioSegs = activeCard?.metadata?.audio_segments
    ?? (activeCard?.audio ? [activeCard.audio] : [])
  const imageUrl  = activeCard?.metadata?.image ?? null
  const availableModes: Array<'video' | 'image' | 'audio'> = [
    ...(videoSegs.length > 0 ? ['video' as const] : []),
    ...(imageUrl             ? ['image' as const] : []),
    ...(audioSegs.length > 0 ? ['audio' as const] : []),
  ]
  const hasAudio = audioSegs.length > 0

  // ── Desktop hover detection ──
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)')
    setIsDesktop(mq.matches)
    const h = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  // ── Fullscreen: hide nav, prevent scroll ──
  useEffect(() => {
    window.dispatchEvent(new Event('videomodeenter'))
    document.body.style.overflow = 'hidden'
    return () => {
      window.dispatchEvent(new Event('videomodeleave'))
      document.body.style.overflow = ''
    }
  }, [])

  // ── Load collections on mount ──
  useEffect(() => {
    if (demoCollections) { setCollections(demoCollections); return }
    listVideoCollections().then(cols => setCollections(cols))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load cards when collection changes ──
  useEffect(() => {
    if (!collectionId) return
    setLoading(true)
    setCards([])
    setCurrentIndex(0)
    setPreviewCard(null)
    setMergeMode(false)
    if (demoCardsByCollection) {
      setCards(demoCardsByCollection[collectionId] ?? [])
      setLoading(false)
      return
    }
    listCollectionVideoCards(collectionId).then(c => {
      setCards(c)
      setLoading(false)
    })
  }, [collectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset video/audio when active card changes ──
  useEffect(() => {
    setVidSegIdx(0)
    setRevealed(false)
    setShowFlagPicker(false)
    setCardMode(videoSegs.length > 0 ? 'video' : imageUrl ? 'image' : 'audio')

    // goTo already started audio within the gesture — just attach listeners
    if (audioCardId.current === activeCard?.id && audioRef.current) {
      const a = audioRef.current
      a.onplay  = () => setAudioPlaying(true)
      a.onpause = () => setAudioPlaying(false)
      a.onended = () => setAudioPlaying(false)
      return
    }

    // Initial load or preview change — try autoplay (may be blocked on mobile)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setAudioPlaying(false)
    if (!audioSegs[0]) return
    const a = new Audio(audioSegs[0])
    a.onplay  = () => setAudioPlaying(true)
    a.onpause = () => setAudioPlaying(false)
    a.onended = () => setAudioPlaying(false)
    a.play().then(() => setAudioPlaying(true)).catch(() => {})
    audioRef.current = a
    audioCardId.current = activeCard?.id ?? null
  }, [activeCard?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gloss fetch ──
  useEffect(() => {
    if (!glossMode || !activeCard) return
    setGlosses({})
    const allTokens = tokenizeAmis(activeCard.ab)
    const toFetch = allTokens.filter(t => t.key.length >= 3 && !glossCache.current.has(t.key))
    const applyCache = () => {
      const out: Record<string, string> = {}
      for (const t of allTokens)
        out[t.key] = t.key.length < 3 ? t.key : (glossCache.current.get(t.key) ?? '?')
      setGlosses(out)
    }
    if (toFetch.length === 0) { applyCache(); return }
    setGlossLoading(true)
    Promise.all(toFetch.map(async ({ key }) => {
      try {
        const res = await fetch(`/api/dict/search?q=${encodeURIComponent(key)}&moe=1`)
        const data = await res.json()
        const words: Array<{ word_ch: string; exact: boolean }> = data.words ?? []
        const match = words.find(w => w.exact) ?? words[0]
        glossCache.current.set(key, match ? shortGloss(match.word_ch) : '?')
      } catch {
        glossCache.current.set(key, '?')
      }
    })).then(() => { applyCache(); setGlossLoading(false) })
  }, [glossMode, activeCard?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token lookup (shared by tap + hover) ──
  function handleTokenLookup(tok: { display: string; key: string }, anchor: Anchor | null) {
    if (tok.key.length < 3) {
      setLookup({ display: tok.display, key: tok.key, wordAb: null, wordCh: null, loading: false, anchor })
      return
    }
    if (lookupFullCache.current.has(tok.key)) {
      const cached = lookupFullCache.current.get(tok.key) ?? null
      setLookup({ display: tok.display, key: tok.key, wordAb: cached?.wordAb ?? null, wordCh: cached?.wordCh ?? null, loading: false, anchor })
      return
    }
    setLookup({ display: tok.display, key: tok.key, wordAb: null, wordCh: null, loading: true, anchor })
    fetch(`/api/dict/search?q=${encodeURIComponent(tok.key)}&moe=1`)
      .then(r => r.json())
      .then((data: { words?: Array<{ word_ab: string; word_ch: string; exact: boolean }> }) => {
        const words = data.words ?? []
        const match = words.find(w => w.exact) ?? words[0] ?? null
        const entry = match ? { wordAb: match.word_ab, wordCh: match.word_ch } : null
        lookupFullCache.current.set(tok.key, entry)
        setLookup(prev => prev?.key === tok.key
          ? { ...prev, wordAb: entry?.wordAb ?? null, wordCh: entry?.wordCh ?? null, loading: false }
          : prev
        )
      })
      .catch(() => {
        lookupFullCache.current.set(tok.key, null)
        setLookup(prev => prev?.key === tok.key ? { ...prev, loading: false } : prev)
      })
  }

  function handleTokenTap(tok: { display: string; key: string }) {
    handleTokenLookup(tok, null)
  }

  function handleTokenHover(tok: { display: string; key: string }, anchor: Anchor) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => handleTokenLookup(tok, anchor), 180)
  }

  function handleTokenHoverEnd() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setLookup(null), 280)
  }

  // ── Video segment ended → advance both ──
  function handleVideoEnded() {
    const nextIdx = vidSegIdx + 1
    if (nextIdx < videoSegs.length) {
      setVidSegIdx(nextIdx)
      if (audioRef.current) audioRef.current.pause()
      if (audioSegs[nextIdx]) {
        const a = new Audio(audioSegs[nextIdx])
        a.play().catch(() => {})
        audioRef.current = a
      }
    }
  }

  function handleVideoTap() {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return
    if (v.paused) { v.play(); a?.play() }
    else          { v.pause(); a?.pause() }
  }

  function handleAudioToggle() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { a.play().then(() => setAudioPlaying(true)).catch(() => {}) }
    else          { a.pause() }
  }

  function cycleCardMode() {
    if (availableModes.length <= 1) return
    const idx = availableModes.indexOf(cardMode)
    setCardMode(availableModes[(idx + 1) % availableModes.length])
  }

  // ── Navigation ──
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= cards.length) return
    // Start audio within the gesture so browsers permit autoplay
    const nextCard = cards[idx]
    const url = nextCard?.metadata?.audio_segments?.[0] ?? nextCard?.audio ?? null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (url) {
      const a = new Audio(url)
      a.play().then(() => setAudioPlaying(true)).catch(() => {})
      audioRef.current = a
      audioCardId.current = nextCard.id
    } else {
      audioCardId.current = null
    }
    setAudioPlaying(false)
    setCurrentIndex(idx)
    setPreviewCard(null)
    setMergeMode(false)
    setMergeSel(new Set())
  }, [cards])

  // ── Merge actions ──
  function enterMerge() {
    const card = cards[currentIndex]
    if (!card) return
    setMergeSel(new Set([card.id]))
    setMergeMode(true)
  }

  function toggleMergeSel(id: string) {
    setMergeSel(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function buildMergePreview(): VideoCard | null {
    const selected = cards.filter(c => mergeSel.has(c.id))
    if (selected.length < 2) return null
    const first = selected[0]
    const videoSegsP = selected
      .flatMap(c => c.metadata?.video_segments ?? (c.metadata?.video_clip ? [c.metadata.video_clip] : []))
      .filter((s): s is string => !!s)
    const audioSegsP = selected
      .flatMap(c => c.metadata?.audio_segments ?? (c.audio ? [c.audio] : []))
      .filter((s): s is string => !!s)
    return {
      id:           '__preview__',
      ab:           selected.map(c => c.ab).join(' · '),
      zh:           selected.map(c => c.zh).filter(Boolean).join(' · ') || null,
      audio:        audioSegsP[0] ?? null,
      language:     first.language,
      dialect:      first.dialect,
      created_at:   first.created_at,
      metadata:     { video_clip: videoSegsP[0] ?? null, video_segments: videoSegsP, audio_segments: audioSegsP, image: selected[0].metadata?.image ?? null },
      flashcard_id: null, flag_color: null, suspended_at: null,
    }
  }

  async function handleCombine() {
    if (!collectionId) return
    const selected = cards.filter(c => mergeSel.has(c.id))
    if (selected.length < 2) return
    setCombining(true)
    const merged = await mergeVideoCards(collectionId, selected)
    if (merged) {
      const selectedIds = new Set(selected.map(c => c.id))
      const firstIdx = cards.findIndex(c => c.id === selected[0].id)
      const remaining = cards.filter(c => !selectedIds.has(c.id))
      const newCards = [...remaining.slice(0, firstIdx), merged, ...remaining.slice(firstIdx)]
      setCards(newCards)
      setCurrentIndex(firstIdx)
    }
    setPreviewCard(null)
    setMergeMode(false)
    setMergeSel(new Set())
    setCombining(false)
  }

  // ── Flag + suspend ──
  async function handleFlagSelect(color: string | null) {
    const card = cards[currentIndex]
    if (!card?.flashcard_id) return
    await setFlagColor(card.flashcard_id, color)
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, flag_color: color } : c))
    setShowFlagPicker(false)
  }

  async function handleSuspend() {
    const card = cards[currentIndex]
    if (!card?.flashcard_id) return
    if (card.suspended_at) {
      await unsuspendCard(card.flashcard_id)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, suspended_at: null } : c))
    } else {
      await suspendCard(card.flashcard_id)
      const now = new Date().toISOString()
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, suspended_at: now } : c))
    }
  }

  const navBtn = (enabled: boolean): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: 999,
    border: `1px solid ${T.line}`, background: T.paperHi,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.25, flexShrink: 0,
    color: T.inkSoft,
  })

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < cards.length - 1
  const currentCollection = collections.find(c => c.id === collectionId) ?? null

  return (
    // Fullscreen fixed overlay — no layout scroll, no nav bar
    <div style={{
      position: 'fixed', inset: 0,
      background: T.cream,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
    {/* Width-constrained center column */}
    <div style={{
      flex: 1, minHeight: 0, width: '100%',
      maxWidth: 720, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0,
        padding: '14px 18px 10px',
        borderBottom: `1px solid ${T.lineSoft}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {viewMode === 'landing' ? (
            <Link href={isDemo ? '/login' : '/study'} style={{
              width: 34, height: 34, borderRadius: 999,
              border: `1px solid ${T.lineSoft}`, background: T.paperHi,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkSoft, textDecoration: 'none', flexShrink: 0,
            }}>
              <Icon name="arrow-l" size={16} strokeWidth={1.8} />
            </Link>
          ) : (
            <button onClick={() => setViewMode('landing')} style={{
              width: 34, height: 34, borderRadius: 999,
              border: `1px solid ${T.lineSoft}`, background: T.paperHi,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkSoft, cursor: 'pointer', flexShrink: 0,
            }}>
              <Icon name="arrow-l" size={16} strokeWidth={1.8} />
            </button>
          )}

          <span style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 20, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.02em', lineHeight: 1.1, flex: 1,
          }}>
            {viewMode === 'landing' ? 'Video Decks' : (currentCollection?.name ?? '…')}
          </span>

          {viewMode !== 'landing' && (<>
            <button onClick={cycleCardMode} disabled={availableModes.length <= 1} style={{
              width: 34, height: 34, borderRadius: 10,
              border: `1px solid ${T.lineSoft}`, background: T.paperHi,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: availableModes.length > 1 ? 'pointer' : 'default',
              color: T.inkSoft, opacity: availableModes.length > 1 ? 1 : 0.4,
            }}>
              <Icon name={cardMode === 'video' ? 'film' : cardMode === 'image' ? 'mountain' : 'speaker'} size={14} strokeWidth={1.8} />
            </button>

            <button onClick={() => setGlossMode(v => !v)} style={{
              width: 34, height: 34, borderRadius: 10,
              border: `1px solid ${glossMode ? T.ink : T.lineSoft}`,
              background: glossMode ? T.ink : T.paperHi,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: glossMode ? T.cream : T.inkSoft,
            }}>
              <Icon name="gloss" size={14} strokeWidth={1.8} />
            </button>

            <button onClick={() => setAlwaysRevealed(v => !v)} style={{
              width: 34, height: 34, borderRadius: 10,
              border: `1px solid ${!alwaysRevealed ? T.ink : T.lineSoft}`,
              background: !alwaysRevealed ? T.ink : T.paperHi,
              color: !alwaysRevealed ? T.cream : T.inkMute,
              cursor: 'pointer', fontSize: 15, fontWeight: 600, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              中
              {!alwaysRevealed && (
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 34 34">
                  <line x1="3" y1="31" x2="31" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>

            <button onClick={() => setViewMode(v => v === 'video' ? 'list' : 'video')} style={{
              width: 34, height: 34, borderRadius: 10,
              border: `1px solid ${viewMode === 'list' ? T.ink : T.lineSoft}`,
              background: viewMode === 'list' ? T.ink : T.paperHi,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: viewMode === 'list' ? T.cream : T.inkSoft,
            }}>
              <Icon name={viewMode === 'video' ? 'card' : 'word'} size={14} strokeWidth={1.8} />
            </button>
          </>)}
        </div>
      </div>

      {/* ── Video mode ── */}
      {/* ── Landing: deck selection ── */}
      {viewMode === 'landing' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>
          {collections.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.inkMute, fontSize: 14, paddingTop: 40 }}>
              Loading…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {collections.map(col => (
                <button
                  key={col.id}
                  onClick={() => { setCollectionId(col.id); setViewMode('video') }}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                    borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                    textAlign: 'left', padding: 0,
                  }}
                >
                  <div style={{ aspectRatio: '16/9', background: T.lineSoft, overflow: 'hidden' }}>
                    {col.first_image && (
                      <img src={col.first_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, fontFamily: 'Newsreader, Georgia, serif', lineHeight: 1.3 }}>
                      {col.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace' }}>
                      {col.item_count} sentences
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'video' && (
        <>
          {/* Card area — fills remaining space, vertically centered */}
          <div style={{
            flex: 1, minHeight: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '12px 18px', overflow: 'hidden',
          }}>
            {loading ? (
              <div className="animate-iv-shimmer" style={{ height: 380, borderRadius: 22, background: T.lineSoft }} />
            ) : activeCard ? (
              <>
                <VideoCardDisplay
                  card={activeCard}
                  alwaysRevealed={alwaysRevealed}
                  revealed={revealed}
                  onReveal={() => setRevealed(true)}
                  videoRef={videoRef}
                  videoSegs={videoSegs as string[]}
                  vidSegIdx={vidSegIdx}
                  imageUrl={imageUrl}
                  cardMode={cardMode}
                  hasAudio={hasAudio}
                  audioPlaying={audioPlaying}
                  onAudioToggle={handleAudioToggle}
                  onVideoEnded={handleVideoEnded}
                  onVideoTap={handleVideoTap}
                  onSuspend={handleSuspend}
                  showFlagPicker={showFlagPicker}
                  onFlagToggle={() => setShowFlagPicker(v => !v)}
                  onFlagSelect={handleFlagSelect}
                  isPreview={!!previewCard}
                  isDemo={isDemo}
                  glossMode={glossMode}
                  glosses={glosses}
                  glossLoading={glossLoading}
                  isDesktop={isDesktop}
                  onTokenTap={handleTokenTap}
                  onTokenHover={handleTokenHover}
                  onTokenHoverEnd={handleTokenHoverEnd}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', color: T.inkMute, fontSize: 14 }}>
                No video cards in this deck.
              </div>
            )}
          </div>

          {/* Nav row */}
          {!loading && cards.length > 0 && (
            <div style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 18px 16px', justifyContent: 'center',
              position: 'relative',
            }}>
              <button disabled={!hasPrev} onClick={() => goTo(currentIndex - 1)} style={navBtn(hasPrev)}>
                <Icon name="arrow-l" size={18} strokeWidth={1.8} />
              </button>
              {!isDemo && (
              <button onClick={mergeMode
                ? () => { setMergeMode(false); setMergeSel(new Set()); setPreviewCard(null) }
                : enterMerge
              } style={{
                height: 48, padding: '0 20px', borderRadius: 999,
                border: `1px solid ${mergeMode ? T.crimson : T.line}`,
                background: mergeMode ? T.crimsonBg : T.paperHi,
                color: mergeMode ? T.crimson : T.inkSoft,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {mergeMode ? 'Cancel merge' : 'Merge'}
              </button>
              )}
              <button disabled={!hasNext} onClick={() => goTo(currentIndex + 1)} style={navBtn(hasNext)}>
                <Icon name="arrow-r" size={18} strokeWidth={1.8} />
              </button>
              {!previewCard && (
                <span style={{
                  position: 'absolute', right: 18, bottom: 22,
                  fontSize: 11, color: T.inkFaint,
                  fontFamily: '"JetBrains Mono", monospace',
                }}>
                  {currentIndex + 1} / {cards.length}
                </span>
              )}
            </div>
          )}

          {/* Merge strip */}
          {mergeMode && (
            <div style={{ flexShrink: 0, padding: '0 18px 14px' }}>
              <MergeStrip
                cards={cards}
                currentIndex={currentIndex}
                selection={mergeSel}
                onToggle={toggleMergeSel}
                onPreview={() => setPreviewCard(buildMergePreview())}
                onCombine={handleCombine}
                onCancel={() => { setMergeMode(false); setMergeSel(new Set()); setPreviewCard(null) }}
                combining={combining}
              />
            </div>
          )}
        </>
      )}

      {/* ── List mode ── */}
      {viewMode === 'list' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <BrowserView videoOnly />
        </div>
      )}

    </div>

    {/* ── Word lookup: tooltip (desktop) or bottom sheet (mobile) ── */}
    {lookup && lookup.anchor ? (() => {
      const W = 240
      const left = Math.max(8, Math.min(lookup.anchor.x - W / 2, (typeof window !== 'undefined' ? window.innerWidth : 800) - W - 8))
      const bottom = lookup.anchor.vpH - lookup.anchor.y + 10
      return (
        <div
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }}
          onMouseLeave={() => { hoverTimer.current = setTimeout(() => setLookup(null), 200) }}
          style={{
            position: 'fixed', bottom, left, width: W, zIndex: 60,
            background: T.paperHi, borderRadius: 12,
            border: `1px solid ${T.lineSoft}`,
            boxShadow: '0 4px 20px rgba(80,40,20,0.14)',
            padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 20, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>{lookup.display}</div>
          {lookup.wordAb && lookup.wordAb.toLowerCase() !== lookup.key && (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, marginTop: -4 }}>
              {lookup.wordAb}
            </div>
          )}
          {lookup.loading ? (
            <div style={{ color: T.inkMute, fontSize: 12 }}>…</div>
          ) : lookup.wordCh ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lookup.wordCh.split(' · ').map((def, i) => (
                <div key={i} style={{ fontSize: 13, color: i === 0 ? T.ink : T.inkSoft, lineHeight: 1.4 }}>
                  {i > 0 && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: T.inkFaint, marginRight: 5 }}>{i + 1}</span>}
                  {cleanDef(def)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: T.inkFaint, fontSize: 12, fontStyle: 'italic' }}>No entry found</div>
          )}
        </div>
      )
    })() : lookup ? (
      <>
        <div
          onClick={() => setLookup(null)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 50 }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: T.paperHi, borderRadius: '18px 18px 0 0',
          padding: '20px 22px 36px',
          boxShadow: '0 -4px 24px rgba(80,40,20,0.12)',
          zIndex: 51, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: 26, fontWeight: 500, color: T.ink,
                letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>{lookup.display}</div>
              {lookup.wordAb && lookup.wordAb.toLowerCase() !== lookup.key && (
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, marginTop: 2 }}>
                  {lookup.wordAb}
                </div>
              )}
            </div>
            <button onClick={() => setLookup(null)} style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
              cursor: 'pointer', color: T.inkMute,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="x" size={16} strokeWidth={2} />
            </button>
          </div>
          {lookup.loading ? (
            <div style={{ color: T.inkMute, fontSize: 13 }}>…</div>
          ) : lookup.wordCh ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lookup.wordCh.split(' · ').map((def, i) => (
                <div key={i} style={{ fontSize: 15, color: i === 0 ? T.ink : T.inkSoft, lineHeight: 1.4 }}>
                  {i > 0 && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, marginRight: 6 }}>{i + 1}</span>}
                  {cleanDef(def)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: T.inkFaint, fontSize: 13, fontStyle: 'italic' }}>No entry found</div>
          )}
        </div>
      </>
    ) : null}
    </div>
  )
}
