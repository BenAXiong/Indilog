'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import {
  listBrowserCards, updateNoteContent, resetCardEase,
  suspendCard, unsuspendCard, setFlagColor,
  type BrowserCard, type BrowserFilter, type BrowserSort,
} from '@/lib/db/srs/browser'
import { formatDays } from '@/lib/db/srs/schedule'
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
  card:     BrowserCard
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<BrowserCard>) => void
  onRemove: () => void
}

function CardRow({ card, expanded, onToggle, onUpdate, onRemove }: CardRowProps) {
  const [editFront, setEditFront] = useState(card.ab)
  const [editBack,  setEditBack]  = useState(card.zh ?? '')
  const [saving,    setSaving]    = useState(false)
  const [busy,      setBusy]      = useState(false)

  useEffect(() => {
    if (expanded) { setEditFront(card.ab); setEditBack(card.zh ?? '') }
  }, [expanded, card.ab, card.zh])

  const now         = new Date().toISOString()
  const isDue       = !card.due_at || card.due_at <= now
  const isNew       = card.repetitions === 0
  const isSuspended = !!card.suspended_at
  const isSTS       = card.card_type === 'sts'
  const flagHex     = flagColorHex(card.flag_color)

  async function handleSave() {
    const f = editFront.trim(), b = editBack.trim()
    if (!f) return
    setSaving(true)
    await updateNoteContent(card.note_id, f, b)
    onUpdate({ ab: f, zh: b })
    setSaving(false)
  }

  async function handleResetEase() {
    setBusy(true)
    await resetCardEase(card.id)
    onUpdate({ ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null })
    setBusy(false)
  }

  async function handleSuspendToggle() {
    setBusy(true)
    if (isSuspended) {
      await unsuspendCard(card.id)
      onUpdate({ suspended_at: null })
    } else {
      await suspendCard(card.id)
      onRemove()
    }
    setBusy(false)
  }

  async function handleFlagChange(color: string | null) {
    await setFlagColor(card.id, color)
    onUpdate({ flag_color: color })
  }

  return (
    <div style={{
      background: isSuspended ? T.paper : T.paperHi,
      border: `1px solid ${flagHex ? flagHex + '55' : isSuspended ? T.line : T.lineSoft}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
      opacity: isSuspended ? 0.72 : 1,
    }}>
      {/* Collapsed row */}
      <button onClick={onToggle} style={{
        width: '100%', padding: '11px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 9,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {/* Status badge */}
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          {isSuspended ? (
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
            {isSTS && (
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
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${T.lineSoft}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Front</label>
              <textarea value={editFront} onChange={e => setEditFront(e.target.value)} rows={2} style={textareaStyle('serif')} />
            </div>
            <div>
              <label style={labelStyle}>Back</label>
              <textarea value={editBack} onChange={e => setEditBack(e.target.value)} rows={2} style={textareaStyle('sans')} />
            </div>

            {/* Save / cancel */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSave} disabled={saving} style={actionBtn(T.crimson, saving)}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={onToggle} style={ghostBtn}>Cancel</button>
            </div>

            {/* Flag row */}
            <div>
              <label style={labelStyle}>Flag</label>
              <FlagPicker current={card.flag_color} onChange={handleFlagChange} />
            </div>

            {/* Suspend + ease reset */}
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

  useEffect(() => {
    if (filter !== 'flagged') setFlagColorFilter(null)
  }, [filter])

  useEffect(() => {
    setLoading(true)
    setExpandedId(null)
    listBrowserCards(filter, sort, filter === 'flagged' ? flagColorFilter : undefined)
      .then(c => { setCards(c); setLoading(false) })
  }, [filter, sort, flagColorFilter])

  const filtered = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(c =>
      c.ab.toLowerCase().includes(q) || (c.zh ?? '').toLowerCase().includes(q)
    )
  }, [cards, search])

  function updateCard(id: string, patch: Partial<BrowserCard>) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function removeCard(id: string) {
    setCards(prev => prev.filter(c => c.id !== id))
    setExpandedId(null)
  }

  return (
    <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Search */}
      <div style={{ position: 'relative' }}>
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

      {/* Filter + sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              height: 30, padding: '0 10px', borderRadius: 8,
              background: filter === f.value ? T.crimson : T.paperHi,
              border: `1px solid ${filter === f.value ? T.crimsonDp : T.line}`,
              color: filter === f.value ? '#fff' : T.inkSoft,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select value={sort} onChange={e => setSort(e.target.value as BrowserSort)} style={{
            height: 30, padding: '0 26px 0 10px', borderRadius: 8,
            background: T.paperHi, border: `1px solid ${T.line}`,
            fontSize: 12, color: T.inkSoft, fontFamily: 'inherit', cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none',
          }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
            <Icon name="chev-d" size={11} strokeWidth={2} />
          </div>
        </div>
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
            />
          ))}
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
