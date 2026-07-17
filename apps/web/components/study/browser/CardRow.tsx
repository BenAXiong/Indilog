'use client'

import { useState, useEffect, useRef } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import {
  updateNoteFields, resetCardEase, deleteNote,
  suspendCard, unsuspendCard, setFlagColor,
  type BrowserCard,
} from '@/lib/db/srs/browser'
import { setTargetWord } from '@/lib/db/srs/flashcards'
import { getLanguage } from '@/lib/languages'
import { formatDays, computeStrength, computeMasteryGrade } from '@/lib/db/srs/schedule'
import { flagColorHex } from '@/lib/db/srs/flags'
import { FlagPicker } from './pickers'

// ─── Row swipe / long-press gesture tuning ─────────────────────────────────────

const LONG_PRESS_MS      = 480
const JITTER_PX          = 10   // movement below this is still a tap/hold, not a drag
const SWIPE_REVEAL_PX    = 70   // drag past this distance commits to open/closed
const RIGHT_STRIP_WIDTH  = 108  // swipe-left reveals this (delete/suspend)
const LEFT_STRIP_WIDTH   = 200  // swipe-right reveals this (flag picker — 5 colors + clear)

// ─── Card row ─────────────────────────────────────────────────────────────────

type CardRowProps = {
  card:              BrowserCard
  expanded:          boolean
  onToggle:          () => void
  onUpdate:          (patch: Partial<BrowserCard>) => void
  onRemove:          () => void
  selectionMode:     boolean
  isSelected:        boolean
  onSelect:          () => void
  onLongPressSelect: () => void
  sourceName?:       string
  isPreviewOpen:     boolean
  onOpenPreview:     () => void
}

