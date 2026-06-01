'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import { deleteItem, type Item } from '@/lib/db/notebook/items'
import type { CurriculumRow } from '@/lib/corpus/curriculum'
import type { ZhMode } from './SettingsPanel'

type Props = {
  row: CurriculumRow
  index: number
  zhMode: ZhMode
  lookupOn: boolean
  initialSavedId?: string | null
  onLookup?: (word: string, rect: DOMRect) => void
  onPlay: (url: string) => void
  onSave: (ab: string, zh: string, audioUrl?: string | null, sourceId?: string) => Promise<Item | null>
}

export default function StudyCard({ row, index, zhMode, lookupOn, initialSavedId, onLookup, onPlay, onSave }: Readonly<Props>) {
  const [zhRevealed, setZhRevealed] = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [savedId,    setSavedId]    = useState<string | null>(initialSavedId ?? null)

  const tokens = row.ab.split(/\s+/).filter(Boolean)

  const zhRendered = zhMode !== 'hidden' || zhRevealed
  const zhBlurred  = zhMode === 'blurred' && !zhRevealed

  const copy = async () => {
    const text = row.zh ? `${row.ab}\n${row.zh}` : row.ab
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSave = async () => {
    if (savedId) {
      await deleteItem(savedId)
      setSavedId(null)
    } else {
      const item = await onSave(row.ab, row.zh ?? '', row.audio_url, row.original_uuid)
      if (item) setSavedId(item.id)
    }
  }

  return (
    <div style={{ position: 'relative', paddingTop: 10 }}>
      {/* Index — floated outside card, top-left */}
      <span style={{
        position: 'absolute', top: 0, left: 6,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10, color: T.inkFaint, lineHeight: 1,
      }}>{index}</span>

      {/* Card */}
      <div style={{
        background: T.paperHi, borderRadius: 18,
        border: `1px solid ${T.lineSoft}`, padding: '10px 10px 10px 14px',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04)',
        display: 'flex', alignItems: 'stretch', gap: 10,
      }}>

        {/* Left: ab + zh text */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
          {/* ab — tokenized for lookup */}
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 21, lineHeight: 1.45, color: T.ink, overflowWrap: 'break-word', minWidth: 0 }}>
            {tokens.map((tok, i) => (
              <span
                key={i}
                onClick={lookupOn && onLookup ? e => {
                  onLookup(tok, (e.target as HTMLElement).getBoundingClientRect())
                } : undefined}
                style={{
                  marginRight: 4,
                  cursor: lookupOn ? 'pointer' : 'text',
                  borderBottom: lookupOn ? `1px dashed ${T.inkFaint}` : 'none',
                }}
              >{tok}</span>
            ))}
          </div>

          {/* divider */}
          <div style={{ height: 1, background: T.lineSoft }} />

          {/* zh — respects zhMode */}
          {(row.zh || zhMode === 'hidden') && (
            <div
              onClick={() => zhMode !== 'visible' && setZhRevealed(v => !v)}
              style={{
                fontFamily: 'Newsreader, Georgia, serif', fontSize: 15,
                color: T.inkSoft, lineHeight: 1.5,
                filter: zhBlurred ? 'blur(5px)' : 'none',
                cursor: zhMode !== 'visible' ? 'pointer' : 'default',
                userSelect: zhBlurred ? 'none' : 'text',
                minHeight: 22,
              }}
            >
              {zhRendered
                ? (row.zh || <span style={{ color: T.inkFaint, fontSize: 12 }}>tap to reveal</span>)
                : <span style={{ color: T.inkFaint, fontSize: 12 }}>tap to reveal</span>}
            </div>
          )}
        </div>

        {/* Right: buttons stacked vertically */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4, flexShrink: 0,
        }}>
          {row.audio_url && (
            <button onClick={() => onPlay(row.audio_url!)} style={btnStyle}>
              <Icon name="speaker" size={15} strokeWidth={1.8} />
            </button>
          )}
          <button onClick={copy} style={btnStyle}>
            <Icon name={copied ? 'check' : 'copy'} size={15} strokeWidth={1.8} />
          </button>
          <button
            onClick={handleSave}
            style={{ ...btnStyle, color: savedId ? T.crimson : T.inkMute }}
          >
            <Icon name={savedId ? 'bookmarkF' : 'bookmark'} size={16} strokeWidth={1.8}
              color={savedId ? T.crimson : T.inkMute} />
          </button>
        </div>

      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 999, flexShrink: 0,
  background: 'transparent', border: `1px solid ${T.lineSoft}`,
  color: T.inkMute, cursor: 'pointer', fontFamily: 'inherit',
}
