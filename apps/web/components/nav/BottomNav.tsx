'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  {
    id: 'learn',
    label: 'Learn',
    href: '/learn',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 4v12a4 4 0 004 4h12"/>
      </svg>
    ),
  },
  {
    id: 'review',
    label: 'Review',
    href: '/review',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/>
      </svg>
    ),
  },
  {
    id: 'capture',
    label: 'Capture',
    href: '/capture',
    center: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    id: 'dict',
    label: 'Dictionary',
    href: '/dict',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h11a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M8 8h7M8 12h5"/>
      </svg>
    ),
  },
  {
    id: 'translate',
    label: 'Translate',
    href: '/translate',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h10M8 3v2M5 5c0 4 4 7 8 8M11 13c-1 2-3 5-7 6"/><path d="M14 20l4-9 4 9M15.5 17h5"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  const activeId = pathname === '/'
    ? 'dashboard'
    : TABS.find(t => pathname.startsWith(t.href))?.id ?? ''

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 pb-7 pt-2"
      style={{ background: 'linear-gradient(to top, #F5EEDF 70%, rgba(245,238,223,0))' }}
    >
      <div className="flex items-end justify-around px-3 h-[60px] relative">
        {TABS.map((tab) => {
          if (tab.center) {
            const active = activeId === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-label={tab.label}
                className="flex items-center justify-center rounded-full text-white -translate-y-[18px] transition-all"
                style={{
                  width: 60,
                  height: 60,
                  background: active ? '#7C2113' : '#A8351F',
                  border: '3px solid #F5EEDF',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 4px rgba(120,30,15,0.25), 0 10px 24px rgba(120,30,15,0.28)',
                }}
              >
                {tab.icon}
              </Link>
            )
          }

          const active = activeId === tab.id
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex flex-col items-center gap-[3px] px-2 py-1 transition-colors"
              style={{ color: active ? '#A8351F' : '#8B7B68' }}
            >
              <span style={{ strokeWidth: active ? 2 : 1.6 }}>{tab.icon}</span>
              <span className="font-sans text-[10.5px] font-medium tracking-tight" style={{ fontWeight: active ? 600 : 500 }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
