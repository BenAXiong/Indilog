'use client'

import type { ReactNode, CSSProperties, MouseEventHandler } from 'react'
import { T } from '@/lib/tokens'
import Icon from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'sage' | 'amber' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type ButtonProps = {
  children?: ReactNode
  variant?: Variant
  size?: Size
  icon?: Parameters<typeof Icon>[0]['name']
  iconR?: Parameters<typeof Icon>[0]['name']
  onClick?: MouseEventHandler<HTMLButtonElement>
  full?: boolean
  disabled?: boolean
  style?: CSSProperties
  type?: 'button' | 'submit' | 'reset'
  className?: string
  'aria-label'?: string
}

const VARIANTS: Record<Variant, { bg: string; color: string; border: string; shadow: string }> = {
  primary:   { bg: T.crimson,      color: '#fff',     border: T.crimson,   shadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(120,30,15,0.2), 0 6px 14px rgba(120,30,15,0.18)' },
  secondary: { bg: T.paperHi,      color: T.ink,      border: T.line,      shadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(80,40,20,0.04)' },
  ghost:     { bg: 'transparent',  color: T.inkSoft,  border: 'transparent', shadow: 'none' },
  sage:      { bg: T.sage,         color: '#fff',     border: T.sage,      shadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(60,80,30,0.2), 0 6px 14px rgba(60,80,30,0.18)' },
  amber:     { bg: T.amber,        color: '#3a2e0e',  border: T.amber,     shadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 1px 2px rgba(140,100,20,0.2), 0 6px 14px rgba(140,100,20,0.15)' },
  danger:    { bg: T.crimson,      color: '#fff',     border: T.crimson,   shadow: 'none' },
}

const SIZES = {
  sm: { h: 32, px: 12, fz: 13, gap: 6, r: 10, isz: 15 },
  md: { h: 42, px: 16, fz: 14, gap: 8, r: 12, isz: 17 },
  lg: { h: 52, px: 20, fz: 16, gap: 10, r: 14, isz: 19 },
}

export default function Button({
  children, variant = 'primary', size = 'md', icon, iconR,
  onClick, full, disabled, style, type = 'button', className, 'aria-label': ariaLabel,
}: ButtonProps) {
  const v = VARIANTS[variant]
  const s = SIZES[size]

  return (
    <button
      type={type}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: s.r,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        fontFamily: 'inherit',
        fontSize: s.fz,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        boxShadow: disabled ? 'none' : v.shadow,
        width: full ? '100%' : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s, transform .08s',
        ...style,
      }}
      onMouseDown={e => !disabled && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)')}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      {icon && <Icon name={icon} size={s.isz} strokeWidth={2} />}
      {children}
      {iconR && <Icon name={iconR} size={s.isz} strokeWidth={2} />}
    </button>
  )
}
