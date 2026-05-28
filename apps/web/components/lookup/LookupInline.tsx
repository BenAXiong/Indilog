'use client'

import { useEffect, useState } from 'react'
import { T } from '@/lib/tokens'

type LookupRow = { word_ab: string; word_ch: string; dialect_name: string; vocab_source: string }

type Props = {
  word: string
  anchorRect: DOMRect
  onClose: () => void
}

export default function LookupInline({ word, anchorRect, onClose }: Props) {
  const [rows, setRows] = useState<LookupRow[] | null>(null)

  useEffect(() => {
    setRows(null)
    fetch(`/api/learn/lookup?word=${encodeURIComponent(word)}`)
      .then(r => r.json())
      .then(d => setRows(d.results ?? []))
      .catch(() => setRows([]))
  }, [word])

  const top = anchorRect.bottom + window.scrollY + 6
  const left = Math.max(12, Math.min(anchorRect.left, window.innerWidth - 220))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 59 }} />
      <div style={{
        position: 'absolute', top, left,
        zIndex: 60, minWidth: 200, maxWidth: 260,
        background: T.paperHi, border: `1px solid ${T.line}`,
        borderRadius: 12, padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(40,20,10,0.16)',
      }}>
        <div style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 6,
        }}>{word}</div>

        {rows === null ? (
          <div style={{ fontSize: 13, color: T.inkFaint }}>…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: T.inkFaint }}>No dictionary entry found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.4 }}>
                <span style={{ color: T.ink }}>{r.word_ch}</span>
                <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 6 }}>
                  {r.dialect_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
