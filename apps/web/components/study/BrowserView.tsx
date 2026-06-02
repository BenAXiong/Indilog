'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import {
  listBrowserCards, updateNoteFields, resetCardEase, deleteNote,
  batchDeleteNotes, batchSuspendCards, batchSetFlag,
  suspendCard, unsuspendCard, setFlagColor,
  type BrowserCard, type BrowserFilter, type BrowserSort,
} from '@/lib/db/srs/browser'
import { setTargetWord } from '@/lib/db/srs/flashcards'
import { listSources } from '@/lib/db/sources/sources'
import { getLanguage } from '@/lib/languages'
import { formatDays, computeStrength } from '@/lib/db/srs/schedule'
import { FLAG_COLORS, flagColorHex } from '@/lib/db/srs/flags'

const FILTERS: { value: BrowserFilter; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'due',       label: 'Due'       },
  { value: 'new',       label: 'New'       },
  { value: 'flagged',   label: 'Flagged'   },
  { value: 'suspended', label: 'Suspended' },
]

const SORT_OPTIONS: { value: BrowserSort; label: string }[] = [
  { value: 'due',   label: 'Due date' },
  { value: 'ease',  label: 'Ease'     },
  { value: 'added', label: 'Added'    },
]

// ─── Flag color picker (reusable inline picker) ───────────────────────────────

function FlagPicker({ current, onChange }: { current: string | null; onChange: (c: string | null) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {FLAG_COLORS.map(fc => (
        <button key={fc.key} onClick={() => onChange(current === fc.key ? null : fc.key)} style={{
          width: 22, height: 22, borderRadius: 999, border: 'none',
          background: fc.color, cursor: 'pointer', flexShrink: 0,
          boxShadow: current === fc.key ? `0 0 0 2px #fff, 0 0 0 3.5px ${fc.color}` : 'none',
        }} />
      ))}
      {current && (
        <button onClick={() => onChange(null)} style={{
          width: 22, height: 22, borderRadius: 999,
          border: `1.5px solid ${T.lineSoft}`, background: T.paper,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: T.inkMute, flexShrink: 0,
        }}>×</button>
      )}
    </div>
  )
}

// ─── Card row ─────────────────────────────────────────────────────────────────

type CardRowProps = {
  card:          BrowserCard
  expanded:      boolean
  onToggle:      () => void
  onUpdate:      (patch: Partial<BrowserCard>) => void
  onRemove:      () => void
  selectionMode: boolean
  isSelected:    boolean
  onSelect:      () => void
  sourceName?:   string
}

