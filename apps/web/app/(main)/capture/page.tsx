'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Button, SectionHead, Icon, Toast } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useActiveLang } from '@/lib/hooks/useActiveLang'
import { createItem, updateItem, listItems, type Item, type ItemType } from '@/lib/db/items'
import { createClient } from '@/lib/supabase/client'
import { incrementCapturedToday } from '@/lib/db/stats'
import { listSources, createSource, type Source } from '@/lib/db/sources'
import { listSpeakers, createSpeaker, type Speaker } from '@/lib/db/speakers'
import { LANGUAGES } from '@/lib/languages'
import { GLID_FAMILIES, DIALECT_TO_EN } from '@/lib/learn/dialects'
import { getGlid } from '@/lib/learn/lang-bridge'
import InlineSelector from '@/components/capture/InlineSelector'
import BatchImport from '@/components/capture/BatchImport'

type LookupRow    = { word_ab: string; word_ch: string; dialect_name: string; vocab_source: string }
type LookupResult = { token: string; rows: LookupRow[] }

function cleanToken(t: string): string {
  return t.replace(/^[^a-zA-ZÀ-ÿ']+|[^a-zA-ZÀ-ÿ']+$/g, '').toLowerCase()
}

function displayToken(t: string): string {
  return t.replace(/^[^a-zA-ZÀ-ÿ']+|[^a-zA-ZÀ-ÿ']+$/g, '')
}

function typeColor(t: string) {
  if (t === 'word')     return { color: T.crimson, bg: T.crimsonBg, border: '#EFCAB8' }
  if (t === 'sentence') return { color: T.sage,    bg: T.sageBg,    border: '#D2D8AE' }
  return                       { color: T.amber,   bg: T.amberBg,   border: '#EBD49A' }
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 9,
  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}

const headerBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 999,
  background: T.paperHi, border: `1px solid ${T.line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: T.inkSoft, flexShrink: 0, cursor: 'pointer', textDecoration: 'none',
}

function CapturePageInner() {
  const { lang, dialect: profileDialect, dialectLabel } = useActiveLang()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)

  // Form state
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editingType, setEditingType] = useState<ItemType>('sentence')
  const [text,    setText]    = useState(searchParams.get('text')  ?? '')
  const [meaning, setMeaning] = useState('')
  const [dialect, setDialect] = useState('')
  const [place,   setPlace]   = useState('')
  const [notes,   setNotes]   = useState(searchParams.get('notes') ?? '')

  // Lookup
  const [lookedUp,       setLookedUp]       = useState(false)
  const [lookupLoading,  setLookupLoading]  = useState(false)
  const [lookupResults,  setLookupResults]  = useState<LookupResult[]>([])
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set())

  // Audio recording
  const [recording,    setRecording]    = useState(false)
  const [hasRecording, setHasRecording] = useState(false)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [playing,      setPlaying]      = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const audioBlobUrlRef  = useRef<string | null>(null)
  const discardingRef    = useRef(false)
  const audioRef         = useRef<HTMLAudioElement | null>(null)

  // AI hint (meaning section)
  const [showAiHint, setShowAiHint] = useState(false)

  // Selectors
  const [sources,         setSources]         = useState<Source[]>([])
  const [speakers,        setSpeakers]        = useState<Speaker[]>([])
  const [selectedSource,  setSelectedSource]  = useState<Source | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)

  // Batch import
  const [batchOpen, setBatchOpen] = useState(false)

  // Recent captures filter
  const [captureFilter, setCaptureFilter] = useState<string | null>(null)
  const [filterOpen,    setFilterOpen]    = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Feedback
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error,    setError]    = useState(false)

  const [recentItems, setRecentItems] = useState<Item[]>([])

  // Dialect options for current language
  const dialectInitRef = useRef(false)
  const glid = getGlid(lang.code) ?? '01'
  const langDialects = GLID_FAMILIES[glid] ?? []

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
    listSources().then(setSources)
    listSpeakers().then(setSpeakers)
  }, [])

  // Default dialect to profile value once loaded (one-time init)
  useEffect(() => {
    if (profileDialect && !dialectInitRef.current) {
      dialectInitRef.current = true
      setDialect(profileDialect)
    }
  }, [profileDialect])

  // Default filter to active language once profile loads
  useEffect(() => {
    if (lang.code && captureFilter === null) setCaptureFilter(lang.code)
  }, [lang.code, captureFilter])

  // Refetch when filter changes
  useEffect(() => {
    if (captureFilter === null) return
    const language = captureFilter === 'all' ? undefined : captureFilter
    listItems({ limit: 5, language }).then(setRecentItems)
  }, [captureFilter])

  // Close filter dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // ── Lookup ──────────────────────────────────────────────────────────────
  async function handleLookup() {
    if (lookedUp) {
      setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set())
      return
    }
    if (!text.trim()) return

    const seen = new Set<string>()
    const deduped = text.trim().split(/\s+/).filter(tok => {
      const c = cleanToken(tok)
      if (!c || seen.has(c)) return false
      seen.add(c)
      return true
    })
    if (!deduped.length) return

    setLookedUp(true)
    setLookupLoading(true)
    setLookupResults([])
    setExpandedTokens(new Set())

    // Prioritize results matching current dialect if one is set
    const results = await Promise.all(deduped.map(async tok => {
      try {
        const r = await fetch(`/api/lookup?word=${encodeURIComponent(cleanToken(tok))}`)
        const d = await r.json() as { results: LookupRow[] }
        let rows = d.results ?? []
        if (dialect && rows.length > 1) {
          rows = [...rows].sort((a, b) =>
            a.dialect_name === dialect ? -1 : b.dialect_name === dialect ? 1 : 0
          )
        }
        return { token: tok, rows }
      } catch {
        return { token: tok, rows: [] }
      }
    }))

    setLookupResults(results)
    setLookupLoading(false)
  }

  // ── Audio recording ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (discardingRef.current) { discardingRef.current = false; return }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current)
        audioBlobUrlRef.current = URL.createObjectURL(blob)
        setAudioBlobUrl(audioBlobUrlRef.current)
        setHasRecording(true)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      // Mic permission denied or MediaRecorder unavailable
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  function discardRecording() {
    discardingRef.current = true
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    if (audioBlobUrlRef.current) { URL.revokeObjectURL(audioBlobUrlRef.current); audioBlobUrlRef.current = null }
    setRecording(false)
    setHasRecording(false)
    setAudioBlobUrl(null)
    setPlaying(false)
  }

  function togglePlayback() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  // ── Form helpers ─────────────────────────────────────────────────────────
  function loadItem(item: Item) {
    setEditingId(item.id)
    setEditingType(item.type as ItemType)
    setText(item.text)
    setMeaning(item.meaning ?? '')
    setDialect(item.dialect ?? '')
    setPlace(item.place_heard ?? '')
    setNotes(item.notes ?? '')
    setSelectedSource(sources.find(s => s.id === item.source_id) ?? null)
    setSelectedSpeaker(speakers.find(s => s.id === item.speaker_id) ?? null)
    setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleClear() {
    setEditingId(null); setText(''); setMeaning(''); setDialect(''); setPlace(''); setNotes('')
    setSelectedSource(null); setSelectedSpeaker(null)
    setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set())
    discardRecording()
  }

  function softClear() {
    setEditingId(null); setText(''); setMeaning(''); setNotes('')
    setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set())
    discardRecording()
  }

  function refetchRecent() {
    const language = captureFilter === 'all' ? undefined : (captureFilter ?? lang.code)
    listItems({ limit: 5, language }).then(setRecentItems)
  }

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)

    // Upload audio to Supabase Storage if a recording is present
    let audioUrl: string | undefined = undefined
    if (hasRecording && audioBlobUrl && userId) {
      try {
        const supabase = createClient()
        const resp = await fetch(audioBlobUrl)
        const blob = await resp.blob()
        const path = `${userId}/${Date.now()}.webm`
        const { data: up, error: upErr } = await supabase.storage
          .from('ind-audio')
          .upload(path, blob, { contentType: 'audio/webm' })
        if (!upErr && up) {
          const { data: { publicUrl } } = supabase.storage.from('ind-audio').getPublicUrl(up.path)
          audioUrl = publicUrl
        }
      } catch (e) { console.error('audio upload:', e) }
    }

    const payload = {
      text:        text.trim(),
      meaning:     meaning.trim() || undefined,
      type:        editingId ? editingType : 'sentence' as ItemType,
      language:    lang.code,
      dialect:     dialect.trim() || undefined,
      place_heard: place.trim() || undefined,
      notes:       notes.trim() || undefined,
      source_id:   selectedSource?.id,
      speaker_id:  selectedSpeaker?.id,
      audio_url:   audioUrl,
    }

    let ok = false
    if (editingId) {
      ok = await updateItem(editingId, payload)
    } else {
      const item = await createItem(payload)
      ok = !!item
      if (item && userId) await incrementCapturedToday(userId)
    }

    setSaving(false)
    if (!ok) { setError(true); setTimeout(() => setError(false), 2500); return }

    setSavedMsg(editingId ? 'Updated' : 'Saved to your notebook')
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    refetchRecent()
    softClear()
  }

  const filterLabel = captureFilter === 'all'
    ? 'All'
    : (LANGUAGES.find(l => l.code === (captureFilter ?? lang.code))?.name ?? '—')

  return (
    <div style={{ padding: '4px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        title="Capture"
        langName={lang.name}
        langDialect={dialectLabel}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setBatchOpen(true)} aria-label="Batch import" style={headerBtnStyle}>
              <Icon name="download" size={17} strokeWidth={1.6} />
            </button>
            <Link href="/settings" aria-label="Settings" style={headerBtnStyle}>
              <Icon name="settings" size={17} strokeWidth={1.6} />
            </Link>
          </div>
        }
      />

      {/* Editing banner */}
      {editingId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: T.amberBg, border: `1px solid ${T.amber}`,
          fontSize: 12.5, color: T.inkSoft,
        }}>
          <Icon name="pen" size={14} color={T.amber} strokeWidth={2} />
          <span style={{ flex: 1 }}>Editing saved item</span>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkFaint, padding: 0 }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Main input card */}
      <div style={{
        background: T.paperHi, border: `1.5px solid ${editingId ? T.amber : T.line}`,
        borderRadius: 18, padding: '16px 16px 12px',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.03)',
      }}>
        {/* Ab text area */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="A word, sentence, or note you want to keep…"
          rows={3}
          style={{
            width: '100%', border: 0, background: 'transparent', resize: 'none',
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 20, fontWeight: 400, color: T.ink,
            letterSpacing: '-0.015em', lineHeight: 1.35, outline: 'none',
          }}
        />

        {/* Ab area footer: [trash? | play?] [mic/stop] [lookup] — all right-aligned */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 6 }}>
          {hasRecording && (
            <button
              onClick={discardRecording}
              aria-label="Discard recording"
              style={{ ...iconBtn, color: T.crimson, borderColor: '#EFCAB8', background: T.crimsonBg }}
            >
              <Icon name="trash" size={14} strokeWidth={1.8} color={T.crimson} />
            </button>
          )}
          {hasRecording && (
            <button
              onClick={togglePlayback}
              aria-label={playing ? 'Stop playback' : 'Play recording'}
              style={{ ...iconBtn, color: T.sage, borderColor: '#D2D8AE', background: T.sageBg }}
            >
              <Icon name={playing ? 'x' : 'play'} size={14} strokeWidth={1.8} color={T.sage} />
            </button>
          )}
          <button
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? 'Stop recording' : hasRecording ? 'Re-record' : 'Record audio'}
            style={{
              ...iconBtn,
              color:       recording ? T.crimson : hasRecording ? T.sage : T.inkSoft,
              borderColor: recording ? T.crimson : hasRecording ? '#D2D8AE' : T.lineSoft,
              background:  recording ? T.crimsonBg : hasRecording ? T.sageBg : T.paper,
            }}
          >
            <Icon
              name={recording ? 'stop' : 'mic'}
              size={15} strokeWidth={1.8}
              color={recording ? T.crimson : hasRecording ? T.sage : T.inkSoft}
            />
          </button>
          <button
            onClick={handleLookup}
            aria-label="Lookup words"
            style={{
              ...iconBtn,
              color:       lookedUp ? T.crimson : T.inkSoft,
              borderColor: lookedUp ? T.crimson : T.lineSoft,
              background:  lookedUp ? T.crimsonBg : T.paper,
            }}
          >
            <Icon name="search" size={15} strokeWidth={1.8} color={lookedUp ? T.crimson : T.inkSoft} />
          </button>
        </div>

        <div style={{ height: 1, background: T.lineSoft, margin: '10px 0 8px' }} />

        {/* Meaning / translation */}
        <textarea
          value={meaning}
          onChange={e => setMeaning(e.target.value)}
          placeholder="Meaning or translation…"
          rows={2}
          style={{
            width: '100%', border: 0, background: 'transparent', resize: 'none',
            fontFamily: 'inherit', fontSize: 14, color: T.inkSoft,
            lineHeight: 1.4, outline: 'none',
          }}
        />

        {/* Meaning footer: AI hint text inline left of sparkle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {showAiHint && (
            <span style={{ fontSize: 12, color: T.inkMute, fontStyle: 'italic' }}>
              AI translation coming soon ✨
            </span>
          )}
          <button
            onClick={() => setShowAiHint(v => !v)}
            aria-label="AI translation"
            style={{
              ...iconBtn,
              color:       showAiHint ? T.amber : T.inkSoft,
              borderColor: showAiHint ? T.amber : T.lineSoft,
              background:  showAiHint ? T.amberBg : T.paper,
            }}
          >
            <Icon name="sparkle" size={15} strokeWidth={1.8} color={showAiHint ? T.amber : T.inkSoft} />
          </button>
        </div>
      </div>

      {/* Hidden audio element for playback */}
      {audioBlobUrl && (
        <audio ref={audioRef} src={audioBlobUrl} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
      )}

      {/* Lookup placeholder — shown when text is empty and lookup is closed */}
      {!lookedUp && !text.trim() && (
        <div style={{ textAlign: 'center', fontSize: 12, color: T.inkFaint, fontStyle: 'italic', padding: '2px 0' }}>
          Enter words in {lang.name} to display their definition below
        </div>
      )}

      {/* Lookup results — shown below input card when active */}
      {lookedUp && (
        <div className="animate-iv-rise">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 4px', marginBottom: 8,
          }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              fontWeight: 500, color: T.inkMute,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Definitions
            </span>
            <button
              onClick={() => { setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set()) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <Icon name="x" size={15} color={T.inkFaint} strokeWidth={2} />
            </button>
          </div>

          {lookupLoading ? (
            <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: T.inkFaint }}>
              Looking up…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lookupResults.map(({ token, rows }) => {
                const disp = displayToken(token)
                const isExpanded = expandedTokens.has(token)
                const visible = isExpanded ? rows : rows.slice(0, 1)
                return (
                  <div key={token} style={{
                    padding: '10px 14px', background: T.paperHi,
                    border: `1px solid ${T.lineSoft}`, borderRadius: 12,
                  }}>
                    <span style={{
                      fontFamily: 'Newsreader, Georgia, serif',
                      fontSize: 15, fontWeight: 500, color: T.ink,
                    }}>
                      {disp}
                    </span>
                    {rows.length > 0 ? (
                      <div style={{ marginTop: 5 }}>
                        {visible.map((r, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'baseline', gap: 8,
                            marginBottom: i < visible.length - 1 ? 3 : 0,
                          }}>
                            <span style={{ fontSize: 13, color: T.inkSoft, flex: 1 }}>{r.word_ch}</span>
                            <span style={{
                              fontSize: 10, color: T.inkFaint,
                              fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
                            }}>
                              {r.dialect_name}
                            </span>
                          </div>
                        ))}
                        {rows.length > 1 && (
                          <button
                            onClick={() => setExpandedTokens(prev => {
                              const n = new Set(prev)
                              if (n.has(token)) n.delete(token); else n.add(token)
                              return n
                            })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              marginTop: 5, background: 'none', border: 'none',
                              cursor: 'pointer', padding: 0,
                              fontSize: 11, color: T.inkFaint, fontFamily: 'inherit',
                            }}
                          >
                            <Icon name="chevron" size={11} strokeWidth={2} color={T.inkFaint}
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                            {isExpanded ? 'less' : `+${rows.length - 1} more`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: 3, fontSize: 12, color: T.inkFaint, fontStyle: 'italic' }}>
                        not found
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Context metadata */}
      <div>
        <SectionHead title="Context" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="bookmark" label="Source"
              options={sources} selected={selectedSource}
              onSelect={opt => setSelectedSource(opt as Source | null)}
              onCreate={async name => {
                const s = await createSource(name, lang.code)
                if (s) setSources(p => [...p, s])
                return s
              }}
            />
          </div>
          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="user" label="Speaker"
              options={speakers} selected={selectedSpeaker}
              onSelect={opt => setSelectedSpeaker(opt as Speaker | null)}
              onCreate={async name => {
                const s = await createSpeaker(name)
                if (s) setSpeakers(p => [...p, s])
                return s
              }}
            />
          </div>

          {/* Dialect — select from known dialects for the current language */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="wave" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Dialect</span>
            <select
              value={dialect}
              onChange={e => setDialect(e.target.value)}
              style={{
                flex: 1, border: 0, background: 'transparent', fontSize: 14,
                fontWeight: 500, color: dialect ? T.ink : T.inkFaint,
                padding: 0, outline: 'none', cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="">(optional)</option>
              {langDialects.map(zh => (
                <option key={zh} value={zh}>{DIALECT_TO_EN[zh] ?? zh}</option>
              ))}
              {/* Show current value as option if it's not in the standard list (legacy free-text) */}
              {dialect && !langDialects.includes(dialect) && (
                <option value={dialect}>{dialect}</option>
              )}
            </select>
            <Icon name="chev-d" size={14} color={T.inkFaint} strokeWidth={1.8}
              style={{ flexShrink: 0, pointerEvents: 'none' }} />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="pin" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Place</span>
            <input
              value={place} onChange={e => setPlace(e.target.value)}
              placeholder="Where heard / seen"
              style={{ flex: 1, border: 0, background: 'transparent', fontSize: 14, fontWeight: 500, color: T.ink, padding: 0, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
            <Icon name="pen" size={16} color={T.inkSoft} strokeWidth={1.8} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60, paddingTop: 2 }}>Notes</span>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Anything to remember…"
              style={{
                flex: 1, border: 0, background: 'transparent', fontSize: 14,
                color: T.ink, padding: 0, resize: 'none',
                fontFamily: 'inherit', lineHeight: 1.4, outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={handleClear}>
          {editingId ? 'Cancel' : 'Clear'}
        </Button>
        <Button
          variant="primary" size="lg" icon="check"
          style={{ flex: 2 }}
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
        </Button>
      </div>

      {/* Recent captures */}
      {recentItems.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHead title="Recent" />

            {/* Language filter */}
            <div ref={filterRef} style={{ position: 'relative', paddingBottom: 12 }}>
              <button
                onClick={() => setFilterOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 11.5, color: T.inkSoft,
                }}
              >
                {filterLabel}
                <Icon name="chev-d" size={11} color={T.inkFaint} strokeWidth={2.5}
                  style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {filterOpen && (
                <div
                  className="scrollbar-thin"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% - 4px)', zIndex: 50,
                    background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(43,34,20,0.12)',
                    minWidth: 140, maxHeight: 260, overflowY: 'auto',
                  }}
                >
                  {([{ code: 'all', name: 'All' } as { code: string; name: string }]).concat(LANGUAGES).map(l => {
                    const active = (captureFilter ?? lang.code) === l.code
                    return (
                      <button key={l.code} onClick={() => { setCaptureFilter(l.code); setFilterOpen(false) }} style={{
                        display: 'block', width: '100%', padding: '9px 14px',
                        textAlign: 'left', fontSize: 13, fontFamily: 'inherit',
                        color: active ? T.crimson : T.ink,
                        fontWeight: active ? 600 : 400,
                        background: 'none', border: 'none', cursor: 'pointer',
                      }}>
                        {l.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentItems.map(item => {
              const isEditing = editingId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => loadItem(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: isEditing ? T.amberBg : T.paperHi,
                    border: `1px solid ${isEditing ? T.amber : T.lineSoft}`, borderRadius: 12,
                    textAlign: 'left', cursor: 'pointer', width: '100%',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: 'Newsreader, Georgia, serif',
                      fontSize: 14, fontWeight: 500, color: T.ink,
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.text}
                    </span>
                    {item.meaning && (
                      <span style={{
                        fontSize: 12, color: T.inkFaint, display: 'block',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}>
                        {item.meaning}
                      </span>
                    )}
                  </div>
                  <Icon name="pen" size={13} color={T.inkFaint} strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {batchOpen && (
        <BatchImport
          langCode={lang.code}
          selectedSource={selectedSource}
          onClose={() => setBatchOpen(false)}
          onImported={refetchRecent}
        />
      )}

      {saved && <Toast tone="sage">{savedMsg}</Toast>}
      {error && <Toast tone="amber">Failed to save — try again</Toast>}
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense>
      <CapturePageInner />
    </Suspense>
  )
}
