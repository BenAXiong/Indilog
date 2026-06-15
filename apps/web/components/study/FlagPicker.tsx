import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { FLAG_COLORS, flagColorHex } from '@/lib/db/srs/flags'

export function FlagPicker({
  currentFlag,
  showPicker,
  onToggle,
  onSelect,
  side = 'right',
  expandDir = 'column',
}: {
  currentFlag: string | null
  showPicker: boolean
  onToggle: () => void
  onSelect: (color: string | null) => void
  side?: 'left' | 'right'
  expandDir?: 'column' | 'row'
}) {
  const currentFlagHex = flagColorHex(currentFlag)
  return (
    <div
      style={{
        position: 'absolute', top: 10,
        ...(side === 'right' ? { right: 12 } : { left: 12 }),
        display: 'flex', flexDirection: expandDir === 'row' ? 'row' : 'column',
        alignItems: expandDir === 'row' ? 'center' : (side === 'right' ? 'flex-end' : 'flex-start'),
        gap: 4,
      }}
      onClick={e => e.stopPropagation()}
    >
      <button onClick={onToggle} aria-label="Set flag" style={{
        width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: currentFlagHex ?? T.inkFaint,
      }}>
        <Icon name={currentFlag ? 'flagF' : 'flag'} size={15} strokeWidth={1.8} />
      </button>
      {showPicker && (
        <div style={{ display: 'flex', flexDirection: expandDir, gap: 5, alignItems: 'center' }}>
          {FLAG_COLORS.map(fc => (
            <button key={fc.key} onClick={() => onSelect(fc.key)} style={{
              width: 22, height: 22, borderRadius: 999, border: 'none',
              background: fc.color, cursor: 'pointer', flexShrink: 0,
              boxShadow: currentFlag === fc.key ? `0 0 0 2px #fff, 0 0 0 3.5px ${fc.color}` : 'none',
            }} />
          ))}
          <button onClick={() => onSelect(null)} style={{
            width: 22, height: 22, borderRadius: 999,
            border: `1.5px solid ${T.lineSoft}`, background: T.paper,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: T.inkMute, flexShrink: 0,
          }}>×</button>
        </div>
      )}
    </div>
  )
}
