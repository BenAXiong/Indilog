'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'

const TABS = [
  { id: 'home',      label: 'Dashboard',  href: '/',          icon: 'home'      as const },
  { id: 'study',     label: 'Study',      href: '/study',     icon: 'learn'     as const },
  { id: 'capture',   label: 'Capture',    href: '/capture',   icon: 'capture'   as const, center: true },
  { id: 'translate', label: 'Translate',  href: '/translate', icon: 'translate' as const },
  { id: 'dict',      label: 'Dictionary', href: '/dict',      icon: 'dict'      as const },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const swipeRef = useRef<{ x: number; y: number; edge: boolean } | null>(null)

  const activeId = TABS.find(t =>
    t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
  )?.id ?? ''

  // Edge swipe to navigate between tabs
  useEffect(() => {
    const EDGE_PX = 28   // swipe must START within this many px of screen edge
    const THRESH  = 72   // minimum horizontal travel

    function onStart(e: TouchEvent) {
      const t = e.touches[0]
      const edge = t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX
      swipeRef.current = { x: t.clientX, y: t.clientY, edge }
    }

    function onEnd(e: TouchEvent) {
      if (!swipeRef.current?.edge) return
      const dx = e.changedTouches[0].clientX - swipeRef.current.x
      const dy = e.changedTouches[0].clientY - swipeRef.current.y
      if (Math.abs(dx) < THRESH || Math.abs(dy) > Math.abs(dx)) return
      const idx = TABS.findIndex(t => t.id === activeId)
      const next = dx < 0 ? TABS[idx + 1] : TABS[idx - 1]
      if (next) router.push(next.href)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend',   onEnd)
    }
  }, [activeId, router])

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden pb-7 pt-2"
      style={{ background: `linear-gradient(to top, ${T.cream} 70%, rgba(245,238,223,0))` }}
    >
      <div className="flex items-end justify-around px-3 h-[60px] relative">
        {TABS.map((tab) => {
          const active = activeId === tab.id

          if (tab.center) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-label={tab.label}
                className="flex items-center justify-center rounded-full text-white -translate-y-[10px] transition-all"
                style={{
                  width: 60, height: 60,
                  background: active ? T.crimsonDp : T.crimson,
                  border: `3px solid ${T.cream}`,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 4px rgba(120,30,15,0.25), 0 10px 24px rgba(120,30,15,0.28)',
                }}
              >
                <Icon name="capture" size={26} strokeWidth={2.4} color="#fff" />
              </Link>
            )
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex flex-col items-center gap-[3px] px-2 py-1 transition-colors"
              style={{ color: active ? T.crimson : T.inkMute }}
            >
              <Icon name={tab.icon} size={22} strokeWidth={active ? 2 : 1.6} color="currentColor" />
              <span style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: 10.5,
                fontWeight: active ? 600 : 500,
                letterSpacing: '-0.005em',
              }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
