import type { CSSProperties } from 'react'
import { T } from '@/lib/tokens'
import Icon from './Icon'

type SectionHeadProps = {
  title: string
  action?: string
  onAction?: () => void
  style?: CSSProperties
}

export default function SectionHead({ title, action, onAction, style }: SectionHeadProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      padding: '0 4px',
      marginBottom: 10,
      ...style,
    }}>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11,
        fontWeight: 500,
        color: T.inkMute,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {title}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            color: T.crimson,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {action}
          <Icon name="chevron" size={14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
