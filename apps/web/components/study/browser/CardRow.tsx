'use client'

import { useState, useEffect, useRef } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { suspendCard, unsuspendCard, setFlagColor, type BrowserCard } from '@/lib/db/srs/browser'
import { formatDays } from '@/lib/db/srs/schedule'
import { flagColorHex } from '@/lib/db/srs/flags'
import { FlagPicker } from './pickers'
import type { OverlayMode } from './CardOverlay'

// ─── Row swipe / long-press gesture tuning ─────────────────────────────────────

const LONG_PRESS_MS      = 480
const JITTER_PX          = 10   // movement below this is still a tap/hold, not a drag
const SWIPE_REVEAL_PX    = 70   // drag past this distance commits to open/closed
const RIGHT_STRIP_WIDTH  = 108  // swipe-left reveals this (delete/suspend)
const LEFT_STRIP_WIDTH   = 200  // swipe-right reveals this (flag picker — 5 colors + clear)

// ─── Card row ─────────────────────────────────────────────────────────────────

type CardRowProps = {
  card:              BrowserCard
  onUpdate:          (patch: Partial<BrowserCard>) => void
  onRemove:          () => void
  selectionMode:     boolean
  isSelected:        boolean
  onSelect:          () => void
  onLongPressSelect: () => void
  isOverlayOpen:     boolean
  onOpenOverlay:     (mode: OverlayMode) => void
}

