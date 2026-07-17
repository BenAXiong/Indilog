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
