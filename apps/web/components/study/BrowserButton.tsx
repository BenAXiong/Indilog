'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import BrowserView from './browser/BrowserView'

export default function BrowserButton() {
  const [open, setOpen] = useState(false)

  // The overlay opens via plain state, not a route change, so by default the
  // phone's back button doesn't know about it — it just navigates the whole
  // page back to wherever history already pointed (e.g. dashboard). Pushing
  // a marker entry on open and listening for popstate makes back close the
  // overlay first, like a native sheet.
  function openBrowser() {
    history.pushState({ browserOverlay: true }, '')
    setOpen(true)
  }

  // UI-triggered close (X / backdrop) goes through history.back() too, so
  // the entry we pushed on open gets consumed — otherwise closing via the X
  // would leave a now-inert entry behind, and back would need pressing
  // twice (once for that leftover, once to actually leave) instead of once.
  function closeBrowser() {
    history.back()
  }

  useEffect(() => {
    if (!open) return
    function onPopState() { setOpen(false) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [open])

  return (
    <>
      <button
        onClick={openBrowser}
        aria-label="Card browser"
        style={{
          width: 36, height: 36, borderRadius: 999,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Icon name="search" size={16} strokeWidth={1.8} />
      </button>

      {open && (
        <>
          <div
            onClick={closeBrowser}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(43,34,26,0.35)' }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41,
            background: T.cream, borderRadius: 0,
            height: '100dvh', maxHeight: '100dvh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Title */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 18px', flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
              }}>
                Browser
              </div>
              <button
                onClick={closeBrowser}
                aria-label="Close"
                style={{
                  width: 30, height: 30, borderRadius: 999, background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.inkMute, cursor: 'pointer',
                }}
              >
                <Icon name="close" size={16} strokeWidth={1.8} />
              </button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 40 }}>
              <BrowserView />
            </div>
          </div>
        </>
      )}
    </>
  )
}