export function CardRow({ card, onUpdate, onRemove, selectionMode, isSelected, onSelect, onLongPressSelect, isOverlayOpen, onOpenOverlay }: CardRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  // Swipe-to-reveal (left → delete/suspend, right → flag) + long-press-to-select.
  // `revealed` is the settled state; `liveX` is non-null only while a drag is in
  // progress, so the foreground can track the finger without fighting the
  // settle transition. Long-press fires from a ref-based timer so it isn't
  // reset by the re-renders the drag itself causes.
  const [revealed, setRevealed] = useState<'none' | 'left' | 'right'>('none')
  const [liveX, setLiveX] = useState<number | null>(null)
  const gestureRef = useRef({
    startX: 0, startY: 0, baseX: 0, dragging: false, longPressFired: false,
    longPressTimer: null as ReturnType<typeof setTimeout> | null,
  })

  useEffect(() => () => {
    audioRef.current?.pause()
    if (gestureRef.current.longPressTimer) clearTimeout(gestureRef.current.longPressTimer)
  }, [])

  // Entering selection mode (from a long-press on any row) hides every row's
  // reveal strips — reset so a still-open row doesn't end up visually shifted
  // with nothing behind it.
  useEffect(() => {
    if (selectionMode) { setRevealed('none'); setLiveX(null) }
  }, [selectionMode])

  function baseXFor(r: 'none' | 'left' | 'right') {
    return r === 'left' ? -RIGHT_STRIP_WIDTH : r === 'right' ? LEFT_STRIP_WIDTH : 0
  }

  function gestureStart(x: number, y: number) {
    if (selectionMode) return
    gestureRef.current.startX = x
    gestureRef.current.startY = y
    gestureRef.current.baseX = baseXFor(revealed)
    gestureRef.current.dragging = false
    gestureRef.current.longPressFired = false
    if (gestureRef.current.longPressTimer) clearTimeout(gestureRef.current.longPressTimer)
    gestureRef.current.longPressTimer = setTimeout(() => {
      gestureRef.current.longPressFired = true
      gestureRef.current.longPressTimer = null
      onLongPressSelect()
    }, LONG_PRESS_MS)
  }

  function gestureMove(x: number, y: number) {
    if (selectionMode) return
    const dx = x - gestureRef.current.startX
    const dy = y - gestureRef.current.startY
    if (!gestureRef.current.dragging) {
      if (Math.abs(dx) < JITTER_PX && Math.abs(dy) < JITTER_PX) return
      if (Math.abs(dy) > Math.abs(dx)) return // vertical scroll — let it through, don't hijack
      gestureRef.current.dragging = true
      if (gestureRef.current.longPressTimer) { clearTimeout(gestureRef.current.longPressTimer); gestureRef.current.longPressTimer = null }
    }
    const raw = gestureRef.current.baseX + dx
    setLiveX(Math.max(-RIGHT_STRIP_WIDTH - 20, Math.min(LEFT_STRIP_WIDTH + 20, raw)))
  }

  // `finalX` is read directly from the ending touch/mouse event rather than
  // from `liveX` state — avoids depending on a state closure staying fresh
  // across the touchmove → touchend handoff, matching the ref-based idiom
  // the rest of the app's hand-rolled swipe code already uses.
  function gestureEnd(finalX?: number, e?: { preventDefault?: () => void }) {
    if (gestureRef.current.longPressTimer) { clearTimeout(gestureRef.current.longPressTimer); gestureRef.current.longPressTimer = null }
    if (gestureRef.current.longPressFired) {
      e?.preventDefault?.() // suppress the ghost click that follows a held touch
      setLiveX(null)
      return
    }
    if (gestureRef.current.dragging && finalX !== undefined) {
      const raw = gestureRef.current.baseX + (finalX - gestureRef.current.startX)
      const clamped = Math.max(-RIGHT_STRIP_WIDTH - 20, Math.min(LEFT_STRIP_WIDTH + 20, raw))
      if (clamped <= -SWIPE_REVEAL_PX)      setRevealed('left')
      else if (clamped >= SWIPE_REVEAL_PX)  setRevealed('right')
      else                                   setRevealed('none')
    }
    setLiveX(null)
  }

  function handleMouseDown(e: React.MouseEvent) {
    gestureStart(e.clientX, e.clientY)
    const onMove = (ev: MouseEvent) => gestureMove(ev.clientX, ev.clientY)
    const onUp = (ev: MouseEvent) => { gestureEnd(ev.clientX); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleRowClick() {
    if (gestureRef.current.longPressFired) { gestureRef.current.longPressFired = false; return }
    if (revealed !== 'none') { setRevealed('none'); return }
    selectionMode ? onSelect() : onOpenOverlay('edit')
  }

  const displayX = liveX !== null ? liveX : baseXFor(revealed)

  const now         = new Date().toISOString()
  const isDue       = !card.due_at || card.due_at <= now
  const isNew       = card.repetitions === 0
  const isSuspended = !!card.suspended_at
  const flagHex     = flagColorHex(card.flag_color)

  function handleAudio() {
    if (!card.audio) return
    if (playing && audioRef.current) {
      audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); return
    }
    const a = new Audio(card.audio)
    a.onended = () => setPlaying(false)
    a.play().catch(() => {})
    audioRef.current = a
    setPlaying(true)
  }

  async function handleSuspendToggle() {
    if (!card.card_id) return
    if (isSuspended) {
      await unsuspendCard(card.card_id)
      onUpdate({ suspended_at: null })
    } else {
      await suspendCard(card.card_id)
      onRemove()
    }
  }

  async function handleFlagChange(color: string | null) {
    if (!card.card_id) return
    await setFlagColor(card.card_id, color)
    onUpdate({ flag_color: color })
  }

  const rowBg = isSelected ? T.crimsonBg : isSuspended ? T.paper : T.paperHi

  return (
    <div style={{
      background: rowBg,
      border: `1px solid ${isSelected ? '#EFCAB8' : flagHex ? flagHex + '55' : isSuspended ? T.line : T.lineSoft}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
      opacity: isSuspended ? 0.72 : 1,
    }}>
      {/* Gesture container — bounds the reveal strips to just this row's height */}
      <div style={{ position: 'relative' }}>
      {/* Swipe-right reveal — inline flag picker */}
      {!selectionMode && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: LEFT_STRIP_WIDTH,
          display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px',
          background: T.paperHi,
        }}>
          <FlagPicker current={card.flag_color} onChange={color => { handleFlagChange(color); setRevealed('none') }} />
        </div>
      )}

      {/* Swipe-left reveal — delete / suspend */}
      {!selectionMode && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: RIGHT_STRIP_WIDTH,
          display: 'flex', alignItems: 'stretch',
        }}>
          <button
            onClick={() => { setRevealed('none'); handleSuspendToggle() }}
            style={{
              flex: 1, background: T.paperHi, border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, color: T.inkSoft,
            }}
          >
            {isSuspended ? 'Unsuspend' : 'Suspend'}
          </button>
          <button
            onClick={() => { setRevealed('none'); onOpenOverlay('edit') }}
            style={{
              flex: 1, background: T.crimson, border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, color: '#fff',
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Collapsed row — foreground; slides to reveal the strips above */}
      <div
        onTouchStart={e => gestureStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={e => gestureMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={e => gestureEnd(e.changedTouches[0]?.clientX, e)}
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex', alignItems: 'stretch', position: 'relative', background: rowBg,
          transform: `translateX(${displayX}px)`,
          transition: liveX !== null ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
      >
      <button onClick={handleRowClick} style={{
        flex: 1, minWidth: 0, padding: '11px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 9,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {/* Status badge */}
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          {!card.card_id ? (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint, padding: '2px 5px', borderRadius: 4, background: T.paper, border: `1px solid ${T.lineSoft}` }}>—</span>
          ) : isSuspended ? (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: T.inkMute, padding: '2px 5px', borderRadius: 4, background: T.paper, border: `1px solid ${T.line}` }}>SUSP</span>
          ) : isNew ? (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: T.amber, padding: '2px 5px', borderRadius: 4, background: T.amberBg, border: `1px solid #EBD49A` }}>NEW</span>
          ) : isDue ? (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: T.crimson, padding: '2px 5px', borderRadius: 4, background: T.crimsonBg, border: `1px solid #EFCAB8` }}>DUE</span>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint, padding: '2px 5px', borderRadius: 4, background: T.paper, border: `1px solid ${T.lineSoft}` }}>
              {formatDays(card.interval_days)}
            </span>
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 500,
            color: isSuspended ? T.inkSoft : T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{card.ab}</div>
          <div style={{
            fontSize: 12.5, color: T.inkMute, marginTop: 1.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{card.zh}</div>
        </div>

        {/* Meta + flag dot */}
        <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {flagHex && (
              <span style={{ width: 10, height: 10, borderRadius: 999, background: flagHex, flexShrink: 0 }} />
            )}
{card.target_word && (
              <span style={{ fontSize: 9, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', padding: '1px 4px', borderRadius: 3, border: `1px solid ${T.lineSoft}` }}>STS</span>
            )}
            <span style={{ fontSize: 11, color: T.inkMute, maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {card.source}
            </span>
          </div>
          {card.language && (
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint, padding: '1px 5px', borderRadius: 3, background: T.paper, border: `1px solid ${T.lineSoft}` }}>
              {card.language}
            </span>
          )}
        </div>
      </button>

      {/* Preview icon button — opens the overlay in recall mode */}
      <button
        onClick={e => { e.stopPropagation(); onOpenOverlay('recall') }}
        style={{
          flexShrink: 0, width: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isOverlayOpen ? T.ink : 'none', border: 'none',
          borderLeft: `1px solid ${T.lineSoft}`,
          cursor: 'pointer',
        }}
      >
        <Icon name="card" size={14} strokeWidth={1.6} color={isOverlayOpen ? T.cream : T.inkMute} />
      </button>

      {/* Audio button — full height, crimson when available */}
      <button
        onClick={handleAudio}
        disabled={!card.audio}
        style={{
          flexShrink: 0, width: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none',
          borderLeft: `1px solid ${T.lineSoft}`,
          cursor: card.audio ? 'pointer' : 'default',
        }}
      >
        <Icon
          name={playing ? 'stop' : 'speaker'}
          size={16} strokeWidth={1.6}
          color={card.audio ? (playing ? T.crimsonDp : T.crimson) : T.lineSoft}
        />
      </button>
      </div>
      </div>
    </div>
  )
}
