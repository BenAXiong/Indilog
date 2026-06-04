'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Icon, Button } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import SettingsButton from '@/components/widgets/SettingsSheet'
import { useLang } from '@/lib/context/LangDialectProvider'
import { getGlid } from '@/lib/lang/lang-bridge'
import { GLID_FAMILIES } from '@/lib/lang/dialects'
import { createItem } from '@/lib/db/notebook/items'

type WordResult = {
  id: number
  word_ab: string
  word_ch: string
  dialect_name: string
  glid: string
  exact: boolean
}

type SentenceResult = {
  id: number
  ab: string
  zh: string
  dialect_name: string
  source: string
  audio_url: string | null
}

type DialectOption = {
  glid: string
  group_name: string
}

// ─── Word card (exact match) ──────────────────────────────────
function ExactWordCard({ word, onSave, onCapture }: {
  word: WordResult
  onSave: (w: WordResult) => void
  onCapture: (w: WordResult) => void
}) {
  return (
    <Card raised pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em' }}>
              {word.word_ab}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11.5, color: T.inkSoft }}>{word.dialect_name}</span>
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 999,
            background: T.sageBg, color: T.sage, border: `1px solid #D2D8AE`,
            fontSize: 10.5, fontWeight: 600, flexShrink: 0, marginTop: 4,
          }}>
            <Icon name="check" size={10} color={T.sage} strokeWidth={2.5} />
            exact
          </span>
        </div>

        <div style={{ marginTop: 14, fontSize: 15.5, fontWeight: 500, color: T.ink, lineHeight: 1.4 }}>
          {word.word_ch}
        </div>
      </div>

      <div style={{
        padding: 12, borderTop: `1px solid ${T.lineSoft}`, background: T.paper,
        display: 'flex', gap: 8,
      }}>
        <Button variant="primary" size="md" icon="bookmark" style={{ flex: 1 }} title="Save to your notebook" onClick={() => onSave(word)}>
          Save word
        </Button>
        <Button variant="secondary" size="md" icon="capture" style={{ flex: 1 }} title="Open in Capture to add a sentence example" onClick={() => onCapture(word)}>
          Add context
        </Button>
      </div>
    </Card>
  )
}

// ─── Sentence card ────────────────────────────────────────────
function SentenceCard({ s, onSave, onCapture }: {
  s: SentenceResult
  onSave: (s: SentenceResult) => void
  onCapture: (s: SentenceResult) => void
}) {
  function playAudio() {
    if (s.audio_url) new Audio(s.audio_url).play().catch(() => {})
  }

  const btnStyle: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8,
    background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }

  return (
    <div style={{
      padding: '12px 14px', background: T.paperHi,
      border: `1px solid ${T.lineSoft}`, borderRadius: 12,
      boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
    }}>
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontStyle: 'italic', color: T.ink, lineHeight: 1.45 }}>
        {s.ab}
      </div>
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4, lineHeight: 1.35 }}>{s.zh}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace' }}>
          {s.dialect_name}
        </span>
        <span style={{ fontSize: 10.5, color: T.inkFaint }}>·</span>
        <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase' }}>
          {s.source}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          {s.audio_url && (
            <button onClick={playAudio} title="Play audio" style={btnStyle}>
              <Icon name="speaker" size={13} strokeWidth={1.8} />
            </button>
          )}
          <button onClick={() => onSave(s)} title="Save sentence" aria-label="Save sentence" style={btnStyle}>
            <Icon name="bookmark" size={14} strokeWidth={1.8} />
          </button>
          <button onClick={() => onCapture(s)} title="Add context in Capture" aria-label="Add context in Capture" style={btnStyle}>
            <Icon name="capture" size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Merged entry (words only, per-dialect sections) ─────────
type MergedEntry = {
  ab: string        // display form, first letter capitalised
  glid: string
  exact: boolean
  dialectSections: { dialect_name: string; defs: string[] }[]
}

