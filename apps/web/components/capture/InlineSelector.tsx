'use client'

import { useState, useRef, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'

type Option = { id: string; name: string }

type Props = {
  icon: 'bookmark' | 'user'
  label: string
  options: Option[]
  selected: Option | null
  onSelect: (opt: Option | null) => void
  onCreate: (name: string) => Promise<Option | null>
  placeholder?: string
}

export default function InlineSelector({ icon, label, options, selected, onSelect, onCreate, placeholder }: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
  const showCreate = query.trim() && !filtered.some(o => o.name.toLowerCase() === query.toLowerCase())

  async function handleCreate() {
    if (!query.trim() || creating) return
    setCreating(true)
    const created = await onCreate(query.trim())
    setCreating(false)
    if (created) {
      onSelect(created)
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger row — note: clear button is a sibling below, not inside, to avoid button-in-button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', paddingRight: selected ? 40 : 14,
          width: '100%', textAlign: 'left',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <Icon name={icon} size={16} color={T.inkSoft} strokeWidth={1.8} />
        <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>{label}</span>
        <span style={{
          flex: 1, fontSize: 14, fontWeight: selected ? 500 : 400,
          color: selected ? T.ink : T.inkFaint,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {selected ? selected.name : placeholder ?? '(optional)'}
        </span>
        {!selected && <Icon name="chev-d" size={14} color={T.inkFaint} />}
      </button>

      {/* Clear button — absolutely positioned sibling so it is never nested inside the trigger button */}
      {selected && (
        <button
          onClick={e => { e.stopPropagation(); onSelect(null) }}
          style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', padding: 2, cursor: 'pointer',
            color: T.inkFaint, display: 'flex', alignItems: 'center',
          }}
        >
          <Icon name="x" size={13} strokeWidth={2} />
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
          background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 12,
          boxShadow: '0 4px 16px rgba(43,34,26,0.12)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && showCreate) handleCreate() }}
              placeholder={`Search or create ${label.toLowerCase()}…`}
              style={{
                width: '100%', border: 0, background: 'transparent', outline: 'none',
                fontSize: 13, color: T.ink, fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {filtered.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onSelect(opt); setOpen(false); setQuery('') }}
                style={{
                  display: 'block', width: '100%', padding: '10px 14px',
                  textAlign: 'left', fontSize: 13, color: T.ink, fontWeight: 500,
                  background: selected?.id === opt.id ? T.crimsonBg : 'none',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {opt.name}
              </button>
            ))}
            {filtered.length === 0 && !showCreate && (
              <div style={{ padding: '12px 14px', fontSize: 12.5, color: T.inkFaint }}>No results</div>
            )}
            {showCreate && (
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '10px 14px',
                  fontSize: 13, color: T.crimson, fontWeight: 600,
                  background: 'none', border: 'none', cursor: creating ? 'not-allowed' : 'pointer',
                  borderTop: filtered.length > 0 ? `1px solid ${T.lineSoft}` : 'none',
                }}
              >
                <Icon name="plus" size={14} strokeWidth={2.2} color={T.crimson} />
                {creating ? 'Creating…' : `Create "${query.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
