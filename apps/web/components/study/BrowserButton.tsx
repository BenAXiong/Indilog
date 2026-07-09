'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import BrowserView from './BrowserView'

export default function BrowserButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(43,34,26,0.35)' }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41,
            background: T.cream, borderRadius: '20px 20px 0 0',
            boxShadow: '0 -4px 32px rgba(43,34,26,0.15)',
            maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
            </div>
            {/* Title */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 18px 16px', flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
              }}>
                Browser
              </div>
              <button
                onClick={() => setOpen(false)}
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
            <div style={{ paddingBottom: 40 }}>
              <BrowserView />
            </div>
          </div>
        </>
      )}
    </>
  )
}
