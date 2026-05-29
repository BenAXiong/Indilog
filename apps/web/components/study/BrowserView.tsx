'use client'

import { useState, useEffect, useMemo } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import {
  listBrowserCards, updateCardFrontBack, resetCardEase,
  type BrowserCard, type BrowserFilter, type BrowserSort,
} from '@/lib/db/srs/browser'
import { formatDays } from '@/lib/db/srs/schedule'

const FILTERS: { value: BrowserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'new', label: 'New' },
]

const SORT_OPTIONS: { value: BrowserSort; label: string }[] = [
  { value: 'due',   label: 'Due date' },
  { value: 'ease',  label: 'Ease'     },
  { value: 'added', label: 'Added'    },
]

// ─── Card row ─────────────────────────────────────────────────────────────────

type CardRowProps = {
  card: BrowserCard
  expanded: boolean
  onToggle: () => void
  onSave: (front: string, back: string) => void
  onReset: () => void
}

function CardRow({ card, expanded, onToggle, onSave, onReset }: CardRowProps) {
  const [editFront,  setEditFront]  = useState(card.front)
  const [editBack,   setEditBack]   = useState(card.back)
  const [saving,     setSaving]     = useState(false)
  const [resetting,  setResetting]  = useState(false)

  useEffect(() => {
    if (expanded) { setEditFront(card.front); setEditBack(card.back) }
  }, [expanded, card.front, card.back])

  const now    = new Date().toISOString()
  const isDue  = !card.due_at || card.due_at <= now
  const isNew  = card.repetitions === 0

  async function handleSave() {
    const f = editFront.trim()
    const b = editBack.trim()
    if (!f) return
    setSaving(true)
    await updateCardFrontBack(card.id, f, b)
    onSave(f, b)
    setSaving(false)
  }

  async function handleReset() {
    setResetting(true)
    await resetCardEase(card.id)
    onReset()
    setResetting(false)
  }

  return (
    <div style={{
      background: T.paperHi, border: `1px solid ${T.lineSoft}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
    }}>
      {/* Collapsed row */}
      <button onClick={onToggle} style={{
        width: '100%', padding: '11px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 9,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {/* Status badge */}
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          {isNew ? (
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
              color: T.amber, padding: '2px 5px', borderRadius: 4,
              background: T.amberBg, border: `1px solid #EBD49A`,
            }}>NEW</span>
          ) : isDue ? (
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
              color: T.crimson, padding: '2px 5px', borderRadius: 4,
              background: T.crimsonBg, border: `1px solid #EFCAB8`,
            }}>DUE</span>
          ) : (
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
              color: T.inkFaint, padding: '2px 5px', borderRadius: 4,
              background: T.paper, border: `1px solid ${T.lineSoft}`,
            }}>{formatDays(card.interval_days)}</span>
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 500, color: T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{card.front}</div>
          <div style={{
            fontSize: 12.5, color: T.inkMute, marginTop: 1.5,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{card.back}</div>
        </div>

        {/* Meta */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontSize: 11, color: T.inkMute, maxWidth: 72,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{card.source}</div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, marginTop: 2,
          }}>e{card.ease_factor.toFixed(1)}</div>
        </div>
      </button>

      {/* Edit panel */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${T.lineSoft}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Front */}
            <div>
              <label style={labelStyle}>Front</label>
              <textarea
                value={editFront}
                onChange={e => setEditFront(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: T.paper, border: `1px solid ${T.line}`,
                  fontSize: 14, fontFamily: 'Newsreader, Georgia, serif',
                  color: T.ink, resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Back */}
            <div>
              <label style={labelStyle}>Back</label>
              <textarea
                value={editBack}
                onChange={e => setEditBack(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: T.paper, border: `1px solid ${T.line}`,
                  fontSize: 14, fontFamily: 'inherit', color: T.inkSoft,
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSave} disabled={saving} style={{
                  height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
                  background: T.crimson, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={onToggle} style={{
                  height: 34, padding: '0 12px', borderRadius: 8,
                  border: `1px solid ${T.lineSoft}`, background: T.paperHi,
                  color: T.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>Cancel</button>
              </div>
              <button onClick={handleReset} disabled={resetting} style={{
                height: 34, padding: '0 12px', borderRadius: 8,
                border: `1px solid #EFCAB8`, background: T.crimsonBg,
                color: T.crimson, fontSize: 12, fontWeight: 500,
                cursor: resetting ? 'default' : 'pointer', opacity: resetting ? 0.6 : 1,
              }}>
                {resetting ? '…' : 'Reset ease'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Browser ──────────────────────────────────────────────────────────────────

export default function BrowserView() {
  const [filter,     setFilter]     = useState<BrowserFilter>('all')
  const [sort,       setSort]       = useState<BrowserSort>('due')
  const [search,     setSearch]     = useState('')
  const [cards,      setCards]      = useState<BrowserCard[]>([])
  const [loading,    setLoading]    = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setExpandedId(null)
    listBrowserCards(filter, sort).then(c => { setCards(c); setLoading(false) })
  }, [filter, sort])

  const filtered = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(c =>
      c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
    )
  }, [cards, search])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              height: 32, padding: '0 12px', borderRadius: 8,
              background: filter === f.value ? T.crimson : T.paperHi,
              border: `1px solid ${filter === f.value ? T.crimsonDp : T.line}`,
              color: filter === f.value ? '#fff' : T.inkSoft,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <select value={sort} onChange={e => setSort(e.target.value as BrowserSort)} style={{
            height: 32, padding: '0 28px 0 10px', borderRadius: 8,
            background: T.paperHi, border: `1px solid ${T.line}`,
            fontSize: 12, color: T.inkSoft, fontFamily: 'inherit', cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none',
          }}>
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: T.inkMute,
          }}>
            <Icon name="chev-d" size={12} strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Count */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute,
        paddingLeft: 2,
      }}>
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
            {search ? 'No cards match your search.' : 'No cards here yet.'}
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
              onSave={(front, back) => {
                setCards(prev => prev.map(c => c.id === card.id ? { ...c, front, back } : c))
                setExpandedId(null)
              }}
              onReset={() => {
                setCards(prev => prev.map(c =>
                  c.id === card.id
                    ? { ...c, ease_factor: 2.5, interval_days: 0, repetitions: 0, due_at: null }
                    : c
                ))
                setExpandedId(null)
              }}
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
