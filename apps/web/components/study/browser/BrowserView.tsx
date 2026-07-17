'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { CardOverlay, type OverlayMode } from './CardOverlay'
import { FlagPicker, ChipPicker } from './pickers'
import { FilterBar, type DeckSortMode } from './FilterBar'

// ─── Browser ──────────────────────────────────────────────────────────────────

export default function BrowserView({ videoOnly }: { videoOnly?: boolean } = {}) {
  const [filter,          setFilter]          = useState<BrowserFilter>('all')
  const [flagColorFilter, setFlagColorFilter] = useState<string | null>(null)
  const [sort,            setSort]            = useState<BrowserSort>('due')
  const [search,          setSearch]          = useState('')
  const [cards,           setCards]           = useState<BrowserCard[]>([])
  const [loading,         setLoading]         = useState(true)
  const [sourceNames,    setSourceNames]    = useState<Map<string, string>>(new Map())
  const [fType,          setFType]          = useState('')
  const [fSource,        setFSource]        = useState('')
  const [fLanguages,     setFLanguages]     = useState<string[]>([])
  const [fDialect,       setFDialect]       = useState('')
  const [fromDate,       setFromDate]       = useState('')
  const [toDate,         setToDate]         = useState('')
  const [filtersOpen,    setFiltersOpen]    = useState(false)
  const [deckSortMode,   setDeckSortMode]   = useState<DeckSortMode>('alpha')
  const [selectionMode,  setSelectionMode]  = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [batchConfirm,   setBatchConfirm]   = useState(false)
  const [showBatchFlag,    setShowBatchFlag]    = useState(false)
  const [showBatchDialect, setShowBatchDialect] = useState(false)
  const [showBatchSource,  setShowBatchSource]  = useState(false)
  // Identity, not position — tracking a raw index into `filtered` let the
  // overlay desync (wrong card / stale audio) whenever filters changed or a
  // card was removed while it was open. `overlayIndex` below is derived from
  // this id every render instead of being the source of truth.
  const [overlayCardId, setOverlayCardId] = useState<string | null>(null)
  const [overlayMode,   setOverlayMode]   = useState<OverlayMode>('edit')

  useEffect(() => {
    if (filter !== 'flagged') setFlagColorFilter(null)
  }, [filter])

  useEffect(() => {
    setLoading(true)
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

  const availTypes     = useMemo(() => [...new Set(cards.map(c => c.note_type).filter(Boolean))].sort(), [cards])
  // Some legacy dict saves wrote the dialect name into the language column (fixed at the
  // source in dict/page.tsx) — guard against that stale data leaking dialect names in here.
  const availLanguages = useMemo(() => [...new Set(
    cards.map(c => c.language).filter(l => l && getLanguage(l))
  )].sort(), [cards])
  // grmpts/Patterns saves write a generic language-level name (e.g. "阿美語") into dialect
  // when the true source sub-dialect isn't documented yet (GRMPTS_SOURCE_DIALECT) — filter
  // to our real dialect list so that placeholder doesn't show up as a selectable dialect.
  const availDialects  = useMemo(() => [...new Set(
    cards.filter(c => fLanguages.length === 0 || fLanguages.includes(c.language))
      .map(c => c.dialect).filter((d): d is string => !!d && d in DIALECT_TO_EN)
  )].sort(), [cards, fLanguages])

  // Dialects are scoped to a language — drop a stale selection when it switches
  useEffect(() => {
    if (fDialect && !availDialects.includes(fDialect)) setFDialect('')
  }, [availDialects]) // eslint-disable-line react-hooks/exhaustive-deps

  // Source/deck dropdown ordering — Alpha (default) / Count / Recent, per-source
  // stats derived client-side from the already-loaded `cards`, no extra query
  const sourceStats = useMemo(() => {
    const stats = new Map<string, { count: number; recent: string }>()
    for (const c of cards) {
      if (!c.source) continue
      const s = stats.get(c.source) ?? { count: 0, recent: '' }
      s.count++
      if (c.created_at > s.recent) s.recent = c.created_at
      stats.set(c.source, s)
    }
    return stats
  }, [cards])
  const availSources = useMemo(() => {
    const list = [...new Set(cards.map(c => c.source).filter(Boolean))]
    if (deckSortMode === 'count')  return list.sort((a, b) => (sourceStats.get(b)?.count ?? 0) - (sourceStats.get(a)?.count ?? 0))
    if (deckSortMode === 'recent') return list.sort((a, b) => (sourceStats.get(b)?.recent ?? '').localeCompare(sourceStats.get(a)?.recent ?? ''))
    return list.sort()
  }, [cards, deckSortMode, sourceStats])

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
    if (fType)               result = result.filter(c => c.note_type === fType)
    if (fSource)             result = result.filter(c => c.source === fSource)
    if (fLanguages.length)   result = result.filter(c => fLanguages.includes(c.language))
    if (fDialect)            result = result.filter(c => c.dialect === fDialect)
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
  }, [cards, sort, search, fType, fSource, fLanguages, fDialect, fromDate, toDate])

  // -1 (not found) covers both "closed" and "the overlaid card fell out of
  // `filtered`" (deleted, suspended, or filtered out by a search/filter change)
  const overlayIndex = useMemo(
    () => overlayCardId ? filtered.findIndex(c => c.id === overlayCardId) : -1,
    [overlayCardId, filtered]
  )

  useEffect(() => {
    if (overlayCardId && overlayIndex === -1) setOverlayCardId(null)
  }, [overlayCardId, overlayIndex])

  function updateCard(id: string, patch: Partial<BrowserCard>) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function removeCard(id: string) {
    setCards(prev => prev.filter(c => c.id !== id))
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

      <FilterBar
        search={search} onSearchChange={setSearch}
        fSource={fSource} onFSourceChange={setFSource} availSources={availSources}
        deckSortMode={deckSortMode} onDeckSortModeChange={setDeckSortMode}
        filtersOpen={filtersOpen} onToggleFiltersOpen={() => setFiltersOpen(v => !v)}
        fLanguages={fLanguages} onFLanguagesChange={setFLanguages} availLanguages={availLanguages}
        fDialect={fDialect} onFDialectChange={setFDialect} availDialects={availDialects}
        sort={sort} onSortChange={setSort}
        filter={filter} onFilterChange={setFilter}
        flagColorFilter={flagColorFilter} onFlagColorFilterChange={setFlagColorFilter}
        fromDate={fromDate} onFromDateChange={setFromDate} toDate={toDate} onToDateChange={setToDate}
        fType={fType} onFTypeChange={setFType} availTypes={availTypes}
      />

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
              onUpdate={patch => updateCard(card.id, patch)}
              onRemove={() => removeCard(card.id)}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(card.id)}
              onSelect={() => toggleSelect(card.id)}
              onLongPressSelect={() => { setSelectionMode(true); setSelectedIds(new Set([card.id])) }}
              isOverlayOpen={overlayCardId === card.id}
              onOpenOverlay={mode => { setOverlayCardId(card.id); setOverlayMode(mode) }}
            />
          ))}
        </div>
      )}

      {/* Card overlay — converged recall-check / edit surface */}
      {overlayIndex !== -1 && (() => {
        const overlayCard = filtered[overlayIndex]
        return (
          <CardOverlay
            card={overlayCard}
            mode={overlayMode}
            onModeChange={setOverlayMode}
            onClose={() => setOverlayCardId(null)}
            hasPrev={overlayIndex > 0}
            hasNext={overlayIndex < filtered.length - 1}
            onNavigate={dir => setOverlayCardId(filtered[overlayIndex + dir].id)}
            onUpdate={patch => updateCard(overlayCard.id, patch)}
            onRemove={() => removeCard(overlayCard.id)}
            sourceOptions={batchSourceOptions}
          />
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
            {/* Exit selection mode entirely — long-press is now the only entry
                point (no header toggle), so this is the only way back out */}
            <button onClick={exitSelectionMode} style={{
              fontSize: 12, fontWeight: 600, color: T.inkMute, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, flexShrink: 0,
            }}>
              Done
            </button>
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
