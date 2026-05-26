'use client'

import { useState, useRef, useEffect } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import type { CurriculumRow } from '@/lib/learn/db'

type Props = {
  results: CurriculumRow[]
  navItems: { key: string; label: string }[]
  onSelectNav: (key: string) => void
  onClose: () => void
}

export default function SearchPanel({ results, navItems, onSelectNav, onClose }: Readonly<Props>) {
  const [tab, setTab]     = useState<'sent' | 'titles'>('sent')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.toLowerCase().trim()

  const filteredSent = q
    ? results.filter(r => r.ab.toLowerCase().includes(q) || (r.zh ?? '').toLowerCase().includes(q))
    : []

  const filteredTitles = q
    ? navItems.filter(n => n.label.toLowerCase().includes(q))
    : navItems.slice(0, 50)

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
          maxHeight: '72dvh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -4px 24px rgba(80,40,20,0.12)',
        }}
      >
        {/* Search input row */}
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: T.paperHi, borderRadius: 12,
            padding: '8px 12px', border: `1px solid ${T.line}`,
          }}>
            <Icon name="search" size={15} color={T.inkMute} strokeWidth={2} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 15, color: T.ink, fontFamily: 'inherit',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={iconBtnStyle}>
                <Icon name="x" size={13} color={T.inkFaint} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <button onClick={onClose} style={iconBtnStyle}>
            <Icon name="x" size={17} color={T.inkMute} strokeWidth={2} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 16px 10px', gap: 6 }}>
          {(['sent', 'titles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              height: 28, padding: '0 12px', borderRadius: 7,
              background: tab === t ? T.ink : T.paperHi,
              border: `1px solid ${tab === t ? T.ink : T.line}`,
              color: tab === t ? '#fff' : T.inkSoft,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {t === 'sent' ? 'Sentences' : 'Titles'}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
          {tab === 'sent' ? (
            !q ? (
              <div style={emptyStyle}>Type to search sentences in this set</div>
            ) : filteredSent.length === 0 ? (
              <div style={emptyStyle}>No matches</div>
            ) : filteredSent.map((row, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
                <div style={{
                  fontFamily: 'Newsreader, Georgia, serif',
                  fontSize: 15, color: T.ink, lineHeight: 1.4,
                }}>{row.ab}</div>
                {row.zh && (
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>{row.zh}</div>
                )}
              </div>
            ))
          ) : filteredTitles.length === 0 ? (
            <div style={emptyStyle}>No matches</div>
          ) : filteredTitles.map(item => (
            <button
              key={item.key}
              onClick={() => { onSelectNav(item.key); onClose() }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 0', background: 'none', border: 'none',
                borderBottom: `1px solid ${T.lineSoft}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 14, color: T.ink }}>{item.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

const emptyStyle: React.CSSProperties = {
  padding: '28px 0', textAlign: 'center', color: T.inkFaint, fontSize: 13,
}
