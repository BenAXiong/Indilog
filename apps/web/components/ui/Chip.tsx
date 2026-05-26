import type { ReactNode } from 'react'
import { T } from '@/lib/tokens'
import Icon from './Icon'

type Tone = 'default' | 'crimson' | 'sage' | 'amber' | 'terra' | 'ghost' | 'ink'
type Size = 'sm' | 'md' | 'lg'

type ChipProps = {
  children: ReactNode
  tone?: Tone
  size?: Size
  icon?: Parameters<typeof Icon>[0]['name']
  onClick?: () => void
  active?: boolean
}

const TONES: Record<Tone, { bg: string; color: string; border: string }> = {
  default: { bg: T.paperHi,    color: T.ink,       border: T.line },
  crimson: { bg: T.crimsonBg,  color: T.crimsonDp, border: '#EFCAB8' },
  sage:    { bg: T.sageBg,     color: T.sageDp,    border: '#D2D8AE' },
  amber:   { bg: T.amberBg,    color: '#8C6515',   border: '#EBD49A' },
  terra:   { bg: T.terraBg,    color: '#8E4516',   border: '#EFCAA8' },
  ghost:   { bg: 'transparent',color: T.inkSoft,   border: T.line },
  ink:     { bg: T.ink,        color: T.cream,     border: T.ink },
}

const SIZES = {
  sm: { padding: '3px 9px',   fontSize: 12, height: 22, gap: 4, radius: 999 },
  md: { padding: '5px 11px',  fontSize: 13, height: 28, gap: 5, radius: 999 },
  lg: { padding: '7px 14px',  fontSize: 14, height: 34, gap: 6, radius: 999 },
}

export default function Chip({ children, tone = 'default', size = 'md', icon, onClick, active }: ChipProps) {
  const tn = TONES[tone]
  const sz = SIZES[size]

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sz.gap,
        padding: sz.padding,
        height: sz.height,
        borderRadius: sz.radius,
        background: active ? T.ink : tn.bg,
        color: active ? T.cream : tn.color,
        border: `1px solid ${active ? T.ink : tn.border}`,
        fontFamily: 'inherit',
        fontSize: sz.fontSize,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1,
        whiteSpace: 'nowrap' as const,
        transition: 'all .15s',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {icon && <Icon name={icon} size={sz.fontSize + 2} color="currentColor" strokeWidth={1.8} />}
      {children}
    </button>
  )
}
