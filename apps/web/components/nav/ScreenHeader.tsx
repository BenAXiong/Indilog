import Link from 'next/link'
import Image from 'next/image'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import type { ReactNode } from 'react'

type ScreenHeaderProps = {
  title: string
  langName: string
  langDialect?: string | null
  /** If provided, renders a back-to-dashboard logo button on the left */
  showHome?: boolean
  /** Slot for a custom right-side element. Defaults to settings gear. */
  right?: ReactNode
}

export default function ScreenHeader({ title, langName, langDialect, showHome = true, right }: ScreenHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
      {showHome && (
        <Link
          href="/"
          aria-label="Back to dashboard"
          style={{
            width: 36, height: 36, borderRadius: 999,
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Image src="/icon.png" alt="Indilog" width={28} height={28} priority />
        </Link>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11, color: T.inkMute,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {langName}{langDialect ? ` · ${langDialect}` : ''}
        </div>
        <h1 style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 26, fontWeight: 500, color: T.ink, marginTop: 2,
          letterSpacing: '-0.025em', lineHeight: 1.1,
        }}>
          {title}
        </h1>
      </div>
      {right !== undefined ? right : (
        <Link
          href="/settings"
          aria-label="Settings"
          style={{
            width: 36, height: 36, borderRadius: 999,
            background: T.paperHi,
            border: `1px solid ${T.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.inkSoft, flexShrink: 0,
          }}
        >
          <Icon name="settings" size={17} strokeWidth={1.6} />
        </Link>
      )}
    </div>
  )
}
