'use client'

import { T } from '@/lib/tokens'
import { FLAG_COLORS } from '@/lib/db/srs/flags'

// ─── Flag color picker (reusable inline picker) ───────────────────────────────

export function FlagPicker({ current, onChange }: { current: string | null; onChange: (c: string | null) => void }) {
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

// ─── Text/label chip picker (reusable — dialect, source, single-select) ───────

export function ChipPicker({ options, current, onChange }: {
  options: { value: string; label: string }[]
  current: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(current === o.value ? null : o.value)} style={{
          padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
          background: current === o.value ? T.crimson : T.paperHi,
          color: current === o.value ? '#fff' : T.inkSoft,
          border: `1px solid ${current === o.value ? T.crimsonDp : T.line}`,
        }}>{o.label}</button>
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

// ─── Multi-select scrollable chip row (language filter — All/None reset) ──────

export function MultiChipPicker({ options, selected, onChange }: {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const allActive = selected.length === 0
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <button onClick={() => onChange([])} style={{
        padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', flexShrink: 0,
        background: allActive ? T.crimson : T.paperHi,
        color: allActive ? '#fff' : T.inkSoft,
        border: `1px solid ${allActive ? T.crimsonDp : T.line}`,
      }}>All</button>
      {options.map(o => {
        const active = selected.includes(o.value)
        return (
          <button key={o.value} onClick={() => onChange(active ? selected.filter(v => v !== o.value) : [...selected, o.value])} style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', flexShrink: 0,
            background: active ? T.crimson : T.paperHi,
            color: active ? '#fff' : T.inkSoft,
            border: `1px solid ${active ? T.crimsonDp : T.line}`,
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}
