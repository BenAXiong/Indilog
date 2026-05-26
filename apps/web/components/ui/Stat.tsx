import { T } from '@/lib/tokens'
import Icon from './Icon'

type StatProps = {
  value: string | number
  label: string
  suffix?: string
  icon?: Parameters<typeof Icon>[0]['name']
  accent?: string
}

export default function Stat({ value, label, suffix, icon, accent }: StatProps) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '12px 14px',
      background: T.paperHi,
      borderRadius: 14,
      border: `1px solid ${T.lineSoft}`,
      position: 'relative',
    }}>
      {icon && (
        <div style={{ position: 'absolute', top: 12, right: 12, color: accent || T.inkFaint }}>
          <Icon name={icon} size={14} strokeWidth={1.8} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 26,
          fontWeight: 500,
          color: T.ink,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          {value}
        </span>
        {suffix && (
          <span style={{
            fontFamily: 'inherit',
            fontSize: 11,
            color: T.inkMute,
            fontWeight: 500,
          }}>
            {suffix}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 500, letterSpacing: '-0.005em' }}>
        {label}
      </div>
    </div>
  )
}
