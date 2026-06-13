import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'

export function LearnEnd({ learnedCount, tomorrowTarget, onDone }: {
  learnedCount:   number
  tomorrowTarget: number
  onDone:         () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: T.cream, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 88, fontWeight: 600, color: T.ink, letterSpacing: '-0.04em', lineHeight: 0.9 }}>
          {learnedCount}
        </div>
        <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 8, fontWeight: 500 }}>
          {learnedCount === 1 ? 'card learned' : 'cards learned'}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.inkMute, lineHeight: 1.6, maxWidth: 260 }}>
          {learnedCount > 0
            ? 'These will appear in your review queue soon.'
            : 'Exit whenever you\'re ready.'}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: T.inkMute }}>
          Estimated for tomorrow: {tomorrowTarget} new cards.
        </div>
      </div>
      <div style={{ padding: '0 16px 40px' }}>
        <button onClick={onDone} style={{
          width: '100%', height: 52, borderRadius: 14, background: T.sage, color: '#fff',
          border: `1px solid ${T.sage}`, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 12px rgba(80,120,30,0.2)',
        }}>Done</button>
      </div>
    </div>
  )
}
