'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Button, SectionHead, Icon, Toast } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import SettingsButton from '@/components/widgets/SettingsSheet'
import { useLang } from '@/lib/context/LangDialectProvider'
import { createItem, updateItem, listItems, type Item, type ItemType } from '@/lib/db/notebook/items'
import { createClient } from '@/lib/supabase/client'
import { incrementCapturedToday } from '@/lib/db/progress/stats'
import { listSources, createSource, type Source, type CreateSourceInput } from '@/lib/db/sources/sources'
import { LANGUAGES } from '@/lib/languages'
import { isPairSupported } from '@/lib/translation-pairs'
import { GLID_FAMILIES, shortDialectLabel } from '@/lib/lang/dialects'
import { getGlid } from '@/lib/lang/lang-bridge'
import InlineSelector from '@/components/capture/InlineSelector'
import BatchImport from '@/components/capture/BatchImport'
import { getSessionUser } from '@/lib/supabase/session'

type LookupRow    = { word_ab: string; word_ch: string; dialect_name: string; vocab_source: string }
type LookupResult = { token: string; rows: LookupRow[] }

function cleanToken(t: string): string {
  return t.replace(/^[^a-zA-ZÀ-ÿ']+|[^a-zA-ZÀ-ÿ']+$/g, '').toLowerCase()
}

function displayToken(t: string): string {
  return t.replace(/^[^a-zA-ZÀ-ÿ']+|[^a-zA-ZÀ-ÿ']+$/g, '')
}


const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 9,
  background: T.paper,
  borderWidth: 1, borderStyle: 'solid' as const, borderColor: T.lineSoft,
  color: T.inkSoft,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}

const headerBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 999,
  background: T.paperHi, border: `1px solid ${T.line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: T.inkSoft, flexShrink: 0, cursor: 'pointer', textDecoration: 'none',
}

function CapturePageInner() {
  const { lang, dialect: profileDialect, dialectLabel } = useLang()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)

  // Form state
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editingType, setEditingType] = useState<ItemType>('sentence')
  const [newItemType, setNewItemType] = useState<ItemType>((searchParams.get('type') as ItemType | null) ?? 'sentence')
  const [text,    setText]    = useState(searchParams.get('text')  ?? '')
  const [meaning, setMeaning] = useState('')
  const [captureLanguage, setCaptureLanguage] = useState(searchParams.get('language') ?? '')
  const [dialect, setDialect] = useState(searchParams.get('dialect') ?? '')
  const [place,   setPlace]   = useState('')
  const [notes,   setNotes]   = useState(searchParams.get('notes') ?? '')

  // Lookup
  const [lookedUp,       setLookedUp]       = useState(false)
  const [defsOpen,       setDefsOpen]       = useState(true)
  const [lookupLoading,  setLookupLoading]  = useState(false)
  const [lookupResults,  setLookupResults]  = useState<LookupResult[]>([])
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set())
  const [stsTarget,      setStsTarget]      = useState<string | null>(null)

  // Audio recording
  const [recording,       setRecording]       = useState(false)
  const [hasRecording,    setHasRecording]    = useState(false)
  const [audioBlobUrl,    setAudioBlobUrl]    = useState<string | null>(null)
  const [playing,         setPlaying]         = useState(false)
  const [audioUploadFail, setAudioUploadFail] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const audioBlobUrlRef  = useRef<string | null>(null)
  const discardingRef    = useRef(false)
  const audioRef         = useRef<HTMLAudioElement | null>(null)

  // AI hint (meaning section)
  const [translating,    setTranslating]    = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [ttsPlaying,     setTtsPlaying]     = useState(false)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  // Selectors
  const [sources,         setSources]         = useState<Source[]>([])
  const [selectedSource,  setSelectedSource]  = useState<Source | null>(null)
  const [usedPlaces,      setUsedPlaces]      = useState<string[]>([])

  // Dialect dropdown
  const [dialectOpen, setDialectOpen] = useState(false)
  const dialectRef = useRef<HTMLDivElement>(null)

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

  const [recentItems,  setRecentItems]  = useState<Item[]>([])
  const [recentOpen,   setRecentOpen]   = useState(false)

  // Auto-lookup + tags
  const [autoLookup,    setAutoLookup]    = useState(true)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedTags,  setSelectedTags]  = useState<string[]>([])
  const [addingTag,     setAddingTag]     = useState(false)
  const [newTagInput,   setNewTagInput]   = useState('')

  // Dialect options for current language
  const dialectInitRef = useRef(searchParams.get('dialect') !== null)
  const glid = getGlid(captureLanguage || lang.code) ?? '01'
  const langDialects = GLID_FAMILIES[glid] ?? []

  useEffect(() => {
    const stored = localStorage.getItem('ind_auto_lookup')
    if (stored !== null) setAutoLookup(stored === 'true')
    const storedTags = localStorage.getItem('ind_custom_tags')
    if (storedTags) {
      try { setAvailableTags(JSON.parse(storedTags)) } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    getSessionUser().then((user) => {
      if (user) setUserId(user.id)
    })
    listSources().then(setSources)
    getSessionUser().then(async (user) => {
      if (!user) return
      const { data } = await createClient().from('ind_items').select('place_heard').eq('user_id', user.id).not('place_heard', 'is', null)
      const places = [...new Set((data ?? []).map((r: { place_heard: string }) => r.place_heard).filter(Boolean))].sort() as string[]
      setUsedPlaces(places)
    })
  }, [])

  // Default language + dialect to profile values once loaded (one-time init)
  useEffect(() => {
    if (lang.code && !captureLanguage) setCaptureLanguage(lang.code)
  }, [lang.code]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
      if (dialectRef.current && !dialectRef.current.contains(e.target as Node)) setDialectOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // ── Lookup ──────────────────────────────────────────────────────────────
  const doLookup = useCallback(async (queryText: string, auto = false) => {
    if (!queryText.trim()) return

    const seen = new Set<string>()
    const deduped = queryText.trim().split(/\s+/).filter(tok => {
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
    if (!auto) setDefsOpen(true)  // manual trigger always re-opens panel

    const results = await Promise.all(deduped.map(async tok => {
      try {
        const r = await fetch(`/api/learn/lookup?word=${encodeURIComponent(cleanToken(tok))}`)
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
  }, [dialect])

  function handleLookup() {
    if (lookedUp) {
      setLookedUp(false); setDefsOpen(true); setLookupResults([]); setExpandedTokens(new Set())
      return
    }
    setDefsOpen(true)
    doLookup(text)
  }

  // Auto-lookup debounce — passes auto=true so a user-collapsed panel stays collapsed
  useEffect(() => {
    if (!autoLookup || !text.trim()) {
      if (!text.trim()) { setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set()) }
      return
    }
    const id = setTimeout(() => doLookup(text, true), 600)
    return () => clearTimeout(id)
  }, [text, autoLookup, doLookup])

  // ── Audio recording ──────────────────────────────────────────────────────
  async function startRecording() {
    setAudioUploadFail(false)
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
    setText(item.ab)
    setMeaning(item.zh ?? '')
    setCaptureLanguage(item.language ?? lang.code)
    setDialect(item.dialect ?? '')
    setPlace(item.place_heard ?? '')
    setNotes(item.notes ?? '')
    setSelectedSource(sources.find(s => s.id === item.source_id) ?? null)
    setSelectedTags((item.tags as string[] | undefined) ?? [])
    setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleTranslate() {
    const src = `${captureLanguage || lang.code}_Latn`
    const tgt = 'zho_Hant'
    if (!text.trim()) return
    if (!isPairSupported(src, tgt)) {
      setTranslateError(`No translation available for ${LANGUAGES.find(l => l.code === (captureLanguage || lang.code))?.name ?? captureLanguage}`)
      setTimeout(() => setTranslateError(null), 3000)
      return
    }
    setTranslating(true)
    setTranslateError(null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), sourceLang: src, targetLang: tgt, dialect: dialect || undefined }),
      })
      const data = await res.json()
      if (data.error) { setTranslateError(data.error); setTimeout(() => setTranslateError(null), 3000) }
      else if (data.translation) setMeaning(data.translation)
    } catch {
      setTranslateError('Translation unavailable'); setTimeout(() => setTranslateError(null), 3000)
    } finally {
      setTranslating(false)
    }
  }

  async function handleTts() {
    if (!text.trim() || ttsPlaying) return
    setTtsPlaying(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), dialectName: dialect }),
      })
      const data = await res.json()
      if (data.url) {
        ttsAudioRef.current?.pause()
        const a = new Audio(data.url)
        ttsAudioRef.current = a
        a.onended = () => setTtsPlaying(false)
        await a.play()
      } else {
        setTtsPlaying(false)
      }
    } catch {
      setTtsPlaying(false)
    }
  }

  function handleClear() {
    setEditingId(null); setText(''); setMeaning(''); setCaptureLanguage(lang.code); setDialect(''); setPlace(''); setNotes('')
    setSelectedSource(null); setSelectedTags([]); setNewItemType('sentence')
    setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set()); setStsTarget(null)
    discardRecording()
  }

  function softClear() {
    setEditingId(null); setText(''); setMeaning(''); setNotes(''); setSelectedTags([]); setNewItemType('sentence')
    setLookedUp(false); setLookupResults([]); setExpandedTokens(new Set()); setStsTarget(null)
    discardRecording()
  }

  function addTagInline() {
    const name = newTagInput.trim()
    setNewTagInput(''); setAddingTag(false)
    if (!name || availableTags.includes(name)) return
    const next = [...availableTags, name]
    setAvailableTags(next)
    localStorage.setItem('ind_custom_tags', JSON.stringify(next))
    setSelectedTags(prev => [...prev, name])
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
        } else {
          console.error('audio upload:', upErr)
          setAudioUploadFail(true)
        }
      } catch (e) { console.error('audio upload:', e); setAudioUploadFail(true) }
    }

    const payload = {
      ab:          text.trim(),
      zh:          meaning.trim() || undefined,
      type:        editingId ? editingType : newItemType,
      language:    captureLanguage || lang.code,
      dialect:     dialect.trim() || undefined,
      place_heard: place.trim() || undefined,
      notes:       notes.trim() || undefined,
      source_id:   selectedSource?.id,
      audio:       audioUrl,
      tags:        selectedTags.length ? selectedTags : undefined,
      target_word: stsTarget ? displayToken(stsTarget) : undefined,
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

  const dialectDisplayLabel = dialect ? shortDialectLabel(dialect, glid) : null

  return (
    <div style={{ padding: '4px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        title="Capture"
        langName={lang.name}
        langDialect={dialectLabel}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/sources" aria-label="Sources" style={headerBtnStyle}>
              <Icon name="library" size={17} strokeWidth={1.6} />
            </Link>
            <button onClick={() => setBatchOpen(true)} aria-label="Batch import" style={headerBtnStyle}>
              <Icon name="download" size={17} strokeWidth={1.6} />
            </button>
            <SettingsButton initialTab="capture" />
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
          rows={2}
          style={{
            width: '100%', border: 0, background: 'transparent', resize: 'none',
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 20, fontWeight: 400, color: T.ink,
            letterSpacing: '-0.015em', lineHeight: 1.35, outline: 'none',
          }}
        />

        {/* Audio upload failure notice */}
        {audioUploadFail && (
          <div style={{ fontSize: 11.5, color: T.crimson, background: T.crimsonBg, border: `1px solid #EFCAB8`, borderRadius: 8, padding: '5px 10px', marginTop: 4 }}>
            Audio upload failed — card saved without audio. Re-record and save again.
          </div>
        )}

        {/* Ab area footer: [hint?] [trash?] [play?] [lookup] [mic] */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6, gap: 6 }}>
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
          {!recording && !autoLookup && (
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
          )}
          {(captureLanguage || lang.code) === 'ami' && (
            <button
              onClick={handleTts}
              disabled={ttsPlaying || !text.trim()}
              aria-label="Listen"
              title="Listen (TTS)"
              style={{
                ...iconBtn,
                color:       ttsPlaying ? T.amber : T.inkSoft,
                borderColor: ttsPlaying ? T.amber : T.lineSoft,
                background:  ttsPlaying ? T.amberBg : T.paper,
                opacity:     !text.trim() ? 0.4 : 1,
                cursor:      (!text.trim() || ttsPlaying) ? 'default' : 'pointer',
              }}
            >
              <Icon name="wave" size={15} strokeWidth={1.8} color={ttsPlaying ? T.amber : T.inkSoft} />
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

        {/* Meaning footer: translate button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {translateError && (
            <span style={{ fontSize: 12, color: T.terra, fontStyle: 'italic' }}>{translateError}</span>
          )}
          <button
            onClick={handleTranslate}
            disabled={translating || !text.trim()}
            aria-label="Translate to Chinese"
            title="Translate to Chinese"
            style={{
              ...iconBtn,
              color:       translating ? T.amber : T.inkSoft,
              borderColor: translating ? T.amber : T.lineSoft,
              background:  translating ? T.amberBg : T.paper,
              opacity:     !text.trim() ? 0.4 : 1,
              cursor:      (!text.trim() || translating) ? 'default' : 'pointer',
            }}
          >
            <Icon name="sparkle" size={15} strokeWidth={1.8} color={translating ? T.amber : T.inkSoft} />
          </button>
        </div>
      </div>

      {/* Hidden audio element for playback */}
      {audioBlobUrl && (
        <audio ref={audioRef} src={audioBlobUrl} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
      )}

      {/* Definitions section — header persists once lookedUp so user can re-expand */}
      {lookedUp && (
        <div className="animate-iv-rise">
          {/* Header: label + chevron toggle (stays visible when collapsed) */}
          <button
            onClick={() => setDefsOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '0 4px', marginBottom: defsOpen ? 8 : 0,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              fontWeight: 500, color: T.inkMute,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Definitions
            </span>
            <Icon name="chev-d" size={15} color={T.inkFaint} strokeWidth={2}
              style={{ transform: defsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>

          {defsOpen && (
            lookupLoading ? (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: T.inkFaint }}>
                Looking up…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lookupResults.map(({ token, rows: rawRows }) => {
                  // Deduplicate by word_ch — keep first (already sorted by dialect priority)
                  const rows = rawRows.filter((r, i, arr) => arr.findIndex(x => x.word_ch === r.word_ch) === i)
                  const disp = displayToken(token)
                  const isExpanded = expandedTokens.has(token)
                  const visible = isExpanded ? rows : rows.slice(0, 1)
                  const toggle = () => setExpandedTokens(prev => {
                    const n = new Set(prev)
                    if (n.has(token)) n.delete(token); else n.add(token)
                    return n
                  })

                  const isTarget = stsTarget === token
                  return (
                    <div
                      key={token}
                      onClick={rows.length > 1 ? toggle : undefined}
                      style={{
                        padding: '10px 14px', background: T.paperHi,
                        border: `1px solid ${isTarget ? T.amber : T.lineSoft}`, borderRadius: 12,
                        cursor: rows.length > 1 ? 'pointer' : 'default',
                      }}
                    >
                      {rows.length > 0 ? (
                        <>
                          {visible.map((r, i) => (
                            <div key={i} style={{
                              position: 'relative', display: 'flex', alignItems: 'center',
                              minHeight: 22, marginTop: i > 0 ? 3 : 0,
                            }}>
                              {/* Ab word — row 0 only, left-anchored */}
                              {i === 0 && (
                                <span style={{
                                  fontFamily: 'Newsreader, Georgia, serif',
                                  fontSize: 15, fontWeight: 500, color: isTarget ? T.amber : T.ink, flexShrink: 0,
                                }}>
                                  {disp}
                                </span>
                              )}
                              {/* Definition — truly centered vs full card width */}
                              <span style={{
                                position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                                fontSize: 13, color: T.inkSoft, whiteSpace: 'nowrap',
                              }}>
                                {r.word_ch}
                              </span>
                              {/* Right side: dialect + target dot (row 0) or dialect only */}
                              {i === 0 ? (
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                  <span style={{ fontSize: 10, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace' }}>
                                    {r.dialect_name}
                                  </span>
                                  <button
                                    onClick={e => { e.stopPropagation(); setStsTarget(p => p === token ? null : token) }}
                                    aria-label={isTarget ? 'Remove STS target' : 'Set as STS target'}
                                    style={{ width: 20, height: 20, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                                  >
                                    <div style={{ width: 9, height: 9, borderRadius: 999, border: `1.5px solid ${isTarget ? T.amber : T.lineSoft}`, background: isTarget ? T.amber : 'transparent', transition: 'all 0.15s' }} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ marginLeft: 'auto', fontSize: 10, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
                                  {r.dialect_name}
                                </span>
                              )}
                            </div>
                          ))}
                          {/* Bottom-center expand/collapse indicator */}
                          {rows.length > 1 && (
                            <div style={{
                              textAlign: 'center', marginTop: 6,
                              fontSize: 11, color: T.inkFaint,
                            }}>
                              {isExpanded ? '↑ less' : `+ ${rows.length - 1} more`}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: T.inkFaint, fontStyle: 'italic' }}>
                          {disp} — not found
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* Context metadata */}
      <div>
        <SectionHead title="Context" />
        {/* overflow: visible so dialect dropdown can overflow the card */}
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
        }}>
          {/* Language selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <Icon name="globe" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Language</span>
            <select
              value={captureLanguage}
              onChange={e => { setCaptureLanguage(e.target.value); setDialect('') }}
              style={{
                flex: 1, border: 0, background: 'transparent', fontSize: 14, fontWeight: 500,
                color: T.ink, padding: 0, outline: 'none', cursor: 'pointer',
                appearance: 'none', WebkitAppearance: 'none',
              }}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
            {captureLanguage !== lang.code && (
              <button
                onClick={() => { setCaptureLanguage(lang.code); setDialect('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkFaint, padding: 2, display: 'flex' }}
                title="Reset to profile language"
              >
                <Icon name="x" size={13} strokeWidth={2} />
              </button>
            )}
          </div>
          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="bookmark" label="Source"
              options={sources} selected={selectedSource}
              onSelect={opt => {
                const s = opt as Source | null
                setSelectedSource(s)
                if (s?.language && s.language !== captureLanguage) {
                  setCaptureLanguage(s.language)
                  setDialect(s.dialect_name ?? '')
                } else if (s?.dialect_name) {
                  setDialect(s.dialect_name)
                }
              }}
              onCreate={async name => {
                const color = Math.random().toString(16).substring(2, 8)
                const s = await createSource({
                  name, type: 'person', language: captureLanguage || lang.code,
                  dialect_name: dialect || null, location: null, url: null,
                  notes: null, avatar_color: `#${color}`,
                })
                if (s) setSources(p => [...p, s].sort((a, b) => a.name.localeCompare(b.name)))
                return s
              }}
            />
          </div>
          {/* Dialect — custom themed dropdown */}
          <div
            ref={dialectRef}
            style={{
              position: 'relative',
              borderBottom: `1px solid ${T.lineSoft}`,
            }}
          >
            <button
              onClick={() => setDialectOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', paddingRight: dialectDisplayLabel ? 40 : 14,
                width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <Icon name="wave" size={16} color={T.inkSoft} strokeWidth={1.8} />
              <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Dialect</span>
              <span style={{
                flex: 1, fontSize: 14, fontWeight: dialectDisplayLabel ? 500 : 400,
                color: dialectDisplayLabel ? T.ink : T.inkFaint,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {dialectDisplayLabel ?? '(optional)'}
              </span>
              {!dialectDisplayLabel && <Icon name="chev-d" size={14} color={T.inkFaint} />}
            </button>

            {/* Clear button — absolutely positioned sibling */}
            {dialectDisplayLabel && (
              <button
                onClick={e => { e.stopPropagation(); setDialect('') }}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                  color: T.inkFaint, display: 'flex', alignItems: 'center',
                }}
              >
                <Icon name="x" size={13} strokeWidth={2} />
              </button>
            )}

            {dialectOpen && (
              <div style={{
                position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
                background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 12,
                boxShadow: '0 4px 16px rgba(43,34,26,0.12)', overflow: 'hidden',
              }}>
                <div>
                  {langDialects.map(zh => {
                    const label = shortDialectLabel(zh, glid)
                    const isSelected = dialect === zh
                    return (
                      <button
                        key={zh}
                        onClick={() => { setDialect(zh); setDialectOpen(false) }}
                        style={{
                          display: 'block', width: '100%', padding: '10px 14px',
                          textAlign: 'left', fontSize: 13, color: T.ink, fontWeight: 500,
                          background: isSelected ? T.crimsonBg : 'none',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                  {/* Show legacy free-text value if not in known list */}
                  {dialect && !langDialects.includes(dialect) && (
                    <button
                      onClick={() => { setDialect(dialect); setDialectOpen(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px',
                        textAlign: 'left', fontSize: 13, color: T.ink, fontWeight: 500,
                        background: T.crimsonBg, border: 'none', cursor: 'pointer',
                      }}
                    >
                      {dialect}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="pin" label="Place"
              options={usedPlaces.map(p => ({ id: p, name: p }))}
              selected={place ? { id: place, name: place } : null}
              onSelect={opt => setPlace(opt?.name ?? '')}
              onCreate={async name => {
                const trimmed = name.trim()
                if (!trimmed) return null
                setUsedPlaces(p => [...new Set([...p, trimmed])].sort())
                return { id: trimmed, name: trimmed }
              }}
              placeholder="Where heard / seen"
            />
          </div>
          {/* Tags — always visible with inline add */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="tag" size={16} color={T.inkSoft} strokeWidth={1.8} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60, paddingTop: 2, flexShrink: 0 }}>Tags</span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              {availableTags.map(tag => {
                const sel = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTags(prev =>
                      sel ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    style={{
                      padding: '3px 10px', borderRadius: 999,
                      fontSize: 12, fontWeight: 500,
                      background: sel ? T.crimsonBg : T.paper,
                      color: sel ? T.crimson : T.inkMute,
                      borderWidth: 1, borderStyle: 'solid' as const,
                      borderColor: sel ? T.crimson : T.lineSoft,
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
              {addingTag ? (
                <input
                  autoFocus
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addTagInline()
                    if (e.key === 'Escape') { setNewTagInput(''); setAddingTag(false) }
                  }}
                  onBlur={addTagInline}
                  placeholder="tag name…"
                  style={{
                    border: `1px solid ${T.crimson}`, borderRadius: 999,
                    padding: '3px 10px', fontSize: 12, color: T.ink,
                    background: T.crimsonBg, outline: 'none',
                    width: 90, fontFamily: 'inherit',
                  }}
                />
              ) : (
                <button
                  onClick={() => setAddingTag(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '3px 8px', borderRadius: 999,
                    background: 'none', border: `1px dashed ${T.lineSoft}`,
                    fontSize: 12, color: T.inkFaint, cursor: 'pointer',
                  }}
                >
                  <Icon name="plus" size={11} strokeWidth={2.2} color={T.inkFaint} />
                  Add
                </button>
              )}
            </div>
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

      {/* Recent captures — collapsible, collapsed by default */}
      {recentItems.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setRecentOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 10px' }}
            >
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent</span>
              <Icon name="chev-d" size={12} color={T.inkFaint} strokeWidth={2} style={{ transform: recentOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>

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

          {recentOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                      {item.ab}
                    </span>
                    {item.zh && (
                      <span style={{
                        fontSize: 12, color: T.inkFaint, display: 'block',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}>
                        {item.zh}
                      </span>
                    )}
                  </div>
                  <Icon name="pen" size={13} color={T.inkFaint} strokeWidth={1.8} />
                </button>
              )
            })}
          </div>}
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
