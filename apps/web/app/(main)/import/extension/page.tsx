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

// ── Bridge protocol ───────────────────────────────────────────────────────────
// Source: INDIVORE_OWNED_IMPORT_HANDOFF.md §4
const BRIDGE_SOURCE_IN  = 'ycm-popupdict'
const BRIDGE_SOURCE_OUT = 'indihunt'
const BRIDGE_PROTOCOL   = 'indihunt-import-bridge-v1'
const STALL_MS          = 15_000
const MAX_ITEMS         = 200

// ── Types ─────────────────────────────────────────────────────────────────────

interface BridgeItem {
  ab: string
  zh?: string
  type?: 'word' | 'sentence' | 'note'
  language: string
  dialect?: string
  place_heard?: string
  notes?: string
  target_word?: string
  tags?: string[]
  audio?: string
  audioBlobId?: string
}

interface ImportItem {
  ab: string
  zh?: string
  type?: 'word' | 'sentence' | 'note'
  language: string
  dialect?: string
  place_heard?: string
  notes?: string
  target_word?: string
  tags?: string[]
  audio?: string
  audioFailed?: boolean
}

interface ImportPayload {
  version: 1
  source: string
  exportedAt?: string
  items: ImportItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normLang(code: string): string {
  return code.replace(/_[A-Z][a-z]{3}$/, '').toLowerCase()
}

function langName(code: string): string {
  return getLanguage(normLang(code))?.name ?? code
}

function chunksToBlob(chunkMap: Map<number, string>, mimeType: string): Blob {
  const arrays = [...chunkMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, b64]) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)))
  return new Blob(arrays, { type: mimeType })
}

// ── Component ─────────────────────────────────────────────────────────────────

type PageState =
  | 'bridge-waiting'    // listener active, waiting for start message
  | 'bridge-receiving'  // items + audio chunks arriving
  | 'bridge-uploading'  // reconstructing blobs, uploading to storage
  | 'bridge-stalled'    // no messages for STALL_MS while waiting/receiving
  | 'bridge-error'
  | 'checking'          // dedup check against ind_items
  | 'ready'
  | 'importing'
  | 'done'
  | 'unauth'

