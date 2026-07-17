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
import { computeStrength, computeMasteryGrade } from '@/lib/db/srs/schedule'
import { FlagPicker } from './pickers'

export type OverlayMode = 'recall' | 'edit'

const SWIPE_NAV_PX = 60

type CardOverlayProps = {
  card:         BrowserCard
  mode:         OverlayMode
  onModeChange: (m: OverlayMode) => void
  onClose:      () => void
  hasPrev:      boolean
  hasNext:      boolean
  onNavigate:   (dir: -1 | 1) => void
  onUpdate:     (patch: Partial<BrowserCard>) => void
  onRemove:     () => void
  sourceName?:  string
}

export function CardOverlay({ card, mode, onModeChange, onClose, hasPrev, hasNext, onNavigate, onUpdate, onRemove, sourceName }: CardOverlayProps) {
  // Edit-mode fields
  const [editFront,  setEditFront]  = useState(card.ab)
  const [editBack,   setEditBack]   = useState(card.zh ?? '')
  const [editNotes,  setEditNotes]  = useState(card.notes ?? '')
  const [editPlace,  setEditPlace]  = useState(card.place_heard ?? '')
  const [editTarget, setEditTarget] = useState(card.target_word ?? '')
  const [saving,        setSaving]        = useState(false)
  const [busy,          setBusy]          = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lookupResults, setLookupResults] = useState<string[] | null>(null)
  const [lookingUp,     setLookingUp]     = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Recall-mode state
  const [revealed, setRevealed] = useState(false)
  const [recallAudioPlaying, setRecallAudioPlaying] = useState(false)
  const recallAudioRef = useRef<HTMLAudioElement | null>(null)
  const recallVideoRef = useRef<HTMLVideoElement | null>(null)

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)

  // Re-seed edit fields when the underlying card identity changes (prev/next
  // nav while the overlay stays open) — not on every keystroke.
  useEffect(() => {
    setEditFront(card.ab); setEditBack(card.zh ?? '')
    setEditNotes(card.notes ?? ''); setEditPlace(card.place_heard ?? '')
    setEditTarget(card.target_word ?? '')
    setConfirmDelete(false); setLookupResults(null); setShowDiscardConfirm(false)
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recall audio/video — reload whenever the card changes or recall mode is entered
  useEffect(() => {
    if (recallAudioRef.current) {
      recallAudioRef.current.pause(); recallAudioRef.current.currentTime = 0
      recallAudioRef.current = null; setRecallAudioPlaying(false)
    }
    setRevealed(false)
    if (mode !== 'recall' || !card.audio) return
    const a = new Audio(card.audio)
    a.onended = () => setRecallAudioPlaying(false)
    a.play().catch(() => {})
    recallAudioRef.current = a
    setRecallAudioPlaying(true)
  }, [card.id, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    audioRef.current?.pause()
    recallAudioRef.current?.pause()
  }, [])

  const dirty = editFront !== card.ab
    || editBack !== (card.zh ?? '')
    || editNotes !== (card.notes ?? '')
    || editPlace !== (card.place_heard ?? '')
    || editTarget !== (card.target_word ?? '')

  function handleScrimClick() {
    if (dirty) { setShowDiscardConfirm(true); return }
    onClose()
  }

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
    if (card.suspended_at) {
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

  function handleTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest('input, textarea, button, select')) { swipeStartRef.current = null; return }
    const t = e.touches[0]
    swipeStartRef.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = swipeStartRef.current
    swipeStartRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_NAV_PX || Math.abs(dy) > Math.abs(dx)) return
    if (dx < 0 && hasNext) onNavigate(1)
    else if (dx > 0 && hasPrev) onNavigate(-1)
  }

  const isSuspended = !!card.suspended_at

  const navBtn = (enabled: boolean): React.CSSProperties => ({
    width: 40, height: 40, borderRadius: 999, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: enabled ? T.paperHi : 'transparent',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.2, flexShrink: 0,
  })

  return (
    <>
      <div onClick={handleScrimClick} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,20,10,0.45)' }} />
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 101,
          height: '85vh', display: 'flex', flexDirection: 'column',
          background: T.paper, borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 32px rgba(30,20,10,0.18)',
          paddingBottom: 'env(safe-area-inset-bottom)', overflow: 'hidden',
        }}
      >
        {/* Nav + mode toggle */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '12px 16px 8px', gap: 8 }}>
          <button disabled={!hasPrev} onClick={() => onNavigate(-1)} style={navBtn(hasPrev)}>
            <Icon name="arrow-l" size={17} strokeWidth={1.8} color={T.inkSoft} />
          </button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 2, background: T.paperHi, borderRadius: 999, padding: 2 }}>
              {(['recall', 'edit'] as const).map(m => (
                <button key={m} onClick={() => onModeChange(m)} style={{
                  padding: '5px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize',
                  background: mode === m ? T.ink : 'transparent',
                  color: mode === m ? T.cream : T.inkMute,
                }}>{m}</button>
              ))}
            </div>
          </div>
          <button disabled={!hasNext} onClick={() => onNavigate(1)} style={navBtn(hasNext)}>
            <Icon name="arrow-r" size={17} strokeWidth={1.8} color={T.inkSoft} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {mode === 'recall' ? (
            <>
              {/* Front */}
              <div style={{ padding: '8px 24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {card.ab}
                </div>
                {card.audio && !card.video_clip && (
                  <button onClick={() => {
                    const a = recallAudioRef.current
                    if (!a) return
                    if (recallAudioPlaying) { a.pause(); a.currentTime = 0; setRecallAudioPlaying(false) }
                    else { a.play().catch(() => {}); setRecallAudioPlaying(true) }
                  }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, borderRadius: 999,
                    background: T.crimson, border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(180,40,30,0.2)',
                  }}>
                    <Icon name={recallAudioPlaying ? 'stop' : 'speaker'} size={16} strokeWidth={1.6} color="#fff" />
                  </button>
                )}
                {card.video_clip && (
                  <video
                    key={card.id}
                    ref={recallVideoRef}
                    src={card.video_clip}
                    autoPlay
                    muted
                    playsInline
                    onClick={() => {
                      const v = recallVideoRef.current
                      const a = recallAudioRef.current
                      if (!v) return
                      if (v.paused) { v.play(); a?.play() }
                      else          { v.pause(); a?.pause() }
                    }}
                    style={{ width: '100%', borderRadius: 12, maxHeight: 260, background: '#000', cursor: 'pointer' }}
                  />
                )}
              </div>

              {/* Reveal */}
              <div style={{ borderTop: `1px solid ${T.lineSoft}` }}>
                {revealed ? (
                  <div style={{ padding: '18px 24px 26px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 500, color: T.ink, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                      {card.zh || <span style={{ color: T.inkFaint, fontStyle: 'italic' }}>No back</span>}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setRevealed(true)} style={{
                    width: '100%', padding: '16px 24px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: T.inkMute,
                    fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Reveal
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
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
                <button onClick={onClose} style={ghostBtn}>Cancel</button>
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
                const color = pct >= 85 ? '#7B8C46'
                            : pct >= 60 ? '#7B8C46'
                            : pct >= 30 ? '#D2773A'
                            :             T.crimson
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={labelStyle}>Strength</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint }}>
                        R {Math.round(st.R * 100)}% · S {st.S}d
                      </span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color }}>
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
          )}
        </div>

        {/* Discard-changes confirm — shown instead of closing when the scrim
            is tapped with unsaved edits pending */}
        {showDiscardConfirm && (
          <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}`, background: T.crimsonBg }}>
            <div style={{ fontSize: 12, color: T.crimson, fontWeight: 600, marginBottom: 8 }}>
              Discard changes?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onClose} style={{
                height: 32, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.crimson, border: 'none', color: '#fff', cursor: 'pointer',
              }}>Discard</button>
              <button onClick={() => setShowDiscardConfirm(false)} style={ghostBtn}>Keep editing</button>
            </div>
          </div>
        )}
      </div>
    </>
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