function CardRow({ card, expanded, onToggle, onUpdate, onRemove, selectionMode, isSelected, onSelect, sourceName }: CardRowProps) {
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

  return (
    <div style={{
      background: isSelected ? T.crimsonBg : isSuspended ? T.paper : T.paperHi,
      border: `1px solid ${isSelected ? '#EFCAB8' : flagHex ? flagHex + '55' : isSuspended ? T.line : T.lineSoft}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
      opacity: isSuspended ? 0.72 : 1,
    }}>
      {/* Collapsed row */}
      <button onClick={selectionMode ? onSelect : onToggle} style={{
        width: '100%', padding: '11px 12px',
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
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint }}>
            e{card.ease_factor.toFixed(1)}
          </div>
        </div>
      </button>

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

// ─── Browser ──────────────────────────────────────────────────────────────────

export default function BrowserView() {
  const [filter,          setFilter]          = useState<BrowserFilter>('all')
  const [flagColorFilter, setFlagColorFilter] = useState<string | null>(null)
  const [sort,            setSort]            = useState<BrowserSort>('due')
  const [search,          setSearch]          = useState('')
  const [cards,           setCards]           = useState<BrowserCard[]>([])
  const [loading,         setLoading]         = useState(true)
  const [expandedId,      setExpandedId]      = useState<string | null>(null)
  const [sourceNames,    setSourceNames]    = useState<Map<string, string>>(new Map())
  const [fType,          setFType]          = useState('')
  const [fSource,        setFSource]        = useState('')
  const [fromDate,       setFromDate]       = useState('')
  const [toDate,         setToDate]         = useState('')
  const [selectionMode,  setSelectionMode]  = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [batchConfirm,   setBatchConfirm]   = useState(false)
  const [showBatchFlag,  setShowBatchFlag]  = useState(false)

  useEffect(() => {
    if (filter !== 'flagged') setFlagColorFilter(null)
  }, [filter])

  useEffect(() => {
    setLoading(true)
    setExpandedId(null)
    listBrowserCards(filter, sort, filter === 'flagged' ? flagColorFilter : undefined)
      .then(c => { setCards(c); setLoading(false) })
  }, [filter, sort, flagColorFilter])

  useEffect(() => {
    listSources().then(ss => {
      setSourceNames(new Map(ss.map(s => [s.id, s.name])))
    })
  }, [])

  const dropStyle: React.CSSProperties = {
    height: 30, padding: '0 26px 0 10px', borderRadius: 8, fontSize: 12,
    background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
    fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
    maxWidth: 160,
  }
  const availTypes   = useMemo(() => [...new Set(cards.map(c => c.note_type).filter(Boolean))].sort(), [cards])
  const availSources = useMemo(() => [...new Set(cards.map(c => c.source).filter(Boolean))].sort(), [cards])

  const filtered = useMemo(() => {
    let result = cards
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c => c.ab.toLowerCase().includes(q) || (c.zh ?? '').toLowerCase().includes(q))
    }
    if (fType)    result = result.filter(c => c.note_type === fType)
    if (fSource)  result = result.filter(c => c.source === fSource)
    if (fromDate) result = result.filter(c => c.created_at >= fromDate)
    if (toDate)   result = result.filter(c => c.created_at <= toDate + 'T23:59:59.999Z')
    return result
  }, [cards, search, fType, fSource, fromDate, toDate])

  function updateCard(id: string, patch: Partial<BrowserCard>) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function removeCard(id: string) {
    setCards(prev => prev.filter(c => c.id !== id))
    setExpandedId(null)
  }

  function exitSelectionMode() {
    setSelectionMode(false); setSelectedIds(new Set())
    setBatchConfirm(false);  setShowBatchFlag(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allSelected = selectedIds.size > 0 && selectedIds.size === filtered.length

  async function handleBatchDelete() {
    const ids = [...selectedIds]
    await batchDeleteNotes(ids)
    setCards(prev => prev.filter(c => !selectedIds.has(c.id)))
    exitSelectionMode()
  }

  async function handleBatchSuspend() {
    const ids = [...selectedIds]
    await batchSuspendCards(ids)
    const now = new Date().toISOString()
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, suspended_at: now } : c))
    exitSelectionMode()
  }

  async function handleBatchFlag(color: string | null) {
    const ids = [...selectedIds]
    await batchSetFlag(ids, color)
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, flag_color: color } : c))
    exitSelectionMode()
  }

  return (
    <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Search + Select */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Icon name="search" size={15} color={T.inkMute} />
          </div>
          <input
            placeholder="Search cards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              borderRadius: 10, background: T.paperHi, border: `1px solid ${T.line}`,
              fontSize: 14, color: T.ink, fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>
        <button onClick={() => { setSelectionMode(v => !v); setSelectedIds(new Set()); setExpandedId(null) }} style={{
          height: 40, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: selectionMode ? T.ink : T.paperHi,
          border: `1px solid ${selectionMode ? T.ink : T.line}`,
          color: selectionMode ? T.cream : T.inkSoft,
          cursor: 'pointer', flexShrink: 0,
        }}>
          {selectionMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Filter row: SRS state | source | spacer | field-filters | sort */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* SRS state dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select value={filter} onChange={e => setFilter(e.target.value as BrowserFilter)} style={dropStyle}>
            {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
            <Icon name="chev-d" size={11} strokeWidth={2} />
          </div>
        </div>

        {/* Source/deck dropdown */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <select value={fSource} onChange={e => setFSource(e.target.value)} style={{ ...dropStyle, maxWidth: '100%', width: '100%' }}>
            <option value="">All sources</option>
            {availSources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
            <Icon name="chev-d" size={11} strokeWidth={2} />
          </div>
        </div>

        {/* Type dropdown */}
        {availTypes.length > 1 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <select value={fType} onChange={e => setFType(e.target.value)} style={dropStyle}>
              <option value="">All types</option>
              {availTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
              <Icon name="chev-d" size={11} strokeWidth={2} />
            </div>
          </div>
        )}

        {/* Sort */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select value={sort} onChange={e => setSort(e.target.value as BrowserSort)} style={dropStyle}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
            <Icon name="chev-d" size={11} strokeWidth={2} />
          </div>
        </div>
      </div>


      {/* Date range row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>Added</span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{
          flex: 1, height: 28, padding: '0 8px', borderRadius: 7, fontSize: 12,
          background: fromDate ? T.paperHi : T.paper,
          border: `1px solid ${fromDate ? T.line : T.lineSoft}`,
          color: fromDate ? T.ink : T.inkFaint, fontFamily: 'inherit', cursor: 'pointer',
        }} />
        <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>→</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{
          flex: 1, height: 28, padding: '0 8px', borderRadius: 7, fontSize: 12,
          background: toDate ? T.paperHi : T.paper,
          border: `1px solid ${toDate ? T.line : T.lineSoft}`,
          color: toDate ? T.ink : T.inkFaint, fontFamily: 'inherit', cursor: 'pointer',
        }} />
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate('') }} style={{
            height: 28, padding: '0 8px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
            background: 'none', border: `1px solid ${T.lineSoft}`, color: T.inkFaint, flexShrink: 0,
          }}>✕</button>
        )}
      </div>

      {/* Flag color sub-filter (when Flagged is selected) */}
      {filter === 'flagged' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace' }}>Color:</span>
          <FlagPicker current={flagColorFilter} onChange={setFlagColorFilter} />
        </div>
      )}

      {/* Review flagged CTA */}
      {filter === 'flagged' && filtered.length > 0 && (
        <Link
          href={flagColorFilter ? `/review?flag=${flagColorFilter}` : '/review?filter=flagged'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 46, borderRadius: 13, textDecoration: 'none',
            background: flagColorFilter ? (flagColorHex(flagColorFilter) ?? T.amber) : T.amber,
            color: '#fff',
            boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset',
            fontSize: 14, fontWeight: 600,
          }}>
          <Icon name="play" size={13} color="#fff" />
          Review flagged ({filtered.length} due)
        </Link>
      )}

      {/* Count */}
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, paddingLeft: 2 }}>
        {loading ? '…' : `${filtered.length} card${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-iv-shimmer" style={{ height: 60, borderRadius: 12, background: T.lineSoft }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: T.inkMute }}>
            {search ? 'No cards match your search.' : 'No cards here.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(card => (
            <CardRow
              key={card.id}
              card={card}
              expanded={expandedId === card.id}
              onToggle={() => setExpandedId(prev => prev === card.id ? null : card.id)}
              onUpdate={patch => updateCard(card.id, patch)}
              onRemove={() => removeCard(card.id)}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(card.id)}
              onSelect={() => toggleSelect(card.id)}
              sourceName={card.source_id ? sourceNames.get(card.source_id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Bottom padding when action bar is visible */}
      {selectionMode && <div style={{ height: 80 }} />}

      {/* Batch action bar */}
      {selectionMode && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
          background: T.paper, borderTop: `1px solid ${T.line}`,
          boxShadow: '0 -4px 16px rgba(40,20,10,0.1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {/* Flag picker row */}
          {showBatchFlag && (
            <div style={{ padding: '10px 18px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace' }}>Flag:</span>
              <FlagPicker current={null} onChange={color => { handleBatchFlag(color); setShowBatchFlag(false) }} />
            </div>
          )}
          {/* Confirm delete row */}
          {batchConfirm && (
            <div style={{ padding: '10px 18px 0', fontSize: 12, color: T.crimson, fontWeight: 500 }}>
              Delete {selectedIds.size} note{selectedIds.size !== 1 ? 's' : ''} and all their review history?
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}>
            {/* Select all / count */}
            <button onClick={() => setSelectedIds(allSelected ? new Set() : new Set(filtered.map(c => c.id)))} style={{
              fontSize: 12, fontWeight: 600, color: T.crimson, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, flexShrink: 0,
            }}>
              {allSelected ? 'None' : 'All'}
            </button>
            <span style={{ fontSize: 12, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', flex: 1 }}>
              {selectedIds.size} selected
            </span>
            {!batchConfirm ? (
              <>
                <button onClick={() => { setBatchConfirm(true); setShowBatchFlag(false) }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: T.crimsonBg, border: `1px solid #EFCAB8`, color: T.crimson,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Delete</button>
                <button onClick={() => { handleBatchSuspend() }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Suspend</button>
                <button onClick={() => { setShowBatchFlag(v => !v); setBatchConfirm(false) }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Flag</button>
              </>
            ) : (
              <>
                <button onClick={handleBatchDelete} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: T.crimson, border: 'none', color: '#fff', cursor: 'pointer',
                }}>Confirm</button>
                <button onClick={() => setBatchConfirm(false)} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft, cursor: 'pointer',
                }}>Cancel</button>
              </>
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
