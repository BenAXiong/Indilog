'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { SessionOptionsSheet } from './SessionOptionsSheet'
import type { FlashcardWithItem } from '@/lib/db/srs/flashcards'

export type EditCardPatch = { ab: string; zh: string }

export function EditCardSheet({
  card,
  onSave,
  onClose,
}: {
  card: FlashcardWithItem
  onSave: (patch: EditCardPatch) => void
  onClose: () => void
}) {
  const [ab, setAb] = useState(card.ind_items?.ab ?? '')
  const [zh, setZh] = useState(card.ind_items?.zh ?? '')

  const areaStyle = (minH: number) => ({
    width: '100%', boxSizing: 'border-box' as const,
    padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${T.lineSoft}`, background: T.paper,
    fontFamily: 'inherit', fontSize: 14, color: T.ink,
    lineHeight: 1.5, resize: 'vertical' as const, minHeight: minH,
    outline: 'none',
  })

  return (
    <SessionOptionsSheet onClose={onClose}>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Aboriginal
          </label>
          <textarea value={ab} onChange={e => setAb(e.target.value)} style={areaStyle(72)} />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Translation
          </label>
          <textarea value={zh} onChange={e => setZh(e.target.value)} style={areaStyle(56)} />
        </div>
        <button
          onClick={() => onSave({ ab, zh })}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            background: T.ink, color: T.cream,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </SessionOptionsSheet>
  )
}
