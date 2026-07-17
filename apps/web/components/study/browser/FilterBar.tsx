'use client'

import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { getLanguage } from '@/lib/languages'
import { DIALECT_TO_EN } from '@/lib/lang/dialects'
import type { BrowserFilter, BrowserSort } from '@/lib/db/srs/browser'
import { ChipPicker, MultiChipPicker, FlagPicker } from './pickers'

export type DeckSortMode = 'alpha' | 'count' | 'recent'

const SRS_FILTERS: { value: BrowserFilter; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'due',       label: 'Due'       },
  { value: 'new',       label: 'New'       },
  { value: 'flagged',   label: 'Flagged'   },
  { value: 'suspended', label: 'Suspended' },
]

const SORT_OPTIONS: { value: BrowserSort; label: string }[] = [
  { value: 'due',   label: 'Due' },
  { value: 'ease',  label: 'Ease'     },
  { value: 'added', label: 'Added'    },
]

const DECK_SORT_OPTIONS: { value: DeckSortMode; label: string }[] = [
  { value: 'alpha',  label: 'Alpha'  },
  { value: 'count',  label: 'Count'  },
  { value: 'recent', label: 'Recent' },
]

const dropStyle: React.CSSProperties = {
  height: 30, padding: '0 26px 0 10px', borderRadius: 8, fontSize: 12,
  background: T.paperHi, border: `1px solid ${T.line}`, color: T.inkSoft,
  fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
  maxWidth: 160,
}

function Dropdown({ value, onChange, children, style }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', flexShrink: 0, ...style }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...dropStyle, ...style }}>
        {children}
      </select>
      <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.inkMute }}>
        <Icon name="chev-d" size={11} strokeWidth={2} />
      </div>
    </div>
  )
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: T.inkFaint,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  fontFamily: '"JetBrains Mono", monospace',
}

export type FilterBarProps = {
  search: string
  onSearchChange: (v: string) => void
  selectionMode: boolean
  onToggleSelection: () => void

  fSource: string
  onFSourceChange: (v: string) => void
  availSources: string[]
  deckSortMode: DeckSortMode
  onDeckSortModeChange: (m: DeckSortMode) => void

  filtersOpen: boolean
  onToggleFiltersOpen: () => void

  fLanguages: string[]
  onFLanguagesChange: (v: string[]) => void
  availLanguages: string[]

  fDialect: string
  onFDialectChange: (v: string) => void
  availDialects: string[]

  sort: BrowserSort
  onSortChange: (v: BrowserSort) => void

  filter: BrowserFilter
  onFilterChange: (v: BrowserFilter) => void
  flagColorFilter: string | null
  onFlagColorFilterChange: (v: string | null) => void

  fromDate: string
  onFromDateChange: (v: string) => void
  toDate: string
  onToDateChange: (v: string) => void

  fType: string
  onFTypeChange: (v: string) => void
  availTypes: string[]
}

