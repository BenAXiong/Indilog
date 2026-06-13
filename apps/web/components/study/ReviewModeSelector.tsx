import { T } from '@/lib/tokens'

const MODES = ['forward', 'reverse', 'audio', 'sts'] as const

export function ReviewModeSelector({
  value,
  onChange,
}: {
  value:    string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ fontSize: 14, color: T.ink, fontWeight: 500, marginBottom: 8 }}>Review mode</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {MODES.map(m => (
          <button key={m} onClick={() => onChange(m)} style={{
            padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.04em',
            background: value === m ? T.crimsonBg : T.paper,
            border: `1.5px solid ${value === m ? T.crimson : T.lineSoft}`,
            color: value === m ? T.crimson : T.inkMute,
          }}>{m}</button>
        ))}
      </div>
    </div>
  )
}
