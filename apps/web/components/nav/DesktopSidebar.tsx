'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon, LangAvatar, Wordmark } from '@/components/ui'
import { useActiveLang } from '@/lib/hooks/useActiveLang'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: '/',          icon: 'home'      as const },
  { id: 'learn',     label: 'Learn',     href: '/learn',     icon: 'learn'     as const },
  { id: 'review',    label: 'Review',    href: '/review',    icon: 'review'    as const, badge: 12 },
  { id: 'dict',      label: 'Dictionary',href: '/dict',      icon: 'dict'      as const },
  { id: 'translate', label: 'Translate', href: '/translate', icon: 'translate' as const },
]

export default function DesktopSidebar() {
  const pathname = usePathname()
  const { lang } = useActiveLang()

  const activeId = pathname === '/' ? 'dashboard'
    : NAV_ITEMS.find(it => it.href !== '/' && pathname.startsWith(it.href))?.id ?? ''

  return (
    <aside style={{
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      borderRight: `1px solid ${T.line}`,
      background: T.paper,
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '4px 10px 0' }}>
        <Wordmark size={20} />
      </div>

      {/* Active language card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px', background: T.paperHi,
        border: `1px solid ${T.lineSoft}`, borderRadius: 12,
      }}>
        <LangAvatar letter={lang.letter} color={lang.color} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Studying
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>
            {lang.name}
          </div>
        </div>
        <Icon name="chev-d" size={13} color={T.inkFaint} />
      </div>

      {/* Capture CTA */}
      <Link href="/capture" style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '11px 12px', borderRadius: 12,
        background: T.crimson, color: '#fff',
        boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(120,30,15,0.2), 0 6px 14px rgba(120,30,15,0.18)',
        fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.005em',
        textDecoration: 'none',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="capture" size={13} color="#fff" strokeWidth={2.4} />
        </div>
        Capture
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, opacity: 0.7, fontWeight: 500 }}>⌘K</span>
      </Link>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = activeId === item.id
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                background: active ? T.crimsonBg : 'transparent',
                color: active ? T.crimsonDp : T.inkSoft,
                fontSize: 13, fontWeight: 500, transition: 'background .15s, color .15s',
                textDecoration: 'none',
              }}
            >
              <Icon name={item.icon} size={17} strokeWidth={active ? 2 : 1.6} color="currentColor" />
              <span style={{ flex: 1 }}>{item.label}</span>
              {'badge' in item && item.badge && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                  background: active ? T.crimson : T.line,
                  color: active ? '#fff' : T.inkSoft,
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings link */}
      <Link href="/settings" style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 10,
        color: T.inkSoft, fontSize: 13, fontWeight: 500,
        textDecoration: 'none', transition: 'background .15s',
      }}>
        <Icon name="settings" size={17} strokeWidth={1.6} color="currentColor" />
        Settings
      </Link>
    </aside>
  )
}
