'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import type { Item } from '@/lib/db/notebook/items'
import type { CurriculumRow } from '@/lib/corpus/curriculum'
import type { ZhMode } from './SettingsPanel'
import { EP, type LayoutMode } from '@/lib/eparkTokens'

type Props = {
  row: CurriculumRow
  index: number
  total?: number
  layout: LayoutMode
  zhMode: ZhMode
  lookupOn: boolean
  isActive?: boolean
  onActivate?: () => void
  initialSavedId?: string | null
  onLookup?: (word: string, rect: DOMRect) => void
  onPlay: (url: string) => void
  onSave: (ab: string, zh: string, audioUrl?: string | null) => Promise<Item | null>
  onSaveWarning: () => void
}

function singleFontSize(text: string): number {
  const len = text.length
  if (len <= 60)  return 30
  if (len >= 200) return 15
  return Math.round(30 - ((len - 60) / 140) * 15)
}

export default function EparkSentence({ row, index, total, layout, zhMode, lookupOn, isActive, onActivate, initialSavedId, onLookup, onPlay, onSave, onSaveWarning }: Readonly<Props>) {
  const [zhRevealed, setZhRevealed] = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [savedId,    setSavedId]    = useState<string | null>(initialSavedId ?? null)

  // Sync when savedItemMap resolves asynchronously after mount
  useEffect(() => { setSavedId(initialSavedId ?? null) }, [initialSavedId])

  const tokens = row.ab.split(/\s+/).filter(Boolean)

  const zhBlurred = zhMode === 'blurred' && !zhRevealed

  const copy = async () => {
    const text = row.zh ? `${row.ab}\n${row.zh}` : row.ab
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSave = async () => {
    if (savedId) {
      onSaveWarning()
    } else {
      const item = await onSave(row.ab, row.zh ?? '', row.audio_url)
      if (item) setSavedId(item.id)
    }
  }

  // ── A2 · Quiet editorial (standard) ────────────────────────────────────────
  if (layout === 'standard') {
    return (
      <div style={{
        padding: index === 1 ? '4px 0 12px' : '13px 0 12px',
        borderBottom: '1.5px dashed #cfc7b7',
      }}>
        {/* Header row: index left, action buttons right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: EP.fontMono, fontSize: 11, color: T.inkSoft }}>{index}</span>
          <div style={{ display: 'flex', gap: 0 }}>
            {row.audio_url && (
              <button onClick={() => onPlay(row.audio_url!)} style={ghostBtn}>
                <Icon name="speaker" size={15} strokeWidth={1.8} />
              </button>
            )}
            <button onClick={copy} style={ghostBtn}>
              <Icon name={copied ? 'check' : 'copy'} size={15} strokeWidth={1.8} />
            </button>
            <button onClick={handleSave} style={{ ...ghostBtn, color: savedId ? T.crimson : T.inkSoft }}>
              <Icon name={savedId ? 'bookmarkF' : 'bookmark'} size={15} strokeWidth={1.8}
                color={savedId ? T.crimson : T.inkSoft} />
            </button>
          </div>
        </div>

        {/* ab text */}
        <div style={{
          fontFamily: EP.fontAb, fontWeight: 700, fontSize: 21,
          lineHeight: 1.15, color: T.ink, margin: '2px 0 0',
          overflowWrap: 'break-word',
        }}>
          {tokens.map((tok, i) => (
            <span key={i}
              onClick={lookupOn && onLookup ? e => onLookup(tok, (e.target as HTMLElement).getBoundingClientRect()) : undefined}
              style={{ marginRight: 4, cursor: lookupOn ? 'pointer' : 'text', borderBottom: lookupOn ? `1px dashed ${T.inkFaint}` : 'none' }}
            >{tok}</span>
          ))}
        </div>

        {/* Translation */}
        {row.zh && zhMode !== 'hidden' && (
          <div
            onClick={() => zhMode === 'blurred' && setZhRevealed(v => !v)}
            style={{
              fontFamily: EP.fontTrans, fontSize: 13.5, color: T.inkSoft,
              lineHeight: 1.4, marginTop: 8,
              filter: zhBlurred ? 'blur(3px)' : 'none',
              cursor: zhMode === 'blurred' ? 'pointer' : 'default',
              userSelect: zhBlurred ? 'none' : 'text',
            }}
          >
            {row.zh}
          </div>
        )}
      </div>
    )
  }

  // ── C · Transcript rail (compact) ───────────────────────────────────────────
  if (layout === 'compact') {
    return (
      <div
        style={{ position: 'relative', padding: '0 0 16px', cursor: isActive ? 'default' : 'pointer' }}
        onClick={!isActive ? onActivate : undefined}
      >
        {/* Node circle */}
        <span style={{
          position: 'absolute', left: -30, top: 1,
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${isActive ? T.crimson : T.line}`,
          background: isActive ? T.crimson : T.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: EP.fontMono, fontSize: 9,
          color: isActive ? '#fff' : T.inkSoft,
        }}>{index}</span>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {/* Text column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: EP.fontAb, fontWeight: 700, fontSize: 19,
              lineHeight: 1.15, color: T.ink, overflowWrap: 'break-word',
            }}>
              {tokens.map((tok, i) => (
                <span key={i}
                  onClick={lookupOn && onLookup ? e => { e.stopPropagation(); onLookup(tok, (e.target as HTMLElement).getBoundingClientRect()) } : undefined}
                  style={{ marginRight: 4, cursor: lookupOn ? 'pointer' : 'text', borderBottom: lookupOn ? `1px dashed ${T.inkFaint}` : 'none' }}
                >{tok}</span>
              ))}
            </div>

            {row.zh && zhMode !== 'hidden' && (
              <div
                onClick={e => { e.stopPropagation(); zhMode === 'blurred' && setZhRevealed(v => !v) }}
                style={{
                  fontFamily: EP.fontTrans, fontSize: 13, color: T.inkSoft,
                  lineHeight: 1.4, marginTop: 3,
                  filter: zhBlurred ? 'blur(3px)' : 'none',
                  cursor: zhMode === 'blurred' ? 'pointer' : 'default',
                  userSelect: zhBlurred ? 'none' : 'text',
                }}
              >
                {row.zh}
              </div>
            )}
          </div>

          {/* Right column: audio always, save revealed when active */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}
            onClick={e => e.stopPropagation()}>
            {row.audio_url && (
              <button style={smActBtn} onClick={() => onPlay(row.audio_url!)}>
                <Icon name="speaker" size={13} strokeWidth={1.8} />
              </button>
            )}
            {isActive && (
              <button
                style={{ ...smActBtn, borderColor: savedId ? T.crimson : T.line, color: savedId ? T.crimson : T.ink }}
                onClick={handleSave}
              >
                <Icon name={savedId ? 'bookmarkF' : 'bookmark'} size={13} strokeWidth={1.8}
                  color={savedId ? T.crimson : T.ink} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── B · Immersive single ──────────────────────────────────────────────────
  if (layout === 'single') {
    const abFontSize = singleFontSize(row.ab)
    return (
      <div style={{
        background: T.paperHi, borderRadius: 22,
        border: `1px solid ${T.lineSoft}`,
        padding: '8px 10px 12px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', gap: 14,
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
      }}>
        {/* Play button */}
        {row.audio_url && (
          <button onClick={() => onPlay(row.audio_url!)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 999, flexShrink: 0,
            background: T.crimson, border: 'none', cursor: 'pointer', color: '#fff',
            boxShadow: '0 2px 14px rgba(180,40,30,0.22)',
          }}>
            <Icon name="speaker" size={26} strokeWidth={1.6} color="#fff" />
          </button>
        )}

        {/* ab text — font scales down for longer sentences */}
        <div style={{
          fontFamily: EP.fontAb, fontWeight: 700, fontSize: abFontSize, lineHeight: 1.15,
          color: T.ink, overflowWrap: 'break-word', width: '100%',
        }}>
          {tokens.map((tok, i) => (
            <span key={i}
              onClick={lookupOn && onLookup ? e => onLookup(tok, (e.target as HTMLElement).getBoundingClientRect()) : undefined}
              style={{ marginRight: 4, cursor: lookupOn ? 'pointer' : 'text', borderBottom: lookupOn ? `1px dashed ${T.inkFaint}` : 'none' }}
            >{tok}</span>
          ))}
        </div>

        {/* zh */}
        {row.zh && zhMode !== 'hidden' && (
          <div
            onClick={() => zhMode === 'blurred' && setZhRevealed(v => !v)}
            style={{
              fontFamily: EP.fontTrans, fontSize: 15, color: T.inkSoft, lineHeight: 1.5,
              filter: zhBlurred ? 'blur(4px)' : 'none',
              cursor: zhMode === 'blurred' ? 'pointer' : 'default',
              userSelect: zhBlurred ? 'none' : 'text',
            }}
          >{row.zh}</div>
        )}

      </div>
    )
  }

  // ── Legacy (card shell) ────────────────────────────────────────────────────
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
          {row.zh && zhMode !== 'hidden' && (
            <div
              onClick={() => zhMode === 'blurred' && setZhRevealed(v => !v)}
              style={{
                fontFamily: 'Newsreader, Georgia, serif', fontSize: 15,
                color: T.inkSoft, lineHeight: 1.5,
                filter: zhBlurred ? 'blur(5px)' : 'none',
                cursor: zhMode === 'blurred' ? 'pointer' : 'default',
                userSelect: zhBlurred ? 'none' : 'text',
                minHeight: 22,
              }}
            >
              {row.zh}
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

const smActBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', flexShrink: 0, padding: 0,
  border: `2px solid ${T.line}`, background: T.paperHi,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: T.ink, cursor: 'pointer', fontFamily: 'inherit',
}

const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 999, flexShrink: 0,
  background: 'transparent', border: 'none', padding: 0,
  color: T.inkSoft, cursor: 'pointer', fontFamily: 'inherit',
}
