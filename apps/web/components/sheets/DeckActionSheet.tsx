'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import {
  renameCollection,
  deleteCollection,
  listCollectionCards,
  setIncludeInReview,
  type CollectionMeta,
} from '@/lib/db/progress/collections'
import { resetCollectionSRS, resetCapturesSRS } from '@/lib/db/srs/flashcards'
import { setCapturesIncludeInReview } from '@/lib/db/profile/client'

export const CAPTURES_DECK_ID = '__captures__'

type Props = {
  deck:               CollectionMeta
  onClose:            () => void
  onRenamed:          (id: string, name: string) => void
  onDeleted:          (id: string) => void
  onReset?:           () => void
  onIncludeToggled?:  (id: string, include: boolean) => void
}

type View = 'menu' | 'rename' | 'delete' | 'reset'

const isCaptures = (id: string) => id === CAPTURES_DECK_ID

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#8C7B6A',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  fontFamily: '"JetBrains Mono", monospace', marginBottom: 6,
}

export default function DeckActionSheet({ deck, onClose, onRenamed, onDeleted, onReset, onIncludeToggled }: Readonly<Props>) {
  const [view, setView] = useState<View>('menu')
  const [name, setName] = useState(deck.name)
  const [busy, setBusy]     = useState(false)

  async function handleRename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === deck.name) { onClose(); return }
    setBusy(true)
    await renameCollection(deck.id, trimmed)
    onRenamed(deck.id, trimmed)
    setBusy(false)
    onClose()
  }

  async function handleExport() {
    setBusy(true)
    const cards = await listCollectionCards(deck.id)
    const payload = { name: deck.name, cards }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${deck.name.replace(/[^a-zA-Z0-9]+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBusy(false)
    onClose()
  }

  async function handleShare() {
    const text = `${deck.name} — ${deck.card_count} cards`
    try {
      if (navigator.share) await navigator.share({ title: deck.name, text })
      else await navigator.clipboard.writeText(text)
    } catch {}
    onClose()
  }

  async function handleDelete() {
    setBusy(true)
    await deleteCollection(deck.id)
    onDeleted(deck.id)
    setBusy(false)
    onClose()
  }

  function handleIncludeToggle() {
    const next = !deck.include_in_review
    if (isCaptures(deck.id)) setCapturesIncludeInReview(next)
    else setIncludeInReview(deck.id, next)
    onIncludeToggled?.(deck.id, next)
    onClose()
  }

  async function handleReset() {
    setBusy(true)
    if (isCaptures(deck.id)) await resetCapturesSRS()
    else                      await resetCollectionSRS(deck.id)
    onReset?.()
    setBusy(false)
    onClose()
  }

  const actionRow = (onClick: () => void, icon: React.ReactNode, label: string, danger = false) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '15px 18px', cursor: 'pointer',
        background: 'none', border: 'none', width: '100%', textAlign: 'left',
      }}
    >
      {icon}
      <span style={{ fontSize: 15, fontWeight: 500, color: danger ? T.crimson : T.ink }}>
        {label}
      </span>
    </button>
  )

  return (
    <>
      <div
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        role="button"
        tabIndex={-1}
        aria-label="Close"
        style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,10,0.35)', zIndex: 70 }}
      />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: T.paper, borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`, zIndex: 71,
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 0' }}>
          <span style={{
            fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8,
          }}>
            {deck.name}
          </span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 999,
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.inkMute, flexShrink: 0,
          }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ height: 1, background: T.lineSoft, margin: '10px 18px 0' }} />

        {/* Menu */}
        {view === 'menu' && (
          <div style={{ padding: '6px 0 12px' }}>
            {!isCaptures(deck.id) && actionRow(() => setView('rename'),
              <Icon name="pen"       size={18} strokeWidth={1.8} color={T.inkSoft} />, 'Rename')}
            {!isCaptures(deck.id) && actionRow(handleExport,
              <Icon name="download"  size={18} strokeWidth={1.8} color={T.inkSoft} />, busy ? 'Exporting…' : 'Export as JSON')}
            {!isCaptures(deck.id) && actionRow(handleShare,
              <Icon name="share"     size={18} strokeWidth={1.8} color={T.inkSoft} />, 'Share')}
            {actionRow(handleIncludeToggle,
              <Icon name="check" size={18} strokeWidth={1.8} color={deck.include_in_review ? T.sage : T.inkFaint} />,
              deck.include_in_review ? 'In "Review all"' : 'Excluded from "Review all"')}
            <div style={{ height: 1, background: T.lineSoft, margin: '4px 18px' }} />
            {actionRow(() => setView('reset'),
              <Icon name="rotate-ccw" size={18} strokeWidth={1.8} color={T.crimson} />, 'Reset progress', true)}
            {!isCaptures(deck.id) && actionRow(() => setView('delete'),
              <Icon name="trash" size={18} strokeWidth={1.8} color={T.crimson} />, 'Delete collection', true)}
          </div>
        )}

        {/* Rename */}
        {view === 'rename' && (
          <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label htmlFor="deck-rename-input" style={labelStyle}>New name</label>
            <input
              id="deck-rename-input"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
              placeholder="Collection name"
              style={{
                display: 'block', width: '100%', padding: '12px 14px',
                borderRadius: 10, background: T.paperHi, border: `1px solid ${T.line}`,
                fontSize: 16, color: T.ink, fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('menu')} style={{
                flex: 1, height: 46, borderRadius: 12,
                border: `1px solid ${T.lineSoft}`, background: T.paperHi,
                color: T.inkSoft, fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}>Cancel</button>
              <button
                onClick={handleRename}
                disabled={busy || !name.trim()}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: T.crimson, color: '#fff',
                  fontSize: 15, fontWeight: 600,
                  cursor: busy || !name.trim() ? 'default' : 'pointer',
                  opacity: busy || !name.trim() ? 0.6 : 1,
                }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Reset confirm */}
        {view === 'reset' && (
          <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: T.inkSoft, lineHeight: 1.55 }}>
              Reset all cards in <strong style={{ color: T.ink }}>{deck.name}</strong> back to New?
              Scheduling and review history will both be erased. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('menu')} style={{
                flex: 1, height: 46, borderRadius: 12,
                border: `1px solid ${T.lineSoft}`, background: T.paperHi,
                color: T.inkSoft, fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}>Cancel</button>
              <button
                onClick={handleReset}
                disabled={busy}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: T.crimson, color: '#fff',
                  fontSize: 15, fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Resetting…' : 'Reset'}
              </button>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {view === 'delete' && (
          <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: T.inkSoft, lineHeight: 1.55 }}>
              Permanently delete <strong style={{ color: T.ink }}>{deck.name}</strong> and all{' '}
              {deck.card_count} cards? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('menu')} style={{
                flex: 1, height: 46, borderRadius: 12,
                border: `1px solid ${T.lineSoft}`, background: T.paperHi,
                color: T.inkSoft, fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={busy}
                style={{
                  flex: 2, height: 46, borderRadius: 12, border: 'none',
                  background: T.crimson, color: '#fff',
                  fontSize: 15, fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
