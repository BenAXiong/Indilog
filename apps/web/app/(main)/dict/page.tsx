'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Icon, Button } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import SettingsButton from '@/components/widgets/SettingsSheet'
import { useLang } from '@/lib/context/LangDialectProvider'
import { getGlid, getIndivoreCode, getIndivoreCodeFromDialectName } from '@/lib/lang/lang-bridge'
import { GLID_FAMILIES } from '@/lib/lang/dialects'
import { createItem } from '@/lib/db/notebook/items'
import { unsaveItem } from '@/lib/db/srs/browser'
import { createClient } from '@/lib/supabase/client'
import PerfMark from '@/components/perf/PerfMark'

type WordResult = {
  id: number | string
  word_ab: string
  word_ch: string
  dialect_name: string
  glid: string
  exact: boolean
  source?: 'epark' | 'moe'
  moeMatch?: 'contains' | 'similar' | 'altSpelling'
}

// Small tag for how a Kilang/MoE row was found, beyond a literal headword match —
// diagnostic during Phase 2 (see plan-dict-v2.md) to see which fuzzy mechanism
// actually surfaces results in practice; only shown for the non-default tiers.
function MoeMatchTag({ kind }: { kind?: 'contains' | 'similar' | 'altSpelling' }) {
  if (kind !== 'similar' && kind !== 'altSpelling') return null
  const label = kind === 'similar' ? 'similar spelling' : 'alt spelling'
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 600, color: T.amber,
      background: T.amberBg, border: `1px solid ${T.amber}`,
      borderRadius: 999, padding: '1px 6px', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

type SentenceResult = {
  id: number
  ab: string
  zh: string
  dialect_name: string
  source: string
  audio_url: string | null
  sentMatch?: 'exact' | 'extended'
}

type DialectOption = {
  glid: string
  group_name: string
}

// Stable key for matching a dictionary word result against a saved ind_items row —
// text alone collides across dialects, so pair it with dialect_name.
function wordKey(ab: string, dialect: string) {
  return `${dialect}|${ab}`
}

// ─── Word card (exact match) ──────────────────────────────────
function ExactWordCard({ word, onSave, onCapture, saved = false }: {
  word: WordResult
  onSave: (w: WordResult) => void
  onCapture: (w: WordResult) => void
  saved?: boolean
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
              {word.source === 'moe' && (
                <span title="MoE dict" style={{ width: 5, height: 5, borderRadius: 999, background: '#7094AA', flexShrink: 0, display: 'inline-block' }} />
              )}
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
        <Button
          variant={saved ? 'secondary' : 'primary'} size="md" icon={saved ? 'bookmarkF' : 'bookmark'}
          style={{ flex: 1, ...(saved ? { color: T.crimson, border: `1px solid ${T.crimson}` } : {}) }}
          title={saved ? 'Remove from your notebook' : 'Save to your notebook'} onClick={() => onSave(word)}
        >
          {saved ? 'Saved' : 'Save word'}
        </Button>
        <Button variant="secondary" size="md" icon="capture" style={{ flex: 1 }} title="Open in Capture to add a sentence example" onClick={() => onCapture(word)}>
          Add context
        </Button>
      </div>
    </Card>
  )
}

// ─── Exact match group (same word, exact in 2+ dialects at once) ─────────
function ExactMatchGroupCard({ entries, onSave, onCapture, savedWordMap }: {
  entries: WordResult[]
  onSave: (w: WordResult) => void
  onCapture: (w: WordResult) => void
  savedWordMap: Map<string, string>
}) {
  const headword = entries[0].word_ab

  return (
    <Card raised pad={0} style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '16px 16px 14px', borderBottom: `1px solid ${T.lineSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em' }}>
          {headword}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 999,
          background: T.sageBg, color: T.sage, border: `1px solid #D2D8AE`,
          fontSize: 10.5, fontWeight: 600, flexShrink: 0,
        }}>
          <Icon name="check" size={10} color={T.sage} strokeWidth={2.5} />
          exact in {entries.length} dialects
        </span>
      </div>

      {entries.map((w, i) => {
        const saved = savedWordMap.has(wordKey(w.word_ab, w.dialect_name))
        return (
          <div key={w.id} style={{
            padding: '12px 16px',
            borderBottom: i < entries.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 2 }}>{w.dialect_name}</div>
              <div style={{ fontSize: 14.5, color: T.ink, fontWeight: 500, lineHeight: 1.4 }}>{w.word_ch}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => onSave(w)}
                title={saved ? 'Remove from your notebook' : 'Save word'} aria-label="Save word"
                style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  ...(saved ? { color: T.crimson, border: `1px solid ${T.crimson}`, background: T.crimsonBg } : {}),
                }}
              >
                <Icon name={saved ? 'bookmarkF' : 'bookmark'} size={15} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => onCapture(w)}
                title="Add context in Capture" aria-label="Add context in Capture"
                style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Icon name="capture" size={15} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// ─── Sentence card ────────────────────────────────────────────
function SentenceCard({ s, onSave, onCapture, saved = false }: {
  s: SentenceResult
  onSave: (s: SentenceResult) => void
  onCapture: (s: SentenceResult) => void
  saved?: boolean
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
          <button onClick={() => onSave(s)} title="Save sentence" aria-label="Save sentence" style={{
            ...btnStyle,
            ...(saved ? { color: T.crimson, border: `1px solid ${T.crimson}`, background: T.crimsonBg } : {}),
          }}>
            <Icon name={saved ? 'bookmarkF' : 'bookmark'} size={14} strokeWidth={1.8} />
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
  rawAb: string     // as stored in ind_items / returned by search — used for save + saved-state lookups
  glid: string
  exact: boolean
  moeMatch?: 'contains' | 'similar' | 'altSpelling'
  dialectSections: { dialect_name: string; defs: string[] }[]
}

function MergedEntryCard({ entry, onSave, onCapture, saved = false }: {
  entry: MergedEntry
  onSave: (ab: string, dialect: string, def: string, glid: string) => void
  onCapture: (ab: string, def: string) => void
  saved?: boolean
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
          <MoeMatchTag kind={entry.moeMatch} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onSave(entry.rawAb, primaryDialect, primaryDef, entry.glid)}
            title={saved ? 'Remove from your notebook' : 'Save word'}
            style={{ ...btnStyle, ...(saved ? { color: T.crimson, border: `1px solid ${T.crimson}`, background: T.crimsonBg } : {}) }}
          >
            <Icon name={saved ? 'bookmarkF' : 'bookmark'} size={14} strokeWidth={1.8} />
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
  const [saveMsgWarn, setSaveMsgWarn] = useState(false)
  const [savedAbSet, setSavedAbSet] = useState<Map<string, string>>(() => new Map())
  const [savedWordMap, setSavedWordMap] = useState<Map<string, string>>(() => new Map())
  const [dbError, setDbError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'words' | 'sentences'>('words')
  const [fuzzy, setFuzzy] = useState(false)
  const [moeEnabled,    setMoeEnabled]    = useState(true)
  const [klokahEnabled, setKlokahEnabled] = useState(false)
  const [mergeMode,     setMergeMode]     = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)

  // Sync source toggles and language override from settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ind_dict_sources')
      const sources: string[] = stored ? JSON.parse(stored) : ['moe']
      setMoeEnabled(sources.includes('moe'))
      setKlokahEnabled(sources.includes('klokah'))
    } catch {}
    const storedMerge = localStorage.getItem('ind_dict_merge_mode')
    if (storedMerge !== null) setMergeMode(storedMerge === 'true')
    const savedLang    = localStorage.getItem('ind_dict_lang_glid')    ?? ''
    const savedDialect = localStorage.getItem('ind_dict_lang_dialect') ?? ''
    if (savedLang) {
      setGlid(savedLang)
      setDialectFilter(savedDialect)
      setUserChangedGlid(true)
    }
  }, [])

  // Live-update glid + dialect when changed from Settings/Dict
  useEffect(() => {
    function onLangChange(e: Event) {
      const { glid: g, dialect: d } = (e as CustomEvent<{ glid: string; dialect: string }>).detail
      setGlid(g)
      setDialectFilter(d)
      setUserChangedGlid(!!g)
    }
    window.addEventListener('ind-dict-lang-changed', onLangChange)
    return () => window.removeEventListener('ind-dict-lang-changed', onLangChange)
  }, [])

  // Live-update source toggles when changed from Settings/Dict
  useEffect(() => {
    function onSourcesChange(e: Event) {
      const sources = (e as CustomEvent<string[]>).detail
      setMoeEnabled(sources.includes('moe'))
      setKlokahEnabled(sources.includes('klokah'))
    }
    window.addEventListener('ind-dict-sources-changed', onSourcesChange)
    return () => window.removeEventListener('ind-dict-sources-changed', onSourcesChange)
  }, [])

  // Live-update merge mode when changed from Settings/Dict
  useEffect(() => {
    function onMergeModeChange(e: Event) {
      setMergeMode((e as CustomEvent<boolean>).detail)
    }
    window.addEventListener('ind-dict-merge-mode-changed', onMergeModeChange)
    return () => window.removeEventListener('ind-dict-merge-mode-changed', onMergeModeChange)
  }, [])

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

  const runSearch = useCallback(async (term: string, glidFilter: string, dialectF: string, isFuzzy: boolean, withMoe: boolean, withKlokah: boolean) => {
    const trimmed = term.trim()
    // 2 chars is enough to fire the request — the API exact-matches word search
    // below its own 3-char prefix-search floor, so a 2-char query still finds words.
    const minLen = /[㐀-鿿]/.test(trimmed) ? 1 : 2
    if (trimmed.length < minLen) { setWords([]); setSentences([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    const params = new URLSearchParams({ q: trimmed })
    if (glidFilter)  params.set('glid', glidFilter)
    if (dialectF)    params.set('dialect', dialectF)
    if (isFuzzy)     params.set('fuzzy', '1')
    if (withMoe)     params.set('moe', '1')
    if (withKlokah)  params.set('klokah', '1')
    const res = await fetch(`/api/dict/search?${params}`)
    const data = await res.json()
    if (data.error) setDbError(data.error)
    setWords(data.words ?? [])
    setSentences(data.sentences ?? [])
    setLoading(false)
  }, [])

  const isPhrase = q.trim().includes(' ')
  const isCJK    = /[㐀-鿿]/.test(q)

  // Pre-check which sentences are already saved in ind_items
  useEffect(() => {
    if (sentences.length === 0) { setSavedAbSet(new Map()); return }
    const abs = sentences.map(s => s.ab)
    createClient().from('ind_items').select('id, ab').in('ab', abs).eq('type', 'sentence')
      .then(({ data }) => {
        if (data) setSavedAbSet(new Map(data.map((r: { id: string; ab: string }) => [r.ab, r.id])))
      })
  }, [sentences])

  // Pre-check which words are already saved in ind_items (keyed by ab+dialect — text alone collides across dialects)
  useEffect(() => {
    if (words.length === 0) { setSavedWordMap(new Map()); return }
    const abs = words.map(w => w.word_ab)
    createClient().from('ind_items').select('id, ab, dialect').in('ab', abs).eq('type', 'word')
      .then(({ data }) => {
        if (data) setSavedWordMap(new Map(data.map((r: { id: string; ab: string; dialect: string | null }) => [wordKey(r.ab, r.dialect ?? ''), r.id])))
      })
  }, [words])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // phrases + CJK: always fuzzy so they match mid-sentence / mid-definition
    debounceRef.current = setTimeout(() => runSearch(q, glid, dialectFilter, isPhrase || isCJK || fuzzy, moeEnabled, klokahEnabled), 320)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, glid, dialectFilter, fuzzy, isPhrase, isCJK, moeEnabled, klokahEnabled, runSearch])

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
      if (!map.has(key)) map.set(key, { ab: capitalize(w.word_ab), rawAb: w.word_ab, glid: w.glid, exact: false, dialectSections: [] })
      const e = map.get(key)!
      if (w.exact) e.exact = true
      if (w.moeMatch && !e.moeMatch) e.moeMatch = w.moeMatch
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
    const tabs: Array<'words' | 'sentences'> = ['words', 'sentences']
    const idx = tabs.indexOf(activeTab)
    if (dx < -50 && idx < tabs.length - 1) setActiveTab(tabs[idx + 1])
    if (dx > 50  && idx > 0)               setActiveTab(tabs[idx - 1])
    touchStartX.current = null
  }

  async function handleSaveMerged(ab: string, dialect: string, def: string, glid: string) {
    const key = wordKey(ab, dialect)
    const existingId = savedWordMap.get(key)
    if (existingId) {
      const outcome = await unsaveItem(existingId)
      if (outcome === 'deleted') {
        setSavedWordMap(prev => { const m = new Map(prev); m.delete(key); return m })
        setSaveMsgWarn(false)
        setSaveMsg('Removed from notebook')
      } else {
        setSaveMsgWarn(true)
        setSaveMsg("Kept — your review history is safe, but it won't appear in future sessions. Unsuspend it from Study → Browser if you change your mind.")
      }
      setTimeout(() => setSaveMsg(null), outcome === 'deleted' ? 2000 : 4000)
      return
    }
    const item = await createItem({ ab, zh: def, type: 'word', language: getIndivoreCode(glid) ?? lang.code, dialect, note_source: 'dict' })
    if (item) setSavedWordMap(prev => new Map(prev).set(key, item.id))
    setSaveMsgWarn(false)
    setSaveMsg(`Saved "${ab}"`)
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCaptureMerged(ab: string, def: string) {
    const params = new URLSearchParams({ text: ab, notes: def })
    router.push(`/capture?${params}`)
  }

  async function handleSave(word: WordResult) {
    const key = wordKey(word.word_ab, word.dialect_name)
    const existingId = savedWordMap.get(key)
    if (existingId) {
      const outcome = await unsaveItem(existingId)
      if (outcome === 'deleted') {
        setSavedWordMap(prev => { const m = new Map(prev); m.delete(key); return m })
        setSaveMsgWarn(false)
        setSaveMsg('Removed from notebook')
      } else {
        setSaveMsgWarn(true)
        setSaveMsg("Kept — your review history is safe, but it won't appear in future sessions. Unsuspend it from Study → Browser if you change your mind.")
      }
      setTimeout(() => setSaveMsg(null), outcome === 'deleted' ? 2000 : 4000)
      return
    }
    const item = await createItem({
      ab: word.word_ab, zh: word.word_ch,
      type: 'word', language: getIndivoreCode(word.glid) ?? lang.code, dialect: word.dialect_name, note_source: 'dict',
      target_word: word.word_ab,
    })
    if (item) setSavedWordMap(prev => new Map(prev).set(key, item.id))
    setSaveMsgWarn(false)
    setSaveMsg(`Saved "${word.word_ab}"`)
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCapture(word: WordResult) {
    const params = new URLSearchParams({ text: word.word_ab, notes: word.word_ch })
    router.push(`/capture?${params}`)
  }

  async function handleSaveSentence(s: SentenceResult) {
    const existingId = savedAbSet.get(s.ab)
    if (existingId) {
      const outcome = await unsaveItem(existingId)
      if (outcome === 'deleted') {
        setSavedAbSet(prev => { const m = new Map(prev); m.delete(s.ab); return m })
        setSaveMsgWarn(false)
        setSaveMsg('Removed from notebook')
        setTimeout(() => setSaveMsg(null), 2000)
      } else {
        setSaveMsgWarn(true)
        setSaveMsg("Kept — your review history is safe, but it won't appear in future sessions. Unsuspend it from Study → Browser if you change your mind.")
        setTimeout(() => setSaveMsg(null), 4000)
      }
      return
    }
    const item = await createItem({ ab: s.ab, zh: s.zh, type: 'sentence', language: getIndivoreCodeFromDialectName(s.dialect_name) ?? lang.code, dialect: s.dialect_name, note_source: 'dict' })
    if (item) setSavedAbSet(prev => new Map(prev).set(s.ab, item.id))
    setSaveMsgWarn(false)
    setSaveMsg('Sentence saved')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCaptureSentence(s: SentenceResult) {
    const params = new URLSearchParams({ text: s.ab, notes: s.zh })
    router.push(`/capture?${params}`)
  }

  function handleCaptureEmpty() {
    const params = new URLSearchParams({ text: q.trim(), type: 'word' })
    const language = getIndivoreCode(glid) ?? lang.code
    if (language)     params.set('language', language)
    if (dialectFilter) params.set('dialect', dialectFilter)
    router.push(`/capture?${params}`)
  }

  // Multiple rows can be exact at once (e.g. the same short word defined in
  // several dialects) — group them into one dialect-sectioned card instead of
  // picking an arbitrary hero and burying the rest in "Also matches".
  const exactMatches = words.filter(w => w.exact)
  const exactWord = exactMatches.length === 1 ? exactMatches[0] : undefined
  const exactGroup = exactMatches.length > 1 ? exactMatches : null
  const otherWords = words.filter(w => !w.exact)

  const selectedLangOption = dialects.find(d => d.glid === glid)
  const searchPlaceholder = selectedLangOption
    ? `Word or phrase in ${selectedLangOption.group_name}${dialectFilter ? ` · ${dialectFilter}` : ''}, Chinese or English`
    : 'Word or phrase in all languages, Chinese or English'

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* control flow: no blocking data — measures pure client-nav cost */}
      <PerfMark flow="dict" />
      <PerfMark flow="dict-search" when={searched && !loading} meta={{ words: words.length }} />
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

      {/* Save confirmation / warning — fixed so it's visible regardless of scroll position */}
      {saveMsg && (
        <div className="animate-iv-rise" style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 80, maxWidth: 'calc(100vw - 36px)',
          padding: '10px 16px', borderRadius: 10,
          background: saveMsgWarn ? T.amberBg : T.sageBg,
          border: `1px solid ${saveMsgWarn ? T.amber : '#D2D8AE'}`,
          fontSize: 13, fontWeight: 500, color: saveMsgWarn ? T.terra : T.sageDp,
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 4px 16px rgba(80,40,20,0.12)',
        }}>
          <Icon name={saveMsgWarn ? 'bookmarkF' : 'check'} size={14} color={saveMsgWarn ? T.terra : T.sageDp} strokeWidth={2.2} />
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
              {mergeMode ? (
                <>
                  {merged.length === 0 && !dbError && (
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
                      <div style={{ marginTop: 14 }}>
                        <Button variant="secondary" size="md" icon="capture" onClick={handleCaptureEmpty}>
                          Capture "{q}" as a new word
                        </Button>
                      </div>
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
                          saved={savedWordMap.has(wordKey(entry.rawAb, entry.dialectSections[0]?.dialect_name ?? ''))}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
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
                      <div style={{ marginTop: 14 }}>
                        <Button variant="secondary" size="md" icon="capture" onClick={handleCaptureEmpty}>
                          Capture "{q}" as a new word
                        </Button>
                      </div>
                    </div>
                  )}
                  {exactWord && (
                    <ExactWordCard word={exactWord} onSave={handleSave} onCapture={handleCapture} saved={savedWordMap.has(wordKey(exactWord.word_ab, exactWord.dialect_name))} />
                  )}
                  {exactGroup && (
                    <ExactMatchGroupCard entries={exactGroup} onSave={handleSave} onCapture={handleCapture} savedWordMap={savedWordMap} />
                  )}
                  {otherWords.length > 0 && (
                    <div>
                      {exactMatches.length > 0 && <SectionHead title="Also matches" action={`${otherWords.length}`} />}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {otherWords.map(w => (
                          <div key={w.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', background: T.paperHi,
                            border: `1px solid ${T.lineSoft}`, borderRadius: 12,
                            boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink }}>
                                  {w.word_ab}
                                </span>
                                <span style={{ fontSize: 11, color: T.inkFaint }}>{w.dialect_name}</span>
                                {w.source === 'moe' && (
                                  <span title="MoE dict" style={{ width: 5, height: 5, borderRadius: 999, background: '#7094AA', flexShrink: 0, display: 'inline-block' }} />
                                )}
                                <MoeMatchTag kind={w.moeMatch} />
                              </div>
                              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {w.word_ch}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleSave(w)} title={savedWordMap.has(wordKey(w.word_ab, w.dialect_name)) ? 'Remove from your notebook' : 'Save word'} aria-label="Save word" style={{
                                width: 32, height: 32, borderRadius: 9,
                                background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                ...(savedWordMap.has(wordKey(w.word_ab, w.dialect_name)) ? { color: T.crimson, border: `1px solid ${T.crimson}`, background: T.crimsonBg } : {}),
                              }}>
                                <Icon name={savedWordMap.has(wordKey(w.word_ab, w.dialect_name)) ? 'bookmarkF' : 'bookmark'} size={15} strokeWidth={1.8} />
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
                  {sentences[0].sentMatch === 'exact' && <SectionHead title="Exact word" />}
                  {sentences.map((s, i) => {
                    // sentences are pre-sorted exact-first, extended-second (route.ts) —
                    // a divider marks the one transition point, not per-row.
                    const showDivider = i > 0 && sentences[i - 1].sentMatch === 'exact' && s.sentMatch === 'extended'
                    return (
                      <Fragment key={s.id}>
                        {showDivider && <SectionHead title="Related" style={{ marginTop: 8 }} />}
                        <SentenceCard s={s} onSave={handleSaveSentence} onCapture={handleCaptureSentence} saved={savedAbSet.has(s.ab)} />
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
