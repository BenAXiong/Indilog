'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import {
  listBrowserCards, sortBrowserCards,
  batchDeleteNotes, batchSuspendCards, batchSetFlag, batchSetDialect, batchSetSourceId,
  type BrowserCard, type BrowserFilter, type BrowserSort,
} from '@/lib/db/srs/browser'
import { listSources } from '@/lib/db/sources/sources'
import { getLanguage } from '@/lib/languages'
import { DIALECT_TO_EN } from '@/lib/lang/dialects'
import { flagColorHex } from '@/lib/db/srs/flags'
import { CardRow } from './CardRow'
import { FlagPicker, ChipPicker } from './pickers'

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

// ─── Browser ──────────────────────────────────────────────────────────────────

export default function BrowserView({ videoOnly }: { videoOnly?: boolean } = {}) {
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
  const [fLanguage,      setFLanguage]      = useState('')
  const [fDialect,       setFDialect]       = useState('')
  const [fromDate,       setFromDate]       = useState('')
  const [toDate,         setToDate]         = useState('')
  const [selectionMode,  setSelectionMode]  = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [batchConfirm,   setBatchConfirm]   = useState(false)
  const [showBatchFlag,    setShowBatchFlag]    = useState(false)
  const [showBatchDialect, setShowBatchDialect] = useState(false)
  const [showBatchSource,  setShowBatchSource]  = useState(false)
  // Identity, not position — tracking a raw index into `filtered` let the
  // sheet desync (wrong card / stale audio) whenever filters changed or a
  // card was removed while the preview was open. `previewIndex` below is
  // derived from this id every render instead of being the source of truth.
  const [previewId,           setPreviewId]           = useState<string | null>(null)
  const [previewRevealed,     setPreviewRevealed]     = useState(false)
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => () => { previewAudioRef.current?.pause() }, [])

  useEffect(() => {
    if (filter !== 'flagged') setFlagColorFilter(null)
  }, [filter])

  useEffect(() => {
    setLoading(true)
    setExpandedId(null)
    // Fetch always in 'added' (DB/created_at) order — 'due'/'ease' sort is
    // applied client-side below via sortBrowserCards so switching Sort
    // doesn't re-run the paginated query against ind_items.
    listBrowserCards(filter, 'added', filter === 'flagged' ? flagColorFilter : undefined, videoOnly)
      .then(c => { setCards(c); setLoading(false) })
  }, [filter, flagColorFilter, videoOnly])

  useEffect(() => {
    listSources().then(ss => {
      setSourceNames(new Map(ss.map(s => [s.id, s.name])))
    })
  }, [])

  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current = null
      setPreviewAudioPlaying(false)
    }
    setPreviewRevealed(false)
    if (!previewId) return
    const pc = filtered.find(c => c.id === previewId)
    if (!pc?.audio) return
    const a = new Audio(pc.audio)
    a.onended = () => setPreviewAudioPlaying(false)
    a.play().catch(() => {})
    previewAudioRef.current = a
    setPreviewAudioPlaying(true)
  }, [previewId]) // eslint-disable-line react-hooks/exhaustive-deps

  const dropStyle: React.CSSProperties = {
    height: 30, padding: '0 26px 0 10px', borderRadius: 8, fontSize: 12,
    background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
    fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
    maxWidth: 160,
  }
  const narrowDropStyle: React.CSSProperties = {
    ...dropStyle, padding: '0 22px 0 8px', maxWidth: 108,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }
  const availTypes     = useMemo(() => [...new Set(cards.map(c => c.note_type).filter(Boolean))].sort(), [cards])
  const availSources   = useMemo(() => [...new Set(cards.map(c => c.source).filter(Boolean))].sort(), [cards])
  // Some legacy dict saves wrote the dialect name into the language column (fixed at the
  // source in dict/page.tsx) — guard against that stale data leaking dialect names in here.
  const availLanguages = useMemo(() => [...new Set(
    cards.map(c => c.language).filter(l => l && getLanguage(l))
  )].sort(), [cards])
  // grmpts/Patterns saves write a generic language-level name (e.g. "阿美語") into dialect
  // when the true source sub-dialect isn't documented yet (GRMPTS_SOURCE_DIALECT) — filter
  // to our real dialect list so that placeholder doesn't show up as a selectable dialect.
  const availDialects  = useMemo(() => [...new Set(
    cards.filter(c => !fLanguage || c.language === fLanguage)
      .map(c => c.dialect).filter((d): d is string => !!d && d in DIALECT_TO_EN)
  )].sort(), [cards, fLanguage])

  // Dialects are scoped to a language — drop a stale selection when it switches
  useEffect(() => {
    if (fDialect && !availDialects.includes(fDialect)) setFDialect('')
  }, [availDialects]) // eslint-disable-line react-hooks/exhaustive-deps

  // Options for the batch-edit pickers below (dialect reuses the filter's
  // language-scoped list; source is the ind_sources reference — a different
  // concept from `card.source` above, which is the deck/collection label)
  const batchDialectOptions = useMemo(
    () => availDialects.map(d => ({ value: d, label: DIALECT_TO_EN[d] ?? d })),
    [availDialects]
  )
  const batchSourceOptions = useMemo(
    () => [...sourceNames].map(([id, name]) => ({ value: id, label: name })),
    [sourceNames]
  )

  const filtered = useMemo(() => {
    let result = sortBrowserCards(cards, sort)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c => c.ab.toLowerCase().includes(q) || (c.zh ?? '').toLowerCase().includes(q))
    }
    if (fType)     result = result.filter(c => c.note_type === fType)
    if (fSource)   result = result.filter(c => c.source === fSource)
    if (fLanguage) result = result.filter(c => c.language === fLanguage)
    if (fDialect)  result = result.filter(c => c.dialect === fDialect)
    // fromDate/toDate are local calendar dates from <input type="date">; created_at is a
    // UTC timestamptz — parse the boundaries as local time (no zone suffix) so the compare
    // against the UTC string lines up with the user's actual local day, not UTC's.
    if (fromDate) {
      const fromISO = new Date(`${fromDate}T00:00:00`).toISOString()
      result = result.filter(c => c.created_at >= fromISO)
    }
    if (toDate) {
      const toISO = new Date(`${toDate}T23:59:59.999`).toISOString()
      result = result.filter(c => c.created_at <= toISO)
    }
    return result
  }, [cards, sort, search, fType, fSource, fLanguage, fDialect, fromDate, toDate])

  // -1 (not found) covers both "closed" and "the previewed card fell out of
  // `filtered`" (deleted, suspended, or filtered out by a search/filter change)
  const previewIndex = useMemo(
    () => previewId ? filtered.findIndex(c => c.id === previewId) : -1,
    [previewId, filtered]
  )

  useEffect(() => {
    if (previewId && previewIndex === -1) setPreviewId(null)
  }, [previewId, previewIndex])

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
    setShowBatchDialect(false); setShowBatchSource(false)
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

  async function handleBatchDialect(dialect: string | null) {
    const ids = [...selectedIds]
    await batchSetDialect(ids, dialect)
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, dialect } : c))
    exitSelectionMode()
  }

  async function handleBatchSource(sourceId: string | null) {
    const ids = [...selectedIds]
    await batchSetSourceId(ids, sourceId)
    setCards(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, source_id: sourceId } : c))
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

      {/* Filter row 1: language | dialect | deck */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Language dropdown */}
        {availLanguages.length > 1 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <select value={fLanguage} onChange={e => setFLanguage(e.target.value)} style={narrowDropStyle}>
              <option value="">All langs</option>
              {availLanguages.map(l => <option key={l} value={l}>{getLanguage(l)?.name ?? l}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
              <Icon name="chev-d" size={11} strokeWidth={2} />
            </div>
          </div>
        )}

        {/* Dialect dropdown */}
        {availDialects.length > 1 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <select value={fDialect} onChange={e => setFDialect(e.target.value)} style={narrowDropStyle}>
              <option value="">All dialects</option>
              {availDialects.map(d => <option key={d} value={d}>{DIALECT_TO_EN[d] ?? d}</option>)}
            </select>
            <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
              <Icon name="chev-d" size={11} strokeWidth={2} />
            </div>
          </div>
        )}

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
      </div>

      {/* Filter row 2: SRS state | type | sort */}
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
              isPreviewOpen={previewId === card.id}
              onOpenPreview={() => setPreviewId(card.id)}
            />
          ))}
        </div>
      )}

      {/* Preview bottom sheet */}
      {previewIndex !== -1 && (() => {
        const pc = filtered[previewIndex]
        if (!pc) return null
        const hasPrev = previewIndex > 0
        const hasNext = previewIndex < filtered.length - 1
        const navBtn = (enabled: boolean): React.CSSProperties => ({
          width: 44, height: 44, borderRadius: 999, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: enabled ? T.paperHi : 'transparent',
          cursor: enabled ? 'pointer' : 'default',
          opacity: enabled ? 1 : 0.2, flexShrink: 0,
        })
        return (
          <>
            <div
              onClick={() => { setPreviewId(null) }}
              style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,20,10,0.45)' }}
            />
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
              background: T.paper, borderRadius: '20px 20px 0 0',
              boxShadow: '0 -4px 32px rgba(30,20,10,0.18)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}>
              {/* Handle + nav */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 4px', gap: 8 }}>
                <button
                  disabled={!hasPrev}
                  onClick={() => setPreviewId(filtered[previewIndex - 1].id)}
                  style={navBtn(hasPrev)}
                >
                  <Icon name="arrow-l" size={18} strokeWidth={1.8} color={T.inkSoft} />
                </button>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line }} />
                </div>
                <button
                  disabled={!hasNext}
                  onClick={() => setPreviewId(filtered[previewIndex + 1].id)}
                  style={navBtn(hasNext)}
                >
                  <Icon name="arrow-r" size={18} strokeWidth={1.8} color={T.inkSoft} />
                </button>
              </div>

              {/* Front */}
              <div style={{ padding: '16px 24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {pc.ab}
                </div>
                {pc.audio && !pc.video_clip && (
                  <button onClick={() => {
                    const a = previewAudioRef.current
                    if (!a) return
                    if (previewAudioPlaying) { a.pause(); a.currentTime = 0; setPreviewAudioPlaying(false) }
                    else { a.play().catch(() => {}); setPreviewAudioPlaying(true) }
                  }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, borderRadius: 999,
                    background: T.crimson, border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(180,40,30,0.2)',
                  }}>
                    <Icon name={previewAudioPlaying ? 'stop' : 'speaker'} size={16} strokeWidth={1.6} color="#fff" />
                  </button>
                )}
                {pc.video_clip && (
                  <video
                    key={pc.id}
                    ref={previewVideoRef}
                    src={pc.video_clip}
                    autoPlay
                    muted
                    playsInline
                    onClick={() => {
                      const v = previewVideoRef.current
                      const a = previewAudioRef.current
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
                {previewRevealed ? (
                  <div style={{ padding: '18px 24px 26px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 500, color: T.ink, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                      {pc.zh || <span style={{ color: T.inkFaint, fontStyle: 'italic' }}>No back</span>}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setPreviewRevealed(true)} style={{
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
            </div>
          </>
        )
      })()}

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
          {/* Dialect picker row */}
          {showBatchDialect && (
            <div style={{ padding: '10px 18px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace' }}>Dialect:</span>
              {batchDialectOptions.length === 0
                ? <span style={{ fontSize: 12, color: T.inkFaint }}>No dialects to pick from in this view</span>
                : <ChipPicker options={batchDialectOptions} current={null} onChange={d => { handleBatchDialect(d); setShowBatchDialect(false) }} />
              }
            </div>
          )}
          {/* Source picker row */}
          {showBatchSource && (
            <div style={{ padding: '10px 18px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace' }}>Source:</span>
              {batchSourceOptions.length === 0
                ? <span style={{ fontSize: 12, color: T.inkFaint }}>No sources yet — add one from the Sources page first</span>
                : <ChipPicker options={batchSourceOptions} current={null} onChange={id => { handleBatchSource(id); setShowBatchSource(false) }} />
              }
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
            <span style={{ fontSize: 12, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
              {selectedIds.size} selected
            </span>
            {/* Action buttons scroll horizontally rather than squeezing/wrapping
                as more batch actions get added (dialect/source alongside delete/
                suspend/flag) */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, justifyContent: 'flex-end' }}>
            {!batchConfirm ? (
              <>
                <button onClick={() => { setBatchConfirm(true); setShowBatchFlag(false); setShowBatchDialect(false); setShowBatchSource(false) }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, flexShrink: 0,
                  background: T.crimsonBg, border: `1px solid #EFCAB8`, color: T.crimson,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Delete</button>
                <button onClick={() => { handleBatchSuspend() }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, flexShrink: 0,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Suspend</button>
                <button onClick={() => { setShowBatchFlag(v => !v); setShowBatchDialect(false); setShowBatchSource(false); setBatchConfirm(false) }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, flexShrink: 0,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Flag</button>
                <button onClick={() => { setShowBatchDialect(v => !v); setShowBatchFlag(false); setShowBatchSource(false); setBatchConfirm(false) }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, flexShrink: 0,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Dialect</button>
                <button onClick={() => { setShowBatchSource(v => !v); setShowBatchFlag(false); setShowBatchDialect(false); setBatchConfirm(false) }} disabled={selectedIds.size === 0} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, flexShrink: 0,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer', opacity: selectedIds.size === 0 ? 0.4 : 1,
                }}>Source</button>
              </>
            ) : (
              <>
                <button onClick={handleBatchDelete} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, flexShrink: 0,
                  background: T.crimson, border: 'none', color: '#fff', cursor: 'pointer',
                }}>Confirm</button>
                <button onClick={() => setBatchConfirm(false)} style={{
                  height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, flexShrink: 0,
                  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft, cursor: 'pointer',
                }}>Cancel</button>
              </>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
