'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useLang } from '@/lib/context/LangDialectProvider'
import { createItem } from '@/lib/db/notebook/items'
import { createClient } from '@/lib/supabase/client'
import { getLanguage } from '@/lib/languages'

// ── IndiHunt Import Format v1 ─────────────────────────────────────────────────
// Extension encoding: btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
// Hash format:        #v1:<base64>
// Language codes:     short codes ('ami', 'tay', …); NLLB suffixes stripped if present
// Max items:          200 per batch (excess trimmed with warning)

interface ImportItem {
  ab: string
  zh?: string
  type?: 'word' | 'sentence' | 'note'
  language: string
  dialect?: string
  audio?: string
  notes?: string
  tags?: string[]
}

interface ImportPayload {
  version: 1
  source: string
  exportedAt?: string
  items: ImportItem[]
}

const MAX_ITEMS = 200

// ── Helpers ───────────────────────────────────────────────────────────────────

function normLang(code: string): string {
  return code.replace(/_[A-Z][a-z]{3}$/, '').toLowerCase()
}

function langName(code: string): string {
  return getLanguage(normLang(code))?.name ?? code
}

function decodeHash(hash: string): { ok: true; payload: ImportPayload } | { ok: false; empty: boolean } {
  if (!hash || hash === '#') return { ok: false, empty: true }
  if (!hash.startsWith('#v1:')) return { ok: false, empty: true }
  try {
    const b64 = hash.slice(4)
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const obj = JSON.parse(json)
    if (obj.version !== 1 || !Array.isArray(obj.items)) return { ok: false, empty: false }
    return { ok: true, payload: obj as ImportPayload }
  } catch {
    return { ok: false, empty: false }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'empty' | 'error' | 'unauth' | 'checking' | 'ready' | 'importing' | 'done'

export default function ImportPage() {
  const router = useRouter()
  const { lang, dialectLabel } = useLang()

  const [pageState,       setPageState]       = useState<PageState>('loading')
  const [payload,         setPayload]         = useState<ImportPayload | null>(null)
  const [trimmed,         setTrimmed]         = useState(false)
  const [dupKeys,         setDupKeys]         = useState<Set<string>>(new Set())
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [result,          setResult]          = useState<{ imported: number; skipped: number } | null>(null)

  // Parse hash
  useEffect(() => {
    const decoded = decodeHash(window.location.hash)
    if (!decoded.ok) {
      setPageState(decoded.empty ? 'empty' : 'error')
      return
    }
    let items = decoded.payload.items.filter(i => i.ab?.trim())
    const wasTrimmed = items.length > MAX_ITEMS
    if (wasTrimmed) items = items.slice(0, MAX_ITEMS)
    setTrimmed(wasTrimmed)
    setPayload({ ...decoded.payload, items })
    setPageState('checking')
  }, [])

  // Dedup check — also initialises selection (all non-dup indices selected)
  useEffect(() => {
    if (pageState !== 'checking' || !payload) return
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPageState('unauth'); return }

      const abs   = [...new Set(payload!.items.map(i => i.ab))]
      const langs = [...new Set(payload!.items.map(i => normLang(i.language)))]

      const { data } = await supabase
        .from('ind_items')
        .select('ab, language')
        .eq('user_id', user.id)
        .in('ab', abs)
        .in('language', langs)

      const keys = new Set<string>()
      for (const row of (data ?? [])) keys.add(`${row.language}:${row.ab}`)
      setDupKeys(keys)

      // Select all non-duplicate items by default
      const sel = new Set<number>()
      payload!.items.forEach((item, i) => {
        if (!keys.has(`${normLang(item.language)}:${item.ab}`)) sel.add(i)
      })
      setSelectedIndices(sel)
      setPageState('ready')
    }
    check()
  }, [pageState, payload])

  const items    = payload?.items ?? []
  const dupCount = items.filter(i => dupKeys.has(`${normLang(i.language)}:${i.ab}`)).length

  function toggleIndex(i: number) {
    setSelectedIndices(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function handleImport() {
    if (!selectedIndices.size || pageState === 'importing') return
    setPageState('importing')
    let imported = 0
    for (let i = 0; i < items.length; i++) {
      if (!selectedIndices.has(i)) continue
      const item = items[i]
      const r = await createItem({
        ab:          item.ab.trim(),
        zh:          item.zh?.trim() || undefined,
        type:        item.type ?? 'word',
        language:    normLang(item.language),
        dialect:     item.dialect,
        audio:       item.audio,
        notes:       item.notes?.trim() || undefined,
        tags:        item.tags?.length ? item.tags : undefined,
        note_source: 'import',
      })
      if (r) imported++
    }
    setResult({ imported, skipped: items.length - imported })
    setPageState('done')
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Import" langName={lang.name} langDialect={dialectLabel} />

      {(pageState === 'loading' || pageState === 'checking') && <CheckingState />}
      {pageState === 'empty'   && <EmptyState />}
      {pageState === 'error'   && <ErrorState />}
      {pageState === 'unauth'  && <UnauthState onSignIn={() => router.push('/login')} />}
      {pageState === 'done' && result && (
        <DoneState result={result} onStudy={() => router.push('/study')} />
      )}
      {(pageState === 'ready' || pageState === 'importing') && payload && (
        <PreviewState
          payload={payload}
          items={items}
          dupKeys={dupKeys}
          selectedIndices={selectedIndices}
          dupCount={dupCount}
          trimmed={trimmed}
          importing={pageState === 'importing'}
          onToggle={toggleIndex}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

// ── States ────────────────────────────────────────────────────────────────────

function CheckingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
      {[240, 180, 200, 160].map(w => (
        <div key={w} className="animate-iv-shimmer" style={{ height: 13, width: w, borderRadius: 6, background: T.lineSoft }} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <Icon name="download" size={38} color={T.inkFaint} strokeWidth={1.2} />
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 21, color: T.ink, fontStyle: 'italic' }}>
        Nothing to import
      </div>
      <div style={{ fontSize: 13.5, color: T.inkMute, lineHeight: 1.6, maxWidth: 290 }}>
        Open this page from the 族語魔書 extension to import vocabulary items directly into your notes.
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div style={{ padding: '12px 16px', background: T.amberBg, border: `1px solid ${T.amber}`, borderRadius: 12, fontSize: 13.5, color: T.terra, lineHeight: 1.5 }}>
      Could not read the import data. Make sure you&apos;re using a compatible version of the extension.
    </div>
  )
}

function UnauthState({ onSignIn }: Readonly<{ onSignIn: () => void }>) {
  return (
    <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <Icon name="user" size={38} color={T.inkFaint} strokeWidth={1.2} />
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 21, color: T.ink, fontStyle: 'italic' }}>
        Sign in to import
      </div>
      <div style={{ fontSize: 13.5, color: T.inkMute, lineHeight: 1.6, maxWidth: 290 }}>
        Sign in to IndiHunt, then re-open the import link from the extension.
      </div>
      <button
        onClick={onSignIn}
        style={{
          marginTop: 8, padding: '11px 32px', borderRadius: 14,
          background: T.ink, color: T.cream,
          fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
        }}
      >
        Sign in
      </button>
    </div>
  )
}

function DoneState({ result, onStudy }: { result: { imported: number; skipped: number }; onStudy: () => void }) {
  return (
    <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.sageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={26} color={T.sage} strokeWidth={2.2} />
      </div>
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, color: T.ink, fontStyle: 'italic' }}>
        {result.imported} item{result.imported !== 1 ? 's' : ''} imported
      </div>
      {result.skipped > 0 && (
        <div style={{ fontSize: 13, color: T.inkMute }}>
          {result.skipped} skipped
        </div>
      )}
      <button
        onClick={onStudy}
        style={{
          marginTop: 8, padding: '11px 32px', borderRadius: 14,
          background: T.ink, color: T.cream,
          fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
        }}
      >
        Go to Study
      </button>
    </div>
  )
}

function PreviewState({
  payload, items, dupKeys, selectedIndices, dupCount, trimmed, importing, onToggle, onImport,
}: {
  payload: ImportPayload
  items: ImportItem[]
  dupKeys: Set<string>
  selectedIndices: Set<number>
  dupCount: number
  trimmed: boolean
  importing: boolean
  onToggle: (i: number) => void
  onImport: () => void
}) {
  const selectedCount = selectedIndices.size
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function handleAudio(e: React.MouseEvent, i: number, url: string) {
    e.stopPropagation()
    if (playingIdx === i) {
      audioRef.current?.pause()
      setPlayingIdx(null)
      return
    }
    audioRef.current?.pause()
    const a = new Audio(url)
    a.onended = () => setPlayingIdx(null)
    a.play().catch(() => {})
    audioRef.current = a
    setPlayingIdx(i)
  }

  return (
    <>
      {/* Source header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          padding: '3px 9px', borderRadius: 6,
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: T.inkMute,
        }}>
          {payload.source}
        </span>
        <span style={{ fontSize: 13, color: T.inkSoft }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        {payload.exportedAt && (
          <span style={{ fontSize: 11.5, color: T.inkFaint, marginLeft: 'auto' }}>
            {new Date(payload.exportedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {trimmed && (
        <div style={{ padding: '10px 14px', background: T.amberBg, border: `1px solid ${T.amber}`, borderRadius: 10, fontSize: 12.5, color: T.terra }}>
          Import limited to first {MAX_ITEMS} items — run additional imports for the rest.
        </div>
      )}

      {/* Preview list */}
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
        {items.map((item, i) => {
          const isDup      = dupKeys.has(`${normLang(item.language)}:${item.ab}`)
          const isSelected = !isDup && selectedIndices.has(i)
          const isDeselected = !isDup && !selectedIndices.has(i)

          return (
            <div
              key={i}
              onClick={() => { if (!isDup && !importing) onToggle(i) }}
              style={{
                padding: '10px 14px',
                borderBottom: i < items.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                cursor: isDup || importing ? 'default' : 'pointer',
                opacity: isDup || isDeselected ? 0.38 : 1,
                transition: 'opacity .12s',
                userSelect: 'none',
              }}
            >
              {/* Selection indicator */}
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: isSelected ? T.sage : 'transparent',
                border: `1.5px solid ${isDup ? T.lineSoft : isSelected ? T.sage : T.inkFaint}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .12s, border-color .12s',
              }}>
                {isSelected && <Icon name="check" size={10} color="#fff" strokeWidth={2.5} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, paddingRight: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, color: T.ink, fontStyle: 'italic', flex: 1, lineHeight: 1.3 }}>
                    {item.ab}
                  </span>
                  {isDup && (
                    <span style={{ fontSize: 10.5, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint, flexShrink: 0, marginTop: 2 }}>
                      saved
                    </span>
                  )}
                </div>
                {item.zh && (
                  <span style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.4 }}>{item.zh}</span>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 1 }}>
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint }}>
                    {langName(item.language)}{item.dialect ? ` · ${item.dialect}` : ''}
                  </span>
                  {(item.type && item.type !== 'word') && (
                    <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint }}>
                      · {item.type}
                    </span>
                  )}
                  {item.tags?.map(t => (
                    <span key={t} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint }}>
                      · {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Audio button — active if URL present, greyed if not */}
              <button
                onClick={item.audio ? e => handleAudio(e, i, item.audio!) : e => e.stopPropagation()}
                style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: 8, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: playingIdx === i ? T.sageBg : 'transparent',
                  border: `1px solid ${item.audio ? (playingIdx === i ? T.sage : T.lineSoft) : T.lineSoft}`,
                  cursor: item.audio ? 'pointer' : 'default',
                  opacity: item.audio ? 1 : 0.3,
                }}
                aria-label={playingIdx === i ? 'Stop' : 'Play audio'}
              >
                <Icon name={playingIdx === i ? 'stop' : 'speaker'} size={12} strokeWidth={1.8} color={item.audio ? (playingIdx === i ? T.sage : T.inkSoft) : T.inkFaint} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Summary + action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dupCount > 0 && (
          <div style={{ fontSize: 12.5, color: T.inkMute, padding: '0 4px' }}>
            {dupCount} item{dupCount !== 1 ? 's' : ''} already in your notes — skipped.
          </div>
        )}
        {selectedCount === 0 && dupCount < items.length && (
          <div style={{ fontSize: 13, color: T.inkSoft, textAlign: 'center', padding: '4px 0' }}>
            No items selected.
          </div>
        )}
        <button
          onClick={onImport}
          disabled={selectedCount === 0 || importing}
          style={{
            padding: '13px 0', borderRadius: 14,
            background: selectedCount > 0 && !importing ? T.ink : T.lineSoft,
            color: selectedCount > 0 && !importing ? T.cream : T.inkFaint,
            fontSize: 14, fontWeight: 600, border: 'none',
            cursor: selectedCount > 0 && !importing ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background .15s',
          }}
        >
          <Icon name="download" size={14} color="currentColor" />
          {importing ? 'Importing…' : `Import ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </>
  )
}
