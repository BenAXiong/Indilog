import type { ReactNode, CSSProperties, MouseEventHandler } from 'react'
import { T } from '@/lib/tokens'

type CardProps = {
  children: ReactNode
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLDivElement>
  raised?: boolean
  accent?: string
  pad?: number | string
  className?: string
}

export default function Card({ children, style, onClick, raised = false, accent, pad = 16, className }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: T.paperHi,
        borderRadius: 18,
        padding: pad,
        border: `1px solid ${T.lineSoft}`,
        boxShadow: raised
          ? '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04), 0 4px 18px rgba(80,40,20,0.06)'
          : '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(80,40,20,0.03)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        ...style,
      }}
    >
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 16, right: 16, height: 2,
          background: accent, borderRadius: '0 0 4px 4px', opacity: 0.85,
        }} />
      )}
      {children}
    </div>
  )
}
