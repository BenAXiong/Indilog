import Link from 'next/link'
import { T } from '@/lib/tokens'
import ScreenHeader from '@/components/nav/ScreenHeader'
import Icon, { type IconName } from '@/components/ui/Icon'
import { ACTIVE_LANG } from '@/lib/mock-data'

type SourceCardProps = {
  href: string
  icon: IconName
  title: string
  completed?: number
  total?: number
  cursor?: string
  hasDue?: boolean
}

function SourceCard({ href, icon, title, completed = 0, total = 0, cursor, hasDue }: SourceCardProps) {
  const ratio = total > 0 ? completed / total : 0
  return (
    <Link href={href} style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 14px 12px', borderRadius: 16, textDecoration: 'none',
      background: T.paperHi, border: `1px solid ${T.lineSoft}`,
      borderLeft: hasDue ? `3px solid ${T.crimson}` : `1px solid ${T.lineSoft}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 3px rgba(80,40,20,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: T.crimsonBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={16} color={T.crimson} strokeWidth={1.8} />
        </div>
        <span style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 15, fontWeight: 500, color: T.ink,
        }}>{title}</span>
      </div>

      {total > 0 && (
        <>
          {/* Progress bar */}
          <div style={{
            height: 3, borderRadius: 999,
            background: T.lineSoft, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${ratio * 100}%`,
              background: T.crimson,
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: T.inkFaint }}>
              {completed} / {total}
            </span>
            {cursor && (
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10, color: T.inkMute,
              }}>{cursor} ▸</span>
            )}
          </div>
        </>
      )}

      {total === 0 && (
        <span style={{ fontSize: 11, color: T.inkFaint }}>—</span>
      )}
    </Link>
  )
}

function NewCard() {
  return (
    <Link href="/learn/new" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '14px', borderRadius: 16, textDecoration: 'none',
      background: T.paperHi, border: `1.5px dashed ${T.lineSoft}`,
      color: T.inkFaint, minHeight: 80,
    }}>
      <Icon name="plus" size={16} strokeWidth={2} />
      <span style={{ fontSize: 14, fontWeight: 500 }}>New collection</span>
    </Link>
  )
}

export default function LearnPage() {
  const lang = ACTIVE_LANG
  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ScreenHeader title="Learn" langName={lang.name} langDialect={lang.dialect} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <SourceCard href="/learn/lessons"   icon="learn" title="Lessons"  hasDue />
        <SourceCard href="/learn/patterns"  icon="layers" title="Patterns" />
        <SourceCard href="/learn/essays"    icon="pen"   title="Essays" />
        <SourceCard href="/learn/dialogues" icon="wave"  title="Dialogs" />
        <NewCard />
      </div>
    </div>
  )
}
