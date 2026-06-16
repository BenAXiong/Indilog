'use client'

import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'

type Props = {
  onPrev: () => void
  onNext: () => void
  onToggleComplete: () => void
  completed: boolean
  prevDisabled: boolean
  nextDisabled: boolean
}

export default function ActionBar({
  onPrev, onNext, onToggleComplete, completed, prevDisabled, nextDisabled,
}: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      background: T.cream,
      borderTop: `1px solid ${T.lineSoft}`,
      zIndex: 40,
    }}>
      <button
        onClick={onPrev} disabled={prevDisabled}
        style={navStyle(prevDisabled)}
      >
        <Icon name="arrow-l" size={16} strokeWidth={2} /> Prev
      </button>

      <button onClick={onToggleComplete} style={completeStyle(completed)}>
        {completed
          ? <><Icon name="check" size={15} strokeWidth={2.5} color="#fff" /> Completed</>
          : '✓ Mark complete'}
      </button>

      <button
        onClick={onNext} disabled={nextDisabled}
        style={navStyle(nextDisabled)}
      >
        Next <Icon name="arrow-r" size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

const navStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  height: 40, padding: '0 14px', borderRadius: 10, flexShrink: 0,
  background: T.paperHi, border: `1px solid ${T.line}`,
  fontSize: 13.5, fontWeight: 600, color: T.inkSoft,
  fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.3 : 1,
})

const completeStyle = (completed: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1,
  height: 40, padding: '0 12px', borderRadius: 10,
  background: completed ? T.crimson : T.paperHi,
  border: `1px solid ${completed ? T.crimsonDp : T.line}`,
  fontSize: 13.5, fontWeight: 600,
  color: completed ? '#fff' : T.inkSoft,
  fontFamily: 'inherit', cursor: 'pointer',
  transition: 'all .15s',
})
