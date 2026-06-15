'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { FlagPicker } from '@/components/study/FlagPicker'
import { flagColorHex } from '@/lib/db/srs/flags'
import {
  listVideoCollections, listCollectionVideoCards, mergeVideoCards,
  setFlagColor, suspendCard, unsuspendCard,
  type VideoCard, type VideoCollection,
} from '@/lib/db/video/queries'

// ─── Card shell ───────────────────────────────────────────────────────────────

function VideoCardDisplay({
  card,
  alwaysRevealed,
  revealed,
  onReveal,
  videoRef,
  videoSegs,
  vidSegIdx,
  onVideoEnded,
  onVideoTap,
  onSuspend,
  showFlagPicker,
  onFlagToggle,
  onFlagSelect,
  isPreview,
}: {
  card: VideoCard
  alwaysRevealed: boolean
  revealed: boolean
  onReveal: () => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  videoSegs: string[]
  vidSegIdx: number
  onVideoEnded: () => void
  onVideoTap: () => void
  onSuspend: () => void
  showFlagPicker: boolean
  onFlagToggle: () => void
  onFlagSelect: (c: string | null) => void
  isPreview?: boolean
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
      {/* Suspend — top left */}
      <div style={{ position: 'absolute', top: 10, left: 12 }} onClick={e => e.stopPropagation()}>
        <button onClick={onSuspend} aria-label="Suspend" style={{
          width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: card.suspended_at ? T.amber : T.inkFaint,
        }}>
          <Icon name="pause" size={15} strokeWidth={1.8} />
        </button>
      </div>

      {/* Flag picker — top right */}
      <FlagPicker
        currentFlag={card.flag_color}
        showPicker={showFlagPicker}
        onToggle={onFlagToggle}
        onSelect={onFlagSelect}
      />

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

      {/* Video */}
      {videoSegs.length > 0 && (
        <div style={{ borderRadius: 14, overflow: 'hidden', marginTop: 22, marginBottom: 18 }}>
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            key={`${card.id}-${vidSegIdx}`}
            src={videoSegs[vidSegIdx]}
            autoPlay
            muted
            playsInline
            onEnded={onVideoEnded}
            onClick={onVideoTap}
            style={{ width: '100%', maxHeight: 240, background: '#000', cursor: 'pointer', display: 'block' }}
          />
        </div>
      )}

      {/* Front — ab */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: 16 }}>
        <div style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 28, fontWeight: 500, color: T.ink,
          letterSpacing: '-0.02em', lineHeight: 1.25,
        }}>
          {card.ab}
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
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11, fontWeight: 600, color: T.inkMute,
            letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 16px',
          }}>
            Reveal
          </button>
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