export default function ImportExtensionPage() {
  const router = useRouter()
  const { lang, dialectLabel } = useLang()

  const [pageState,       setPageState]      = useState<PageState>('bridge-waiting')
  const [uploadProgress,  setUploadProgress] = useState({ done: 0, total: 0 })
  const [payload,         setPayload]        = useState<ImportPayload | null>(null)
  const [dupKeys,         setDupKeys]        = useState<Set<string>>(new Set())
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [result,          setResult]         = useState<{ imported: number; skipped: number } | null>(null)

  // Bridge accumulation — refs so message handler always sees current values
  const batchIdRef      = useRef('')
  const batchSourceRef  = useRef('ycm-popupdict')
  const batchDateRef    = useRef('')
  const itemsRef        = useRef<BridgeItem[]>([])
  const chunksRef       = useRef<Map<string, Map<number, string>>>(new Map())
  const chunkCountRef   = useRef<Map<string, number>>(new Map())
  const stallTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Stall timer ─────────────────────────────────────────────────────────────

  function armStall() {
    if (stallTimer.current) clearTimeout(stallTimer.current)
    stallTimer.current = setTimeout(() => {
      setPageState(prev =>
        prev === 'bridge-waiting' || prev === 'bridge-receiving' ? 'bridge-stalled' : prev
      )
    }, STALL_MS)
  }

  function disarmStall() {
    if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null }
  }

  // ── Bridge response helpers ──────────────────────────────────────────────────

  function sendBridge(msg: Record<string, unknown>) {
    window.postMessage(
      { source: BRIDGE_SOURCE_OUT, protocol: BRIDGE_PROTOCOL, ...msg },
      window.location.origin
    )
  }

  // ── Finish: reconstruct blobs, upload, build payload ────────────────────────

  async function handleFinish() {
    setPageState('bridge-uploading')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPageState('unauth'); return }

    const raw = itemsRef.current
    const audioItems = raw.filter(i => !!i.audioBlobId)
    const total = audioItems.length
    let done = 0
    setUploadProgress({ done: 0, total })

    const resolved = new Map<string, string | null>()

    for (const item of audioItems) {
      const id       = item.audioBlobId!
      const chunkMap = chunksRef.current.get(id)
      const expected = chunkCountRef.current.get(id) ?? 0
      let url: string | null = null

      if (chunkMap && expected > 0 && chunkMap.size === expected) {
        try {
          const blob = chunksToBlob(chunkMap, 'audio/webm')
          const path = `${user.id}/${crypto.randomUUID()}.webm`
          const { error } = await supabase.storage
            .from('ind-audio')
            .upload(path, blob, { contentType: 'audio/webm', upsert: false })
          if (!error) {
            url = supabase.storage.from('ind-audio').getPublicUrl(path).data.publicUrl
          }
        } catch { /* url stays null */ }
      }

      resolved.set(id, url)
      done++
      setUploadProgress({ done, total })
      sendBridge({
        type: 'status', batchId: batchIdRef.current,
        message: url ? 'uploaded' : 'audio-failed',
        done, total,
      })
    }

    const finalItems: ImportItem[] = raw.map(item => {
      const { audioBlobId: _id, ...rest } = item
      if (!_id) return rest
      const url = resolved.get(_id)
      return url ? { ...rest, audio: url } : { ...rest, audioFailed: true }
    })

    setPayload({
      version:    1,
      source:     batchSourceRef.current,
      exportedAt: batchDateRef.current || undefined,
      items:      finalItems,
    })
    setPageState('checking')
  }

  // ── Message handler — always-fresh via ref forwarding ────────────────────────

  // Keep a ref to the handler so the stable listener always calls the latest closure
  const handlerRef = useRef<(e: MessageEvent) => void>(() => {})

  handlerRef.current = (event: MessageEvent) => {
    const d = event.data
    if (d?.source !== BRIDGE_SOURCE_IN || d?.protocol !== BRIDGE_PROTOCOL) return

    switch (d.type as string) {
      case 'start': {
        batchIdRef.current     = d.batchId ?? ''
        batchSourceRef.current = 'ycm-popupdict'
        batchDateRef.current   = d.exportedAt ?? ''
        itemsRef.current       = []
        chunksRef.current      = new Map()
        chunkCountRef.current  = new Map()
        setPageState('bridge-receiving')
        armStall()
        sendBridge({ type: 'ready', batchId: d.batchId })
        break
      }
      case 'item': {
        if (d.batchId !== batchIdRef.current) return
        armStall()
        if (itemsRef.current.length < MAX_ITEMS) {
          itemsRef.current.push(d.item as BridgeItem)
        }
        break
      }
      case 'audio-chunk': {
        if (d.batchId !== batchIdRef.current) return
        armStall()
        const { audioBlobId, chunkIndex, chunkCount, base64 } = d as {
          audioBlobId: string; chunkIndex: number; chunkCount: number; base64: string
        }
        if (!chunksRef.current.has(audioBlobId)) chunksRef.current.set(audioBlobId, new Map())
        chunksRef.current.get(audioBlobId)!.set(chunkIndex, base64)
        chunkCountRef.current.set(audioBlobId, chunkCount)
        break
      }
      case 'finish': {
        if (d.batchId !== batchIdRef.current) return
        disarmStall()
        handleFinish()
        break
      }
    }
  }

  useEffect(() => {
    function listener(e: MessageEvent) { handlerRef.current(e) }
    window.addEventListener('message', listener)
    armStall()
    return () => {
      window.removeEventListener('message', listener)
      disarmStall()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dedup check — same logic as /import page ─────────────────────────────────

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

      const sel = new Set<number>()
      payload!.items.forEach((item, i) => {
        if (!keys.has(`${normLang(item.language)}:${item.ab}`)) sel.add(i)
      })
      setSelectedIndices(sel)
      setPageState('ready')
    }
    check()
  }, [pageState, payload])

  // ── Import ───────────────────────────────────────────────────────────────────

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
        place_heard: item.place_heard || undefined,
        target_word: item.target_word || undefined,
        note_source: 'import',
      })
      if (r) imported++
    }
    setResult({ imported, skipped: items.length - imported })
    setPageState('done')
    sendBridge({ type: 'done', batchId: batchIdRef.current })
  }

  // ── Reset after stall ────────────────────────────────────────────────────────

  function handleReset() {
    itemsRef.current      = []
    chunksRef.current     = new Map()
    chunkCountRef.current = new Map()
    batchIdRef.current    = ''
    setPayload(null)
    setPageState('bridge-waiting')
    armStall()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Import" langName={lang.name} langDialect={dialectLabel} />

      {pageState === 'bridge-waiting'   && <BridgeWaitingState />}
      {pageState === 'bridge-receiving' && <BridgeReceivingState />}
      {pageState === 'bridge-uploading' && <BridgeUploadingState progress={uploadProgress} />}
      {pageState === 'bridge-stalled'   && <BridgeStalledState onReset={handleReset} />}
      {pageState === 'bridge-error'     && <BridgeErrorState />}
      {pageState === 'checking'         && <CheckingState />}
      {pageState === 'unauth'           && <UnauthState onSignIn={() => router.push('/login')} />}
      {pageState === 'done' && result   && (
        <DoneState result={result} onStudy={() => router.push('/study')} />
      )}
      {(pageState === 'ready' || pageState === 'importing') && payload && (
        <PreviewState
          payload={payload}
          items={items}
          dupKeys={dupKeys}
          selectedIndices={selectedIndices}
          dupCount={dupCount}
          importing={pageState === 'importing'}
          onToggle={toggleIndex}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

// ── Bridge-specific states ────────────────────────────────────────────────────

function BridgeWaitingState() {
  return (
    <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <Icon name="download" size={38} color={T.inkFaint} strokeWidth={1.2} />
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 21, color: T.ink, fontStyle: 'italic' }}>
        Waiting for extension
      </div>
      <div style={{ fontSize: 13.5, color: T.inkMute, lineHeight: 1.6, maxWidth: 290 }}>
        Export from the 族語魔書 companion to send items here.
      </div>
    </div>
  )
}

function BridgeReceivingState() {
  return (
    <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 13.5, color: T.inkMute }}>Receiving from extension…</div>
    </div>
  )
}

