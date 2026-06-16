'use client'

import { T } from '@/lib/tokens'

export type ZhMode = 'blurred' | 'hidden' | 'visible'

type Props = {
  zhMode: ZhMode
  lookupOn: boolean
  onZhMode: (m: ZhMode) => void
  onLookup: (on: boolean) => void
  onClose: () => void
}

export default function SettingsPanel({ zhMode, lookupOn, onZhMode, onLookup, onClose }: Props) {
  return (
    <>
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 4,
        background: T.paperHi, border: `1px solid ${T.line}`,
        borderRadius: 14, padding: '14px 16px', zIndex: 50,
        minWidth: 200, boxShadow: '0 8px 24px rgba(40,20,10,0.14)',
      }}>
        <div style={sectionLabel}>CHINESE</div>
        {(['blurred', 'hidden', 'visible'] as ZhMode[]).map(m => (
          <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', cursor: 'pointer' }}>
            <input
              type="radio" name="zhMode" checked={zhMode === m}
              onChange={() => onZhMode(m)}
              style={{ accentColor: T.crimson }}
            />
            <span style={{ fontSize: 13.5, color: T.ink }}>
              {m === 'blurred' ? 'Blurred (default)' : m === 'hidden' ? 'Hidden' : 'Always visible'}
            </span>
          </label>
        ))}

        <div style={{ height: 1, background: T.lineSoft, margin: '12px 0' }} />

        <div style={sectionLabel}>LOOKUP</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} onClick={() => onLookup(v)} style={{
              flex: 1, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              background: lookupOn === v ? T.ink : T.paper,
              color: lookupOn === v ? T.cream : T.inkSoft,
              border: `1px solid ${lookupOn === v ? T.ink : T.line}`,
            }}>
              {v ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
  color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
}