export function CardRow({ card, expanded, onToggle, onUpdate, onRemove, selectionMode, isSelected, onSelect, onLongPressSelect, sourceName, isPreviewOpen, onOpenPreview }: CardRowProps) {
  const [editFront,  setEditFront]  = useState(card.ab)
  const [editBack,   setEditBack]   = useState(card.zh ?? '')
  const [editNotes,  setEditNotes]  = useState(card.notes ?? '')
  const [editPlace,  setEditPlace]  = useState(card.place_heard ?? '')
  const [editTarget, setEditTarget] = useState(card.target_word ?? '')
  const [saving,         setSaving]         = useState(false)
  const [busy,           setBusy]           = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [lookupResults,  setLookupResults]  = useState<string[] | null>(null)
  const [lookingUp,      setLookingUp]      = useState(false)
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
    selectionMode ? onSelect() : onToggle()
  }

  const displayX = liveX !== null ? liveX : baseXFor(revealed)

  useEffect(() => {
    if (expanded) {
      setEditFront(card.ab);     setEditBack(card.zh ?? '')
      setEditNotes(card.notes ?? ''); setEditPlace(card.place_heard ?? '')
      setEditTarget(card.target_word ?? '')
    }
  }, [expanded, card.ab, card.zh, card.notes, card.place_heard, card.target_word])

  const now         = new Date().toISOString()
  const isDue       = !card.due_at || card.due_at <= now
  const isNew       = card.repetitions === 0
  const isSuspended = !!card.suspended_at
  const flagHex     = flagColorHex(card.flag_color)

  async function handleSave() {
    const f = editFront.trim(), b = editBack.trim()
    if (!f) return
    setSaving(true)
    const newTarget = editTarget.trim() || null
    const targetChanged = newTarget !== (card.target_word || null)
    await updateNoteFields(card.id, {
      ab: f, zh: b || null,
      notes: editNotes.trim() || null,
      place_heard: editPlace.trim() || null,
    })
    const patch: Partial<BrowserCard> = {
      ab: f, zh: b || null,
      notes: editNotes.trim() || null,
      place_heard: editPlace.trim() || null,
    }
    if (targetChanged) {
      await setTargetWord(card.id, newTarget)
      patch.target_word = newTarget
    }
    onUpdate(patch)
    setSaving(false)
  }

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

  async function handleResetEase() {
    if (!card.card_id) return
    setBusy(true)
    await resetCardEase(card.card_id)
    onUpdate({ ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null })
    setBusy(false)
  }

  async function handleSuspendToggle() {
    if (!card.card_id) return
    setBusy(true)
    if (isSuspended) {
      await unsuspendCard(card.card_id)
      onUpdate({ suspended_at: null })
    } else {
      await suspendCard(card.card_id)
      onRemove()
    }
    setBusy(false)
  }

  async function handleLookup() {
    const q = editFront.trim()
    if (!q) return
    setLookingUp(true)
    setLookupResults(null)
    try {
      const params = new URLSearchParams({ q, fuzzy: '1' })
      const res = await fetch(`/api/dict/search?${params}`)
      const { words, sentences } = await res.json() as { words: { word_ch: string }[]; sentences: { zh: string }[] }
      const unique = [...new Set([
        ...words.map(w => w.word_ch),
        ...sentences.map(s => s.zh),
      ].filter(Boolean))]
      setLookupResults(unique)
      if (unique.length > 0 && !editBack.trim()) setEditBack(unique[0])
    } finally {
      setLookingUp(false)
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
      {/* Gesture container — bounds the reveal strips to just the collapsed
          row's height so they don't bleed behind the edit panel below it */}
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
            onClick={() => { setRevealed('none'); if (!expanded) onToggle(); setConfirmDelete(true) }}
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

      {/* Preview icon button */}
      <button
        onClick={e => { e.stopPropagation(); onOpenPreview() }}
        style={{
          flexShrink: 0, width: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isPreviewOpen ? T.ink : 'none', border: 'none',
          borderLeft: `1px solid ${T.lineSoft}`,
          cursor: 'pointer',
        }}
      >
        <Icon name="card" size={14} strokeWidth={1.6} color={isPreviewOpen ? T.cream : T.inkMute} />
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

      {/* Edit panel */}
      {expanded && !selectionMode && (
        <div style={{ padding: '0 12px 14px', borderTop: `1px solid ${T.lineSoft}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>

            {/* Core fields */}
            <div>
              <label style={labelStyle}>Front</label>
              <textarea value={editFront} onChange={e => setEditFront(e.target.value)} rows={2} style={textareaStyle('serif')} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Back</label>
                {!editBack.trim() && (
                  <button onClick={handleLookup} disabled={lookingUp} style={{
                    fontSize: 10.5, fontWeight: 600, color: T.inkMute, background: 'none',
                    border: `1px solid ${T.lineSoft}`, borderRadius: 5, padding: '2px 7px',
                    cursor: lookingUp ? 'default' : 'pointer', opacity: lookingUp ? 0.5 : 1,
                  }}>{lookingUp ? '…' : 'Lookup'}</button>
                )}
              </div>
              <textarea value={editBack} onChange={e => { setEditBack(e.target.value); setLookupResults(null) }} rows={2} style={textareaStyle('sans')} />
              {lookupResults !== null && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                  {lookupResults.length === 0
                    ? <span style={{ fontSize: 11, color: T.inkFaint }}>No results</span>
                    : lookupResults.map((r, i) => (
                        <button key={i} onClick={() => setEditBack(r)} style={{
                          padding: '3px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          background: editBack === r ? T.crimson : T.paperHi,
                          color: editBack === r ? '#fff' : T.inkSoft,
                          border: `1px solid ${editBack === r ? T.crimsonDp : T.line}`,
                        }}>{r}</button>
                      ))
                  }
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Personal notes…" style={textareaStyle('sans')} />
            </div>
            <div>
              <label style={labelStyle}>Place</label>
              <input value={editPlace} onChange={e => setEditPlace(e.target.value)} placeholder="Where heard / seen" style={inputStyle} />
            </div>

            {/* STS target word */}
            <div>
              <label style={labelStyle}>Target word <span style={{ color: T.inkFaint, fontWeight: 400 }}>— STS</span></label>
              <input
                value={editTarget} onChange={e => setEditTarget(e.target.value)}
                placeholder="Set to make this card STS…"
                style={{ ...inputStyle, borderColor: editTarget ? T.amber : undefined }}
              />
            </div>



            {/* Save / cancel */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSave} disabled={saving} style={actionBtn(T.crimson, saving)}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={onToggle} style={ghostBtn}>Cancel</button>
            </div>

            {/* Info strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
              {[getLanguage(card.language)?.name ?? card.language, card.dialect, card.note_type, card.note_source].filter(Boolean).map((v, i) => (
                <span key={i} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkMute, padding: '2px 6px', borderRadius: 4, background: T.paper, border: `1px solid ${T.lineSoft}` }}>
                  {v}
                </span>
              ))}
              {sourceName && (
                <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '2px 6px', borderRadius: 4, background: T.amberBg, color: T.amber, border: `1px solid ${T.amber}40` }}>
                  {sourceName}
                </span>
              )}
              {card.tags?.map(t => (
                <span key={t} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkMute, padding: '2px 6px', borderRadius: 4, background: T.paper, border: `1px solid ${T.lineSoft}` }}>
                  {t}
                </span>
              ))}
            </div>

            {/* Audio */}
            {card.audio && (
              <button onClick={handleAudio} style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
                <Icon name={playing ? 'stop' : 'speaker'} size={13} strokeWidth={1.8} />
                {playing ? 'Stop' : 'Play audio'}
              </button>
            )}

            <div style={{ height: 1, background: T.lineSoft }} />

            {/* Card strength */}
            {(() => {
              const st = computeStrength(card)
              if (!st) return null
              const pct = Math.round(st.score * 100)
              const color = pct >= 85 ? '#7B8C46'   // sage — mature
                          : pct >= 60 ? '#7B8C46'   // sage — strong
                          : pct >= 30 ? '#D2773A'   // amber — learning
                          :             T.crimson    // fragile
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={labelStyle}>Strength</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint }}>
                      R {Math.round(st.R * 100)}% · S {st.S}d
                    </span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700,
                      color,
                    }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Mastery grade */}
            {card.card_id && (() => {
              const grade = computeMasteryGrade(card)
              const GRADE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
                seed:     { color: T.amber,  bg: T.amberBg,   border: '#EBD49A' },
                planted:  { color: T.inkSoft, bg: T.paperHi,  border: T.lineSoft },
                rooted:   { color: '#566234', bg: '#E4E7CC',  border: '#D2D8AE'  },
                blooming: { color: '#3a601a', bg: '#cfe8b8',  border: '#b2d895'  },
              }
              const gs = GRADE_STYLE[grade]
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={labelStyle}>Grade</label>
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: gs.color, background: gs.bg, border: `1px solid ${gs.border}`,
                    padding: '3px 8px', borderRadius: 6,
                  }}>
                    {grade}
                  </span>
                </div>
              )
            })()}

            {/* Flag row */}
            <div>
              <label style={labelStyle}>Flag</label>
              <FlagPicker current={card.flag_color} onChange={handleFlagChange} />
            </div>

            {/* Suspend + ease reset + delete */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSuspendToggle} disabled={busy} style={ghostBtn}>
                  {isSuspended ? 'Unsuspend' : 'Suspend'}
                </button>
                {!isSuspended && (
                  <button onClick={handleResetEase} disabled={busy} style={{
                    height: 34, padding: '0 12px', borderRadius: 8,
                    border: `1px solid #EFCAB8`, background: T.crimsonBg,
                    color: T.crimson, fontSize: 12, fontWeight: 500,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  }}>Reset ease</button>
                )}
              </div>
              <button onClick={() => setConfirmDelete(true)} style={{
                height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                border: `1px solid ${T.lineSoft}`, background: 'none',
                color: T.inkFaint, cursor: 'pointer',
              }}>Delete…</button>
            </div>

            {/* Delete confirmation */}
            {confirmDelete && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: T.crimsonBg, border: `1px solid #EFCAB8` }}>
                <div style={{ fontSize: 12, color: T.crimson, fontWeight: 600, marginBottom: 4 }}>
                  Permanently delete this note?
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
                  Card data and full review history will be erased — this affects your heatmap and stats. Use Suspend instead to keep the data.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={async () => {
                    setBusy(true)
                    await deleteNote(card.id)
                    onRemove()
                  }} disabled={busy} style={{
                    height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: T.crimson, border: 'none', color: '#fff',
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                  }}>Delete permanently</button>
                  <button onClick={() => setConfirmDelete(false)} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: T.inkMute,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  fontFamily: '"JetBrains Mono", monospace', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  background: T.paper, border: `1px solid ${T.line}`,
  fontSize: 13, color: T.inkSoft, fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const textareaStyle = (family: 'serif' | 'sans'): React.CSSProperties => ({
  width: '100%', padding: '8px 10px', borderRadius: 8,
  background: T.paper, border: `1px solid ${T.line}`,
  fontSize: 14, color: family === 'serif' ? T.ink : T.inkSoft,
  fontFamily: family === 'serif' ? 'Newsreader, Georgia, serif' : 'inherit',
  resize: 'vertical', boxSizing: 'border-box',
})

const actionBtn = (bg: string, disabled: boolean): React.CSSProperties => ({
  height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
  background: bg, color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1,
})

const ghostBtn: React.CSSProperties = {
  height: 34, padding: '0 12px', borderRadius: 8,
  border: `1px solid ${T.lineSoft}`, background: T.paperHi,
  color: T.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
