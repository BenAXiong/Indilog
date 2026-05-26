'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import type { CurriculumRow } from '@/lib/learn/db'
import type { ZhMode } from './SettingsPanel'

type Props = {
  row: CurriculumRow
  index: number
  zhMode: ZhMode
  lookupOn: boolean
  onLookup?: (word: string, rect: DOMRect) => void
  onPlay: (url: string) => void
  onSave: (ab: string, zh: string) => Promise<void>
}

export default function StudyCard({ row, index, zhMode, lookupOn, onLookup, onPlay, onSave }: Props) {
  const [zhRevealed, setZhRevealed] = useState(false)
  const [copiedAb, setCopiedAb] = useState(false)
  const [copiedZh, setCopiedZh] = useState(false)
  const [saved, setSaved] = useState(false)

  const tokens = row.ab.split(/\s+/).filter(Boolean)

  // zh display logic
  const zhRendered = zhMode !== 'hidden' || zhRevealed
  const zhBlurred  = zhMode === 'blurred' && !zhRevealed

  const copy = async (text: string, which: 'ab' | 'zh') => {
    try { await navigator.clipboard.writeText(text) } catch {}
    if (which === 'ab') { setCopiedAb(true); setTimeout(() => setCopiedAb(false), 1500) }
    else { setCopiedZh(true); setTimeout(() => setCopiedZh(false), 1500) }
  }

  const handleSave = async () => {
    await onSave(row.ab, row.zh)
    setSaved(true)
  }

  return (
    <div style={{
      background: T.paperHi, borderRadius: 18,
      border: `1px solid ${T.lineSoft}`, padding: '14px 16px 12px',
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04)',
    }}>
      {/* Header: index + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: T.inkFaint }}>{index}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {row.audio_url && (
            <button onClick={() => onPlay(row.audio_url!)} style={btnStyle}>
              <Icon name="speaker" size={15} strokeWidth={1.8} />
            </button>
          )}
          <button onClick={() => copy(row.ab, 'ab')} style={btnStyle}>
            <Icon name={copiedAb ? 'check' : 'copy'} size={15} strokeWidth={1.8} />
          </button>
          {row.zh && (
            <button onClick={() => copy(row.zh, 'zh')} style={btnStyle}>
              <Icon name={copiedZh ? 'check' : 'note'} size={15} strokeWidth={1.8} />
            </button>
          )}
          <button
            onClick={handleSave}
            style={{ ...btnStyle, color: saved ? T.crimson : T.inkMute }}
          >
            <Icon name={saved ? 'bookmarkF' : 'bookmark'} size={16} strokeWidth={1.8}
              color={saved ? T.crimson : T.inkMute} />
          </button>
        </div>
      </div>

      {/* ab text — tokenized */}
      <div style={{
        fontFamily: 'Newsreader, Georgia, serif',
        fontSize: 21, lineHeight: 1.55, color: T.ink, marginBottom: 12,
      }}>
        {tokens.map((tok, i) => (
          <span
            key={i}
            onClick={lookupOn && onLookup ? e => {
              const rect = (e.target as HTMLElement).getBoundingClientRect()
              onLookup(tok, rect)
            } : undefined}
            style={{
              marginRight: 4, cursor: lookupOn ? 'pointer' : 'text',
              borderBottom: lookupOn ? `1px dashed ${T.inkFaint}` : 'none',
            }}
          >{tok}</span>
        ))}
      </div>

      <div style={{ height: 1, background: T.lineSoft, margin: '0 0 10px' }} />

      {/* zh row */}
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
  )
}

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
  background: 'transparent', border: `1px solid ${T.lineSoft}`,
  color: T.inkMute, cursor: 'pointer', fontFamily: 'inherit',
}