export function FilterBar(props: FilterBarProps) {
  const {
    search, onSearchChange, selectionMode, onToggleSelection,
    fSource, onFSourceChange, availSources, deckSortMode, onDeckSortModeChange,
    filtersOpen, onToggleFiltersOpen,
    fLanguages, onFLanguagesChange, availLanguages,
    fDialect, onFDialectChange, availDialects,
    sort, onSortChange,
    filter, onFilterChange, flagColorFilter, onFlagColorFilterChange,
    fromDate, onFromDateChange, toDate, onToDateChange,
    fType, onFTypeChange, availTypes,
  } = props

  const languageOptions = availLanguages.map(l => ({ value: l, label: getLanguage(l)?.name ?? l }))
  const dialectOptions   = availDialects.map(d => ({ value: d, label: DIALECT_TO_EN[d] ?? d }))

  const activeChips: { key: string; label: string; onClear: () => void }[] = []
  if (fLanguages.length > 0) {
    activeChips.push({
      key: 'lang',
      label: fLanguages.length === 1 ? (getLanguage(fLanguages[0])?.name ?? fLanguages[0]) : `${fLanguages.length} languages`,
      onClear: () => onFLanguagesChange([]),
    })
  }
  if (fDialect) {
    activeChips.push({ key: 'dialect', label: DIALECT_TO_EN[fDialect] ?? fDialect, onClear: () => onFDialectChange('') })
  }
  if (filter !== 'all') {
    activeChips.push({
      key: 'srs',
      label: SRS_FILTERS.find(f => f.value === filter)?.label ?? filter,
      onClear: () => onFilterChange('all'),
    })
  }
  if (fromDate || toDate) {
    activeChips.push({ key: 'date', label: 'Date range', onClear: () => { onFromDateChange(''); onToDateChange('') } })
  }
  if (fType) {
    activeChips.push({ key: 'type', label: fType, onClear: () => onFTypeChange('') })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Search + Select */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Icon name="search" size={15} color={T.inkMute} />
          </div>
          <input
            placeholder="Search cards…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              borderRadius: 10, background: T.paperHi, border: `1px solid ${T.line}`,
              fontSize: 14, color: T.ink, fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>
        <button onClick={onToggleSelection} style={{
          height: 40, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: selectionMode ? T.ink : T.paperHi,
          border: `1px solid ${selectionMode ? T.ink : T.line}`,
          color: selectionMode ? T.cream : T.inkSoft,
          cursor: 'pointer', flexShrink: 0,
        }}>
          {selectionMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Source/deck — always visible, promoted, with a companion sort-mode row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Dropdown value={fSource} onChange={onFSourceChange} style={{ maxWidth: '100%', width: '100%' }}>
          <option value="">All sources</option>
          {availSources.map(s => <option key={s} value={s}>{s}</option>)}
        </Dropdown>
        <ChipPicker
          options={DECK_SORT_OPTIONS}
          current={deckSortMode}
          onChange={v => onDeckSortModeChange((v ?? 'alpha') as DeckSortMode)}
        />
      </div>

      {/* Filters toggle */}
      <button
        onClick={onToggleFiltersOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '0 2px',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={sectionLabelStyle}>Filters</span>
        <Icon name="chev-d" size={13} color={T.inkFaint} strokeWidth={2}
          style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {filtersOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 0 4px' }}>
          {/* Language pills */}
          {availLanguages.length > 1 && (
            <MultiChipPicker options={languageOptions} selected={fLanguages} onChange={onFLanguagesChange} />
          )}

          {/* Dialect pills — only when exactly one language is selected */}
          {fLanguages.length === 1 && availDialects.length > 1 && (
            <ChipPicker options={dialectOptions} current={fDialect || null} onChange={v => onFDialectChange(v ?? '')} />
          )}

          {/* List sort pills */}
          <ChipPicker options={SORT_OPTIONS} current={sort} onChange={v => onSortChange((v ?? 'due') as BrowserSort)} />

          {/* SRS state + flag color sub-filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Dropdown value={filter} onChange={v => onFilterChange(v as BrowserFilter)}>
              {SRS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Dropdown>
            {filter === 'flagged' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace' }}>Color:</span>
                <FlagPicker current={flagColorFilter} onChange={onFlagColorFilterChange} />
              </div>
            )}
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>Added</span>
            <input type="date" value={fromDate} onChange={e => onFromDateChange(e.target.value)} style={{
              flex: 1, height: 28, padding: '0 8px', borderRadius: 7, fontSize: 12,
              background: fromDate ? T.paperHi : T.paper,
              border: `1px solid ${fromDate ? T.line : T.lineSoft}`,
              color: fromDate ? T.ink : T.inkFaint, fontFamily: 'inherit', cursor: 'pointer',
            }} />
            <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>→</span>
            <input type="date" value={toDate} onChange={e => onToDateChange(e.target.value)} style={{
              flex: 1, height: 28, padding: '0 8px', borderRadius: 7, fontSize: 12,
              background: toDate ? T.paperHi : T.paper,
              border: `1px solid ${toDate ? T.line : T.lineSoft}`,
              color: toDate ? T.ink : T.inkFaint, fontFamily: 'inherit', cursor: 'pointer',
            }} />
            {(fromDate || toDate) && (
              <button onClick={() => { onFromDateChange(''); onToDateChange('') }} style={{
                height: 28, padding: '0 8px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                background: 'none', border: `1px solid ${T.lineSoft}`, color: T.inkFaint, flexShrink: 0,
              }}>✕</button>
            )}
          </div>

          {/* Note type — lowest priority, the word/sentence/note distinction is
              already slated for removal per DEC-D02 */}
          {availTypes.length > 1 && (
            <Dropdown value={fType} onChange={onFTypeChange}>
              <option value="">All types</option>
              {availTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </Dropdown>
          )}
        </div>
      ) : (
        activeChips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {activeChips.map(c => (
              <button key={c.key} onClick={c.onClear} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px 3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
                background: T.crimsonBg, color: T.crimson, border: `1px solid #EFCAB8`, cursor: 'pointer',
              }}>
                {c.label}
                <span style={{ fontSize: 12, fontWeight: 700 }}>×</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
