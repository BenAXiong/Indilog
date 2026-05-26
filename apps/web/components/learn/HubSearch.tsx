'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'

type NavItem = {
  label: string
  sublabel: string
  href: string
  storage: Array<{ key: string; value: string }>
}

type SentHit = { ab: string; zh: string }

type Props = {
  glid: string
  navItems: NavItem[]
  onClose: () => void
}

export default function HubSearch({ glid, navItems, onClose }: Readonly<Props>) {
  const router = useRouter()
  const [tab,        setTab]        = useState<'sent' | 'titles'>('titles')
  const [query,      setQuery]      = useState('')
  const [sentHits,   setSentHits]   = useState<SentHit[]>([])
  const [sentLoading, setSentLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounced sentence search via dict API
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (tab !== 'sent' || !query.trim()) { setSentHits([]); return }
    setSentLoading(true)
    timerRef.current = setTimeout(() => {
      fetch(`/api/dict/search?q=${encodeURIComponent(query)}&glid=${glid}`)
        .then(r => r.json())
        .then((d: { sentences?: SentHit[] }) => {
          setSentHits(d.sentences ?? [])
          setSentLoading(false)
        })
        .catch(() => setSentLoading(false))
    }, 320)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, tab, glid])

  const q = query.toLowerCase().trim()
  const filteredNav = q
    ? navItems.filter(n => n.label.toLowerCase().includes(q) || n.sublabel.toLowerCase().includes(q))
    : navItems.slice(0, 60)

  const handleSelectNav = (item: NavItem) => {
    for (const { key, value } of item.storage) localStorage.setItem(key, value)
    router.push(item.href)
    onClose()
  }

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
          overflow: 'hidden', boxShadow: '0 -4px 24px rgba(80,40,20,0.12)',
        }}
      >
        {/* Input row */}
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
              <button onClick={() => setQuery('')} style={iconBtn}>
                <Icon name="x" size={13} color={T.inkFaint} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <button onClick={onClose} style={iconBtn}>
            <Icon name="x" size={17} color={T.inkMute} strokeWidth={2} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 16px 10px', gap: 6 }}>
          {(['titles', 'sent'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              height: 28, padding: '0 12px', borderRadius: 7,
              background: tab === t ? T.ink : T.paperHi,
              border: `1px solid ${tab === t ? T.ink : T.line}`,
              color: tab === t ? '#fff' : T.inkSoft,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {t === 'titles' ? 'Titles' : 'Sentences'}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
          {tab === 'titles' ? (
            filteredNav.length === 0
              ? <div style={emptyStyle}>No matches</div>
              : filteredNav.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectNav(item)}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    width: '100%', textAlign: 'left', gap: 10,
                    padding: '10px 0', background: 'none', border: 'none',
                    borderBottom: `1px solid ${T.lineSoft}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.4 }}>{item.label}</span>
                  <span style={{
                    fontSize: 10.5, color: T.inkFaint, flexShrink: 0,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}>{item.sublabel}</span>
                </button>
              ))
          ) : !query.trim() ? (
            <div style={emptyStyle}>Type to search sentences</div>
          ) : sentLoading ? (
            <div style={emptyStyle}>Searching…</div>
          ) : sentHits.length === 0 ? (
            <div style={emptyStyle}>No matches</div>
          ) : sentHits.map((hit, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
              <div style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: 15, color: T.ink, lineHeight: 1.4,
              }}>{hit.ab}</div>
              {hit.zh && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>{hit.zh}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

const emptyStyle: React.CSSProperties = {
  padding: '28px 0', textAlign: 'center', color: T.inkFaint, fontSize: 13,
}
