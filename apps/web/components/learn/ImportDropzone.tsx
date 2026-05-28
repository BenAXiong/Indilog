'use client'

import { useState, useRef } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import type { LevelInput } from '@/lib/db/progress/collections'

type ParsedCollection = {
  name: string
  language: string
  levels: LevelInput[]
  totalCards: number
}

type Props = {
  onParsed: (result: ParsedCollection) => void
}

// JSON import format — see docs/learn-ui.md §8
type ImportJSON = {
  name: string
  language: string
  levels: Array<{
    level: number
    lessons: Array<{
      lesson: number
      title?: string
      cards: Array<{ ab: string; zh?: string }>
    }>
  }>
}

function parseImport(raw: unknown): ParsedCollection {
  const j = raw as ImportJSON
  if (!j.name || !j.language || !Array.isArray(j.levels)) {
    throw new Error('Missing required fields: name, language, levels')
  }
  let totalCards = 0
  const levels: LevelInput[] = j.levels.map(lv => ({
    lessons: (lv.lessons ?? []).map(ls => ({
      title: ls.title,
      cards: (ls.cards ?? []).map(c => {
        if (!c.ab) throw new Error('Each card must have an "ab" field')
        totalCards++
        return { ab: c.ab, zh: c.zh }
      }),
    })),
  }))
  if (totalCards === 0) throw new Error('Collection must have at least one card')
  return { name: j.name, language: j.language, levels, totalCards }
}

export default function ImportDropzone({ onParsed }: Props) {
  const [dragging,  setDragging]  = useState(false)
  const [parsed,    setParsed]    = useState<ParsedCollection | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handle = (file: File) => {
    setError(null)
    setParsed(null)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const result = parseImport(json)
        setParsed(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid file')
      }
    }
    reader.readAsText(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handle(file)
  }

  if (parsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Preview */}
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="check" size={16} strokeWidth={2.5} color={T.sage} />
            <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
              "{parsed.name}"
            </span>
            <span style={{ fontSize: 12, color: T.inkMute }}>
              · {parsed.language} · {parsed.levels.length} level{parsed.levels.length !== 1 ? 's' : ''} · {parsed.totalCards} cards
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {parsed.levels.flatMap((lv, li) =>
              lv.lessons.map((ls, lsi) => (
                <div key={`${li}-${lsi}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 0', borderBottom: `1px solid ${T.lineSoft}`,
                }}>
                  <span style={{ fontSize: 13, color: T.inkSoft }}>
                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: T.inkFaint, marginRight: 8 }}>
                      L{li + 1}-{lsi + 1}
                    </span>
                    {ls.title || <em style={{ color: T.inkFaint }}>Untitled</em>}
                  </span>
                  <span style={{ fontSize: 11, color: T.inkFaint }}>
                    {ls.cards.length} card{ls.cards.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onParsed(parsed)}
            style={{
              flex: 1, height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: T.crimson, color: '#fff', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Import {parsed.totalCards} cards
          </button>
          <button
            onClick={() => { setParsed(null); setError(null) }}
            style={{
              height: 44, padding: '0 16px', borderRadius: 12, fontSize: 14,
              background: T.paperHi, border: `1px solid ${T.line}`,
              color: T.inkSoft, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, padding: '36px 24px',
          borderRadius: 16, cursor: 'pointer',
          background: dragging ? T.crimsonBg : T.paperHi,
          border: `2px dashed ${dragging ? T.crimson : T.lineSoft}`,
          transition: 'all .15s',
        }}
      >
        <Icon name="archive" size={28} strokeWidth={1.4} color={T.inkFaint} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: T.inkSoft, fontWeight: 500 }}>
            Drop a .json file here
          </div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>
            or <span style={{ color: T.crimson, fontWeight: 600 }}>Browse file</span>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile}
        style={{ display: 'none' }} />

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: T.crimsonBg, border: `1px solid #EFCAB8`,
          fontSize: 13, color: T.crimsonDp,
        }}>{error}</div>
      )}

      <div style={{ fontSize: 12, color: T.inkFaint, textAlign: 'center' }}>
        Expected format: <code style={{ fontSize: 11 }}>docs/learn-ui.md §8</code>
      </div>
    </div>
  )
}
