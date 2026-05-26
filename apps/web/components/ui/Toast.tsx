import type { ReactNode } from 'react'
import { T } from '@/lib/tokens'
import Icon from './Icon'

type ToastProps = {
  children: ReactNode
  tone?: 'sage' | 'amber'
}

export default function Toast({ children, tone = 'sage' }: ToastProps) {
  return (
    <div
      className="animate-iv-toast"
      style={{
        position: 'absolute',
        bottom: 110,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: T.ink,
        color: T.cream,
        padding: '11px 18px 11px 14px',
        borderRadius: 999,
        fontSize: 13.5,
        fontWeight: 500,
        boxShadow: '0 12px 32px rgba(40,30,20,0.25)',
        zIndex: 40,
        whiteSpace: 'nowrap' as const,
        pointerEvents: 'none',
      }}
    >
      <div style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        background: tone === 'sage' ? T.sage : T.amber,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon name="check" size={14} color="#fff" strokeWidth={2.6} />
      </div>
      {children}
    </div>
  )
}
