'use client'

import { useState, useRef } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import { createItem } from '@/lib/db/notebook/items'
import type { Source } from '@/lib/db/sources/sources'

type ParsedRow = { text: string; meaning?: string }

type Props = {
  langCode: string
  selectedSource: Source | null
  onClose: () => void
  onImported: () => void
}

function parseLines(raw: string): ParsedRow[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf(' | ')
      if (idx !== -1) {
        const meaning = l.slice(idx + 3).trim()
        return { text: l.slice(0, idx).trim(), meaning: meaning || undefined }
      }
      return { text: l }
    })
}

export default function BatchImport({ langCode, selectedSource, onClose, onImported }: Readonly<Props>) {
  const [tab,       setTab]       = useState<'paste' | 'file'>('paste')
  const [raw,       setRaw]       = useState('')
  const [importing, setImporting] = useState(false)
  const [results,   setResults]   = useState<{ text: string; ok: boolean }[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = parseLines(raw)

  async function handleImport() {
    if (!parsed.length) return
    setImporting(true)
    const outcomes: { text: string; ok: boolean }[] = []
    for (const row of parsed) {
      const item = await createItem({
        ab:        row.text,
        zh:        row.meaning,
        type:      'sentence',
        language:  langCode,
        source_id: selectedSource?.id,
      })
      outcomes.push({ text: row.text, ok: !!item })
    }
    setImporting(false)
    setResults(outcomes)
    if (outcomes.some(o => o.ok)) onImported()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setRaw((ev.target?.result as string) ?? '') }
    reader.readAsText(file, 'utf-8')
    setTab('paste')
  }

  const okBtn: React.CSSProperties = {
    padding: '12px', borderRadius: 12,
    background: T.ink, color: T.cream,
    border: 'none', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
  }

  const disabledBtn: React.CSSProperties = {
    ...okBtn, background: T.lineSoft, color: T.inkFaint, cursor: 'not-allowed',
  }

  const segBtn = (active: boolean): React.CSSProperties => ({
    height: 24, padding: '0 10px', borderRadius: 6,
    background: active ? T.ink : 'transparent',
    border: 'none',
    color: active ? '#fff' : T.inkSoft,
    fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(40,20,10,0.3)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: T.paper, borderRadius: '20px 20px 0 0',
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 -4px 24px rgba(80,40,20,0.12)',
        }}
      >
        {/* Header — title + segmented toggle + close, all inline */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 17, fontWeight: 500, color: T.ink }}>
              Batch Import
            </span>
            {!results && (
              <div style={{
                display: 'flex', background: T.paperHi,
                border: `1px solid ${T.line}`, borderRadius: 8, padding: 2,
              }}>
                <button onClick={() => setTab('paste')} style={segBtn(tab === 'paste')}>Paste</button>
                <button onClick={() => setTab('file')}  style={segBtn(tab === 'file')}>Import</button>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={17} color={T.inkMute} strokeWidth={2} />
          </button>
        </div>

        {/* Fixed-height content area — prevents sheet from jumping on tab switch */}
        <div style={{
          height: 360, maxHeight: 'calc(80dvh - 60px)',
          overflowY: 'auto', padding: '0 16px 32px',
        }}>
          {results ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '4px 0 6px', fontSize: 13, color: T.inkSoft }}>
                {results.filter(r => r.ok).length} of {results.length} imported
              </div>
              {results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  background: r.ok ? T.sageBg : T.amberBg,
                  border: `1px solid ${r.ok ? '#D2D8AE' : T.amber}`,
                }}>
                  <Icon name={r.ok ? 'check' : 'x'} size={14} color={r.ok ? T.sage : T.amber} strokeWidth={2} />
                  <span style={{
                    fontSize: 13, color: T.ink, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'Newsreader, Georgia, serif',
                  }}>{r.text}</span>
                </div>
              ))}
              <button onClick={onClose} style={{ ...okBtn, marginTop: 6 }}>Done</button>
            </div>
          ) : tab === 'paste' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.5 }}>
                One item per line. Add{' '}
                <code style={{ fontSize: 11, background: T.paperHi, padding: '1px 4px', borderRadius: 4 }}>
                  {' | '}meaning
                </code>{' '}
                after the text to include a meaning.
              </div>
              <textarea
                value={raw}
                onChange={e => setRaw(e.target.value)}
                placeholder={'Wawa aku a Amis.\nMisakero ko wina | My mother is cooking\nPatay | to shoot'}
                rows={8}
                style={{
                  width: '100%', border: `1px solid ${T.line}`, borderRadius: 10,
                  padding: '10px 12px', background: T.paperHi,
                  fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, color: T.ink,
                  resize: 'none', outline: 'none', lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
              {parsed.length > 0 && (
                <div style={{ fontSize: 12, color: T.inkMute }}>
                  {parsed.length} item{parsed.length !== 1 ? 's' : ''} ready to import
                </div>
              )}
              <button
                onClick={handleImport}
                disabled={importing || parsed.length === 0}
                style={parsed.length === 0 || importing ? disabledBtn : okBtn}
              >
                {importing ? 'Importing…' : `Import ${parsed.length} item${parsed.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 260 }}>
              <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.5 }}>
                Plain text file (.txt) — one item per line, optional{' '}
                <code style={{ fontSize: 11, background: T.paperHi, padding: '1px 4px', borderRadius: 4 }}>
                  {' | '}meaning
                </code>{' '}
                separator.
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '14px', borderRadius: 12,
                  border: `1.5px dashed ${T.lineSoft}`,
                  background: T.paperHi, color: T.inkSoft,
                  cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icon name="plus" size={16} strokeWidth={1.8} color={T.inkSoft} />
                Choose .txt file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