export default function VideoPage() {
  const [collections,    setCollections]    = useState<VideoCollection[]>([])
  const [collectionId,   setCollectionId]   = useState<string | null>(null)
  const [cards,          setCards]          = useState<VideoCard[]>([])
  const [currentIndex,   setCurrentIndex]   = useState(0)
  const [loading,        setLoading]        = useState(false)
  const [alwaysRevealed, setAlwaysRevealed] = useState(true)
  const [revealed,       setRevealed]       = useState(false)

  // Merge
  const [mergeMode,   setMergeMode]   = useState(false)
  const [mergeSel,    setMergeSel]    = useState<Set<string>>(new Set())
  const [previewCard, setPreviewCard] = useState<VideoCard | null>(null)
  const [combining,   setCombining]   = useState(false)

  // Flag
  const [showFlagPicker, setShowFlagPicker] = useState(false)

  // Video / audio refs
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [vidSegIdx, setVidSegIdx] = useState(0)

  const activeCard = previewCard ?? cards[currentIndex] ?? null

  const videoSegs = activeCard?.metadata?.video_segments
    ?? (activeCard?.metadata?.video_clip ? [activeCard.metadata.video_clip] : [])
  const audioSegs = activeCard?.metadata?.audio_segments
    ?? (activeCard?.audio ? [activeCard.audio] : [])

  // ── Load collections on mount ──
  useEffect(() => {
    listVideoCollections().then(cols => {
      setCollections(cols)
      if (cols.length > 0) setCollectionId(cols[0].id)
    })
  }, [])

  // ── Load cards when collection changes ──
  useEffect(() => {
    if (!collectionId) return
    setLoading(true)
    setCards([])
    setCurrentIndex(0)
    setPreviewCard(null)
    setMergeMode(false)
    listCollectionVideoCards(collectionId).then(c => {
      setCards(c)
      setLoading(false)
    })
  }, [collectionId])

  // ── Reset video/audio when active card changes ──
  useEffect(() => {
    setVidSegIdx(0)
    setRevealed(false)
    setShowFlagPicker(false)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (!audioSegs[0]) return
    const a = new Audio(audioSegs[0])
    a.play().catch(() => {})
    audioRef.current = a
  }, [activeCard?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Navigation ──
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= cards.length) return
    setCurrentIndex(idx)
    setPreviewCard(null)
    setMergeMode(false)
    setMergeSel(new Set())
  }, [cards.length])

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
      metadata:     { video_clip: videoSegsP[0], video_segments: videoSegsP, audio_segments: audioSegsP },
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

  // ── Styles ──
  const navBtn = (enabled: boolean): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: 999,
    border: `1px solid ${T.line}`, background: T.paperHi,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.25, flexShrink: 0,
    color: T.inkSoft,
  })

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < cards.length - 1

  return (
    <div style={{ paddingBottom: 110, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '8px 18px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/study" style={{
          width: 34, height: 34, borderRadius: 999,
          border: `1px solid ${T.lineSoft}`, background: T.paperHi,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, textDecoration: 'none', flexShrink: 0,
        }}>
          <Icon name="arrow-l" size={16} strokeWidth={1.8} />
        </Link>
        <h1 style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 26, fontWeight: 500, color: T.ink,
          letterSpacing: '-0.025em', lineHeight: 1.1, flex: 1,
        }}>Video Decks</h1>

        {/* Always-reveal toggle */}
        <button onClick={() => setAlwaysRevealed(v => !v)} style={{
          height: 30, padding: '0 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          border: `1px solid ${alwaysRevealed ? T.ink : T.lineSoft}`,
          background: alwaysRevealed ? T.ink : T.paperHi,
          color: alwaysRevealed ? T.cream : T.inkMute,
          cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0,
        }}>Reveal</button>
      </div>

      {/* Collection chips */}
      {collections.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 18px 0' }}>
          {collections.map(col => {
            const active = col.id === collectionId
            return (
              <button key={col.id} onClick={() => setCollectionId(col.id)} style={{
                flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 999,
                border: `1px solid ${active ? T.ink : T.lineSoft}`,
                background: active ? T.ink : T.paperHi,
                color: active ? T.cream : T.inkSoft,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>{col.name}</button>
            )
          })}
        </div>
      )}

      {/* Counter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 18px 0',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: T.inkMute,
      }}>
        {loading ? '…' : cards.length === 0 ? 'No video cards' : `${currentIndex + 1} / ${cards.length}`}
      </div>

      {/* Card */}
      <div style={{ padding: '12px 18px 0' }}>
        {loading ? (
          <div className="animate-iv-shimmer" style={{ height: 360, borderRadius: 22, background: T.lineSoft }} />
        ) : activeCard ? (
          <VideoCardDisplay
            card={activeCard}
            alwaysRevealed={alwaysRevealed}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            videoRef={videoRef}
            videoSegs={videoSegs as string[]}
            vidSegIdx={vidSegIdx}
            onVideoEnded={handleVideoEnded}
            onVideoTap={handleVideoTap}
            onSuspend={handleSuspend}
            showFlagPicker={showFlagPicker}
            onFlagToggle={() => setShowFlagPicker(v => !v)}
            onFlagSelect={handleFlagSelect}
            isPreview={!!previewCard}
          />
        ) : (
          <div style={{ padding: '60px 0', textAlign: 'center', color: T.inkMute, fontSize: 14 }}>
            {collectionId ? 'No video cards in this deck.' : 'Select a deck above.'}
          </div>
        )}
      </div>

      {/* Nav row */}
      {!loading && cards.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 0', justifyContent: 'center' }}>
          <button disabled={!hasPrev} onClick={() => goTo(currentIndex - 1)} style={navBtn(hasPrev)}>
            <Icon name="arrow-l" size={18} strokeWidth={1.8} />
          </button>
          <button onClick={mergeMode ? () => { setMergeMode(false); setMergeSel(new Set()); setPreviewCard(null) } : enterMerge} style={{
            height: 48, padding: '0 20px', borderRadius: 999,
            border: `1px solid ${mergeMode ? T.crimson : T.line}`,
            background: mergeMode ? T.crimsonBg : T.paperHi,
            color: mergeMode ? T.crimson : T.inkSoft,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {mergeMode ? 'Cancel merge' : 'Merge'}
          </button>
          <button disabled={!hasNext} onClick={() => goTo(currentIndex + 1)} style={navBtn(hasNext)}>
            <Icon name="arrow-r" size={18} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Merge strip */}
      {mergeMode && (
        <div style={{ padding: '12px 18px 0' }}>
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

    </div>
  )
}
