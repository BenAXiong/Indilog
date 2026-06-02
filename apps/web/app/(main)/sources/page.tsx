'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import {
  listSources, createSource, updateSource, deleteSource,
  type Source, type SourceType, type CreateSourceInput,
} from '@/lib/db/sources/sources'

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#C97B3A', '#5C7A3E', '#4A6FA8', '#8B5CA8', '#A84A4A', '#3A8B8B']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

const TYPE_LABELS: Record<SourceType, string> = { person: 'Person', media: 'Media', reference: 'Reference' }
const TYPE_ICONS:  Record<SourceType, string>  = { person: 'user',   media: 'speaker', reference: 'library' }

// ── Edit sheet ────────────────────────────────────────────────────────────────
const EMPTY: CreateSourceInput = {
  name: '', type: 'person', dialect_name: null, language: null,
  location: null, url: null, notes: null, avatar_color: null,
}

function SourceSheet({
  initial, onSave, onClose, onDelete,
}: {
  initial: CreateSourceInput & { id?: string }
  onSave:   (data: CreateSourceInput) => Promise<void>
  onClose:  () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm]     = useState(initial)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const set = (k: keyof CreateSourceInput, v: string) =>
    setForm(f => ({ ...f, [k]: v || null }))

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({ ...form, name: form.name.trim() })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    await onDelete?.()
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
    border: `1px solid ${T.line}`, background: T.paper, color: T.ink,
    fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute,
    textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
    display: 'block', marginBottom: 5,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,10,0.35)', zIndex: 70 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 71,
        background: T.paper, borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`, boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
        padding: '14px 18px 32px', display: 'flex', flexDirection: 'column', gap: 14,
        maxHeight: '90dvh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -6 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink }}>
            {initial.id ? 'Edit source' : 'New source'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute, padding: 4 }}>
            <Icon name="x" size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Type picker */}
        <div>
          <span style={labelStyle}>Type</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['person', 'media', 'reference'] as SourceType[]).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                style={{
                  flex: 1, height: 36, borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: form.type === t ? T.ink : T.paperHi,
                  color: form.type === t ? T.paper : T.inkSoft,
                  border: `1px solid ${form.type === t ? T.ink : T.line}`,
                  transition: 'all .12s',
                }}
              >{TYPE_LABELS[t]}</button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            style={inputStyle} value={form.name} placeholder="e.g. Aunty Lin"
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>

        {/* Dialect + Language */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Dialect</label>
            <input style={inputStyle} value={form.dialect_name ?? ''} placeholder="e.g. 馬蘭阿美語"
              onChange={e => set('dialect_name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Language</label>
            <input style={inputStyle} value={form.language ?? ''} placeholder="e.g. amis"
              onChange={e => set('language', e.target.value)} />
          </div>
        </div>

        {/* Type-specific fields */}
        {form.type === 'person' && (
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={form.location ?? ''} placeholder="Hometown or region"
              onChange={e => set('location', e.target.value)} />
          </div>
        )}
        {(form.type === 'media' || form.type === 'reference') && (
          <div>
            <label style={labelStyle}>URL</label>
            <input style={inputStyle} value={form.url ?? ''} placeholder="https://…"
              onChange={e => set('url', e.target.value)} />
          </div>
        )}

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, resize: 'none', minHeight: 64 }}
            value={form.notes ?? ''} placeholder="Optional notes"
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {/* Actions */}
        <button
          onClick={handleSave} disabled={!form.name.trim() || saving}
          style={{
            height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: form.name.trim() ? T.ink : T.lineSoft,
            color: form.name.trim() ? T.paper : T.inkFaint,
            fontSize: 15, fontWeight: 600,
          }}
        >{saving ? 'Saving…' : 'Save'}</button>

        {initial.id && (
          <button
            onClick={handleDelete}
            style={{
              height: 40, borderRadius: 12, border: `1px solid ${confirm ? T.crimson : T.lineSoft}`,
              cursor: 'pointer', background: 'none',
              color: confirm ? T.crimson : T.inkFaint, fontSize: 14, fontWeight: 500,
            }}
          >{confirm ? 'Tap again to confirm delete' : 'Delete source'}</button>
        )}
      </div>
    </>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function SourceCard({ source, onClick }: { source: Source; onClick: () => void }) {
  const color  = source.avatar_color ?? avatarColor(source.name)
  const initial = source.name.trim()[0]?.toUpperCase() ?? '?'
  const sub = source.type === 'person'
    ? source.location
    : source.url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? null

  return (
    <button onClick={onClick} style={{
      background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16,
      padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 999, flexShrink: 0,
          background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 600, color: '#fff',
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{source.name}</div>
          {sub && (
            <div style={{
              fontSize: 11, color: T.inkFaint,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginTop: 1,
            }}>{sub}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, fontWeight: 700,
          padding: '2px 7px', borderRadius: 999, letterSpacing: '0.05em',
          background: T.lineSoft, color: T.inkMute, textTransform: 'uppercase',
        }}>{TYPE_LABELS[source.type]}</span>
        {source.dialect_name && (
          <span style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 999,
            background: T.amberBg, color: T.amber, fontWeight: 500,
          }}>{source.dialect_name}</span>
        )}
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<(CreateSourceInput & { id?: string }) | null>(null)

  useEffect(() => {
    listSources().then(s => { setSources(s); setLoading(false) })
  }, [])

  async function handleSave(data: CreateSourceInput) {
    if (editing?.id) {
      await updateSource(editing.id, data)
      setSources(s => s.map(x => x.id === editing.id ? { ...x, ...data } : x))
    } else {
      const color = avatarColor(data.name)
      const created = await createSource({ ...data, avatar_color: color })
      if (created) setSources(s => [...s, created].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    await deleteSource(editing.id)
    setSources(s => s.filter(x => x.id !== editing.id))
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.paper }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
        position: 'sticky', top: 0, background: T.paper, zIndex: 10,
        borderBottom: `1px solid ${T.lineSoft}`,
      }}>
        <Link href="/capture" style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, textDecoration: 'none',
        }}>
          <Icon name="arrow-l" size={16} strokeWidth={2} />
        </Link>
        <span style={{
          flex: 1, fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
        }}>Sources</span>
        <button
          onClick={() => setEditing(EMPTY)}
          style={{
            width: 34, height: 34, borderRadius: 999,
            background: T.ink, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={16} strokeWidth={2.5} color={T.paper} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px 48px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: T.inkFaint, fontSize: 13 }}>Loading…</div>
        ) : sources.length === 0 ? (
          <div style={{
            padding: '36px 24px', textAlign: 'center',
            background: T.paperHi, borderRadius: 18, border: `1px solid ${T.lineSoft}`,
          }}>
            <div style={{ fontSize: 14, color: T.inkSoft, fontWeight: 500, marginBottom: 6 }}>No sources yet</div>
            <div style={{ fontSize: 13, color: T.inkFaint }}>
              Add people, media, or references you learn from.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {sources.map(s => (
              <SourceCard key={s.id} source={s} onClick={() => setEditing({ ...s })} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <SourceSheet
          initial={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