function BridgeUploadingState({ progress }: { progress: { done: number; total: number } }) {
  const label = progress.total > 0 ? `${progress.done} / ${progress.total}` : '…'
  return (
    <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 13.5, color: T.inkMute }}>
        Uploading audio {label}
      </div>
    </div>
  )
}

function BridgeStalledState({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ padding: '12px 16px', background: T.amberBg, border: `1px solid ${T.amber}`, borderRadius: 12, fontSize: 13.5, color: T.terra, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>No data received from the extension. The export may have been interrupted.</div>
      <button
        onClick={onReset}
        style={{ alignSelf: 'flex-start', fontSize: 13, color: T.terra, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
      >
        Reset and try again
      </button>
    </div>
  )
}

function BridgeErrorState() {
  return (
    <div style={{ padding: '12px 16px', background: T.amberBg, border: `1px solid ${T.amber}`, borderRadius: 12, fontSize: 13.5, color: T.terra, lineHeight: 1.5 }}>
      An error occurred with the import bridge. Close this tab and try again from the extension.
    </div>
  )
}

// ── Shared states (mirrors /import page) ─────────────────────────────────────

function CheckingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
      {[240, 180, 200, 160].map(w => (
        <div key={w} className="animate-iv-shimmer" style={{ height: 13, width: w, borderRadius: 6, background: T.lineSoft }} />
      ))}
    </div>
  )
}

function UnauthState({ onSignIn }: { onSignIn: () => void }) {
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
        <div style={{ fontSize: 13, color: T.inkMute }}>{result.skipped} skipped</div>
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

// ── PreviewState ──────────────────────────────────────────────────────────────

function PreviewState({
  payload, items, dupKeys, selectedIndices, dupCount, importing, onToggle, onImport,
}: {
  payload: ImportPayload
  items: ImportItem[]
  dupKeys: Set<string>
  selectedIndices: Set<number>
  dupCount: number
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

      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
        {items.map((item, i) => {
          const isDup       = dupKeys.has(`${normLang(item.language)}:${item.ab}`)
          const isSelected  = !isDup && selectedIndices.has(i)
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
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: isSelected ? T.sage : 'transparent',
                border: `1.5px solid ${isDup ? T.lineSoft : isSelected ? T.sage : T.inkFaint}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .12s, border-color .12s',
              }}>
                {isSelected && <Icon name="check" size={10} color="#fff" strokeWidth={2.5} />}
              </div>

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
                  {item.type && item.type !== 'word' && (
                    <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint }}>
                      · {item.type}
                    </span>
                  )}
                  {item.audioFailed && (
                    <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.amber }}>
                      · audio failed
                    </span>
                  )}
                  {item.tags?.map(t => (
                    <span key={t} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: T.inkFaint }}>
                      · {t}
                    </span>
                  ))}
                </div>
              </div>

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
                <Icon
                  name={playingIdx === i ? 'stop' : 'speaker'}
                  size={12} strokeWidth={1.8}
                  color={item.audio ? (playingIdx === i ? T.sage : T.inkSoft) : T.inkFaint}
                />
              </button>
            </div>
          )
        })}
      </div>

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
