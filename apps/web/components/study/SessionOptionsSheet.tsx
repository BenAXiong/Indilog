'use client'

import { useEffect, type ReactNode } from 'react'
import { T } from '@/lib/tokens'
import { useBackButtonClose } from '@/lib/hooks/useBackButtonClose'

export function SessionOptionsSheet({
  onClose,
  children,
}: {
  onClose:  () => void
  children: ReactNode
}) {
  // No open prop — this component only exists in the tree while visible,
  // so it's open for its whole mounted lifetime.
  const requestClose = useBackButtonClose(true, onClose)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <>
      <div onClick={requestClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,22,16,0.32)', zIndex: 20 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 21,
        background: T.cream, borderRadius: '22px 22px 0 0',
        padding: '10px 0 32px', boxShadow: '0 -12px 36px rgba(40,30,20,0.2)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.line, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '0 16px 10px' }}>
          Session options
        </div>
        {children}
      </div>
    </>
  )
}