function MergedEntryCard({ entry, onSave, onCapture }: {
  entry: MergedEntry
  onSave: (ab: string, dialect: string, def: string) => void
  onCapture: (ab: string, def: string) => void
}) {
  const firstSection = entry.dialectSections[0]
  const primaryDef   = firstSection?.defs[0] ?? ''
  const primaryDialect = firstSection?.dialect_name ?? ''

  const btnStyle: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8,
    background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }

  return (
    <div style={{
      background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
    }}>
      {/* Header: word + exact badge + action buttons */}
      <div style={{
        padding: '11px 14px', borderBottom: `1px solid ${T.lineSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink }}>
            {entry.ab}
          </span>
          {entry.exact && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 999,
              background: T.sageBg, color: T.sage, border: `1px solid #D2D8AE`,
              fontSize: 10, fontWeight: 600, flexShrink: 0,
            }}>
              <Icon name="check" size={9} color={T.sage} strokeWidth={2.5} />
              exact
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onSave(entry.ab, primaryDialect, primaryDef)} title="Save word" style={btnStyle}>
            <Icon name="bookmark" size={14} strokeWidth={1.8} />
          </button>
          <button onClick={() => onCapture(entry.ab, primaryDef)} title="Add context in Capture" style={btnStyle}>
            <Icon name="capture" size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* One section per dialect */}
      {entry.dialectSections.map((section, si) => (
        <div key={section.dialect_name} style={{
          padding: '8px 14px 10px',
          borderBottom: si < entry.dialectSections.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
        }}>
          {section.defs.map((def, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: i < section.defs.length - 1 ? 5 : 0 }}>
              {section.defs.length > 1 && (
                <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
                  {i + 1}.
                </span>
              )}
              <span style={{ flex: 1, fontSize: 14, color: T.ink, fontWeight: 500, lineHeight: 1.35 }}>{def}</span>
              {i === 0 && (
                <span style={{ fontSize: 9.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
                  {section.dialect_name}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function DictionaryPage() {
  const { lang, dialectLabel } = useLang()
  const router = useRouter()

  const [q, setQ] = useState('')
  const [glid, setGlid] = useState<string>('')
  const [dialectFilter, setDialectFilter] = useState<string>('')
  const [userChangedGlid, setUserChangedGlid] = useState(false)
  const [dialects, setDialects] = useState<DialectOption[]>([])
  const [words, setWords] = useState<WordResult[]>([])
  const [sentences, setSentences] = useState<SentenceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'words' | 'merged' | 'sentences'>('words')
  const [fuzzy, setFuzzy] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)

  // Load dialects once
  useEffect(() => {
    fetch('/api/dict/dialects')
      .then(r => r.json())
      .then(data => {
        if (data.dialects) setDialects(data.dialects)
        if (data.error) setDbError(data.error)
      })
  }, [])

  // Default glid to active language (once, unless user manually changes it)
  useEffect(() => {
    if (userChangedGlid || dialects.length === 0) return
    const langGlid = getGlid(lang.code)
    if (langGlid && dialects.some(d => d.glid === langGlid)) {
      setGlid(langGlid)
      setDialectFilter('')
    }
  }, [lang, dialects, userChangedGlid])

  const runSearch = useCallback(async (term: string, glidFilter: string, dialectF: string, isFuzzy: boolean) => {
    const trimmed = term.trim()
    const minLen = /[㐀-鿿]/.test(trimmed) ? 1 : 3
    if (trimmed.length < minLen) { setWords([]); setSentences([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    const params = new URLSearchParams({ q: trimmed })
    if (glidFilter) params.set('glid', glidFilter)
    if (dialectF)   params.set('dialect', dialectF)
    if (isFuzzy)    params.set('fuzzy', '1')
    const res = await fetch(`/api/dict/search?${params}`)
    const data = await res.json()
    if (data.error) setDbError(data.error)
    setWords(data.words ?? [])
    setSentences(data.sentences ?? [])
    setLoading(false)
  }, [])

  const isPhrase = q.trim().includes(' ')
  const isCJK    = /[㐀-鿿]/.test(q)

  useEffect(() => {
    if (isPhrase || isCJK) setActiveTab('sentences')
  }, [isPhrase, isCJK])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // phrases + CJK: always fuzzy so they match mid-sentence / mid-definition
    debounceRef.current = setTimeout(() => runSearch(q, glid, dialectFilter, isPhrase || isCJK || fuzzy), 320)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, glid, dialectFilter, fuzzy, isPhrase, isCJK, runSearch])

  // Merge words-only by (word_ab case-insensitive, dialect_name),
  // parsing numbered definitions and deduplicating via substring inclusion.
  const merged = useMemo<MergedEntry[]>(() => {
    function parseDefs(wordCh: string): string[] {
      // "1. foo 2. bar 3. baz" → ["foo", "bar", "baz"]
      if (/^\d+\./.test(wordCh)) {
        const parts = wordCh.split(/(?=\s\d+\.)/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
        if (parts.length > 1) return parts
      }
      return [wordCh.trim()]
    }

    function addDef(def: string, defs: string[]): string[] {
      // If def is already covered by something in defs, skip it
      if (defs.some(e => e.includes(def))) return defs
      // If def covers (subsumes) existing shorter entries, replace them
      const kept = defs.filter(e => !def.includes(e))
      return [...kept, def]
    }

    // Normalize key: lowercase + collapse all apostrophe variants to '
    // (ILRDF data mixes U+0027, U+2019, U+02BC, U+A78C across entries)
    function normKey(ab: string) {
      return ab.toLowerCase().normalize('NFC').replace(/['\u2018\u2019\u02BC\uA78C]/g, "'").replace(/\s+/g, '')
    }

    function capitalize(s: string) {
      return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    }

    const map = new Map<string, MergedEntry>()
    for (const w of words) {
      const key = normKey(w.word_ab)
      if (!map.has(key)) map.set(key, { ab: capitalize(w.word_ab), glid: w.glid, exact: false, dialectSections: [] })
      const e = map.get(key)!
      if (w.exact) e.exact = true
      let section = e.dialectSections.find(s => s.dialect_name === w.dialect_name)
      if (!section) {
        section = { dialect_name: w.dialect_name, defs: [] }
        e.dialectSections.push(section)
      }
      for (const def of parseDefs(w.word_ch)) {
        section.defs = addDef(def, section.defs)
      }
    }
    return Array.from(map.values())
      .filter(e => e.dialectSections.length > 0)
      .sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1
        return a.ab.length - b.ab.length
      })
  }, [words])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const tabs: Array<'words' | 'merged' | 'sentences'> = ['words', 'merged', 'sentences']
    const idx = tabs.indexOf(activeTab)
    if (dx < -50 && idx < tabs.length - 1) setActiveTab(tabs[idx + 1])
    if (dx > 50  && idx > 0)               setActiveTab(tabs[idx - 1])
    touchStartX.current = null
  }

  async function handleSaveMerged(ab: string, dialect: string, def: string) {
    await createItem({ ab, zh: def, type: 'word', language: dialect, note_source: 'dict' })
    setSaveMsg(`Saved "${ab}"`)
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCaptureMerged(ab: string, def: string) {
    const params = new URLSearchParams({ text: ab, notes: def })
    router.push(`/capture?${params}`)
  }

  async function handleSave(word: WordResult) {
    await createItem({
      ab: word.word_ab, zh: word.word_ch,
      type: 'word', language: word.dialect_name, note_source: 'dict',
      target_word: word.word_ab,
    })
    setSaveMsg(`Saved "${word.word_ab}"`)
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCapture(word: WordResult) {
    const params = new URLSearchParams({ text: word.word_ab, notes: word.word_ch })
    router.push(`/capture?${params}`)
  }

  async function handleSaveSentence(s: SentenceResult) {
    await createItem({ ab: s.ab, zh: s.zh, type: 'sentence', language: s.dialect_name, note_source: 'dict' })
    setSaveMsg('Sentence saved')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCaptureSentence(s: SentenceResult) {
    const params = new URLSearchParams({ text: s.ab, notes: s.zh })
    router.push(`/capture?${params}`)
  }

  const exactWord = words.find(w => w.exact)
  const otherWords = words.filter(w => !w.exact)

  const selectedLangOption = dialects.find(d => d.glid === glid)
  const filterActive = !!(glid || dialectFilter)
  const filterLabel = !glid
    ? 'All languages'
    : dialectFilter
      ? dialectFilter
      : `${selectedLangOption?.group_name ?? ''} (all dialects)`
  const searchPlaceholder = selectedLangOption
    ? `Word or phrase in ${selectedLangOption.group_name}${dialectFilter ? ` · ${dialectFilter}` : ''}, Chinese or English`
    : 'Word or phrase in all languages, Chinese or English'

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScreenHeader
        title="Dictionary"
        langName={lang.name}
        langDialect={dialectLabel}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setFuzzy(f => !f)}
              title={fuzzy ? 'Fuzzy (contains) — click for prefix' : 'Prefix search — click for fuzzy'}
              style={{
                width: 36, height: 36, borderRadius: 999,
                background: fuzzy ? T.crimsonBg : T.paperHi,
                border: `1px solid ${fuzzy ? T.crimson : T.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: fuzzy ? T.crimson : T.inkSoft,
                fontSize: 17, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1,
              }}
            >
              ≈
            </button>
            <button
              onClick={() => setFilterSheetOpen(true)}
              title="Filter by language / dialect"
              style={{
                width: 36, height: 36, borderRadius: 999,
                background: filterActive ? T.crimsonBg : T.paperHi,
                border: `1px solid ${filterActive ? T.crimson : T.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: filterActive ? T.crimson : T.inkSoft,
              }}
            >
              <Icon name="filter" size={16} strokeWidth={1.8} />
            </button>
            <SettingsButton initialTab="dict" />
          </div>
        }
      />

      {/* DB error banner */}
      {dbError && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: T.amberBg, border: `1px solid ${T.amber}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.terra }}>Database not found</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            Place <code>ycm_master.db</code> at <code>packages/dictionary/ycm_master.db</code>
          </div>
        </div>
      )}

      {/* Search bar — full width */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: T.paperHi, border: `1.5px solid ${T.line}`, borderRadius: 14,
        padding: '0 14px', height: 52,
      }}>
        <Icon name="search" size={18} color={T.inkMute} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="dict-search-input"
          style={{
            flex: 1, border: 0, background: 'transparent', outline: 'none',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 17, fontWeight: 400, color: T.ink,
          }}
        />
        {q && (
          <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute, padding: 0 }}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Tab toggle — shown after first search */}
      {searched && (
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { id: 'words',     label: 'Words',    count: words.length    },
            { id: 'merged',    label: 'Merged',   count: merged.length   },
            { id: 'sentences', label: 'Sentences', count: sentences.length },
          ] as const).map(({ id, label, count }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                flex: 1, height: 36, borderRadius: 10,
                fontWeight: 500, fontSize: 12.5,
                background: active ? T.ink : T.paperHi,
                color: active ? T.paper : T.inkSoft,
                border: `1px solid ${active ? T.ink : T.lineSoft}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                {label}
                {count > 0 && (
                  <span style={{ fontSize: 11, opacity: active ? 0.55 : 0.5 }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Save confirmation */}
      {saveMsg && (
        <div className="animate-iv-rise" style={{
          padding: '10px 14px', borderRadius: 10,
          background: T.sageBg, border: `1px solid #D2D8AE`,
          fontSize: 13, fontWeight: 500, color: T.sageDp,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="check" size={14} color={T.sageDp} strokeWidth={2.2} />
          {saveMsg}
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[180, 120, 90].map(w => (
            <div key={w} className="animate-iv-shimmer" style={{ height: 16, width: w, borderRadius: 8, background: T.lineSoft }} />
          ))}
        </div>
      )}

      {/* Results — swipeable l/r between tabs */}
      {!loading && searched && (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Words tab */}
          {activeTab === 'words' && (
            <>
              {words.length === 0 && !dbError && (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>No words found for "{q}"</div>
                  {sentences.length > 0 && (
                    <button onClick={() => setActiveTab('sentences')} style={{
                      marginTop: 6, fontSize: 12, color: T.crimson,
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      {sentences.length} sentence{sentences.length !== 1 ? 's' : ''} found →
                    </button>
                  )}
                </div>
              )}
              {exactWord && (
                <ExactWordCard word={exactWord} onSave={handleSave} onCapture={handleCapture} />
              )}
              {otherWords.length > 0 && (
                <div>
                  {exactWord && <SectionHead title="Also matches" action={`${otherWords.length}`} />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {otherWords.map(w => (
                      <div key={w.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', background: T.paperHi,
                        border: `1px solid ${T.lineSoft}`, borderRadius: 12,
                        boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink }}>
                              {w.word_ab}
                            </span>
                            <span style={{ fontSize: 11, color: T.inkFaint }}>{w.dialect_name}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {w.word_ch}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleSave(w)} title="Save word" aria-label="Save word" style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}>
                            <Icon name="bookmark" size={15} strokeWidth={1.8} />
                          </button>
                          <button onClick={() => handleCapture(w)} title="Add context in Capture" aria-label="Add context in Capture" style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}>
                            <Icon name="capture" size={15} strokeWidth={1.8} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Merged tab */}
          {activeTab === 'merged' && (
            <>
              {merged.length === 0 && !dbError && (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>No results for "{q}"</div>
                </div>
              )}
              {merged.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {merged.map((entry, i) => (
                    <MergedEntryCard
                      key={`${entry.ab}|${entry.glid}|${i}`}
                      entry={entry}
                      onSave={handleSaveMerged}
                      onCapture={handleCaptureMerged}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Sentences tab */}
          {activeTab === 'sentences' && (
            <>
              {sentences.length === 0 && !dbError && (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>No sentences found for "{q}"</div>
                  {words.length > 0 && (
                    <button onClick={() => setActiveTab('words')} style={{
                      marginTop: 6, fontSize: 12, color: T.crimson,
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      {words.length} word{words.length !== 1 ? 's' : ''} found →
                    </button>
                  )}
                </div>
              )}
              {sentences.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sentences.map(s => (
                    <SentenceCard key={s.id} s={s} onSave={handleSaveSentence} onCapture={handleCaptureSentence} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Filter bottom sheet ── */}
      {filterSheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {/* Overlay */}
          <div
            onClick={() => setFilterSheetOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(30,15,5,0.4)' }}
          />
          {/* Sheet */}
          <div style={{
            position: 'relative', background: T.paper,
            borderRadius: '20px 20px 0 0',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
            maxHeight: '82dvh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Drag handle */}
            <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '12px auto 0' }} />
            {/* Sheet header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px 10px',
              borderBottom: `1px solid ${T.lineSoft}`,
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.ink, fontFamily: 'Newsreader, Georgia, serif' }}>
                Filter results by language and dialect
              </span>
              <span style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: '"JetBrains Mono", monospace' }}>
                {filterLabel}
              </span>
            </div>
            {/* Two-column body */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Left: languages */}
              <div style={{ flex: 1, overflowY: 'auto', borderRight: `1px solid ${T.lineSoft}`, padding: '6px 0' }}>
                {/* All languages */}
                <button
                  onClick={() => { setGlid(''); setDialectFilter(''); setUserChangedGlid(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 16px', textAlign: 'left',
                    background: !glid ? T.crimsonBg : 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: !glid ? T.crimson : T.ink }}>All</span>
                  {!glid && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                </button>
                {dialects.map(d => {
                  const active = glid === d.glid
                  return (
                    <button
                      key={d.glid}
                      onClick={() => { setGlid(d.glid); setDialectFilter(''); setUserChangedGlid(true) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 16px', textAlign: 'left',
                        background: active ? T.crimsonBg : 'none', border: 'none', cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.crimson : T.ink }}>
                        {d.group_name}
                      </span>
                      {active && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                    </button>
                  )
                })}
              </div>
              {/* Right: dialects for selected language */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                {!glid ? (
                  <div style={{ padding: '16px', fontSize: 12, color: T.inkFaint, textAlign: 'center' }}>
                    Select a language first
                  </div>
                ) : (
                  <>
                    {/* All dialects */}
                    <button
                      onClick={() => { setDialectFilter(''); setFilterSheetOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 16px', textAlign: 'left',
                        background: !dialectFilter ? T.crimsonBg : 'none', border: 'none', cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: !dialectFilter ? T.crimson : T.ink }}>All</span>
                      {!dialectFilter && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                    </button>
                    {(GLID_FAMILIES[glid] ?? []).map(d => {
                      const active = dialectFilter === d
                      return (
                        <button
                          key={d}
                          onClick={() => { setDialectFilter(d); setFilterSheetOpen(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '10px 16px', textAlign: 'left',
                            background: active ? T.crimsonBg : 'none', border: 'none', cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.crimson : T.ink }}>
                            {d}
                          </span>
                          {active && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
