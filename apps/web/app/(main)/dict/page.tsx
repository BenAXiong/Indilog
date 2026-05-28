'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Icon, Button } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useActiveLang } from '@/lib/hooks/useActiveLang'
import { getGlid } from '@/lib/learn/lang-bridge'
import { createItem } from '@/lib/db/items'

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

// ─── Merged entry (computed client-side) ─────────────────────
type MergedEntry = {
  ab: string
  dialect_name: string
  glid: string
  exact: boolean
  wordDefs: string[]
  sentences: { zh: string; source: string; audio_url: string | null }[]
}

function MergedEntryCard({ entry, onSave, onCapture }: {
  entry: MergedEntry
  onSave: (ab: string, dialect: string, def: string, type: 'word' | 'sentence') => void
  onCapture: (ab: string, def: string) => void
}) {
  const primaryDef = entry.wordDefs[0] ?? entry.sentences[0]?.zh ?? ''

  const btnStyle: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8,
    background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }

  function playAudio(url: string) {
    new Audio(url).play().catch(() => {})
  }

  return (
    <div style={{
      background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${T.lineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink, lineHeight: 1.2 }}>
              {entry.ab}
            </div>
            <div style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', marginTop: 3 }}>
              {entry.dialect_name}
            </div>
          </div>
          {entry.exact && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 999,
              background: T.sageBg, color: T.sage, border: `1px solid #D2D8AE`,
              fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 2,
            }}>
              <Icon name="check" size={9} color={T.sage} strokeWidth={2.5} />
              exact
            </span>
          )}
        </div>
      </div>

      {/* Word definitions */}
      {entry.wordDefs.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: entry.sentences.length > 0 ? `1px solid ${T.lineSoft}` : 'none' }}>
          {entry.wordDefs.map((def, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < entry.wordDefs.length - 1 ? 6 : 0 }}>
              {entry.wordDefs.length > 1 && (
                <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace', marginTop: 2, flexShrink: 0 }}>
                  {i + 1}.
                </span>
              )}
              <span style={{ fontSize: 14, color: T.ink, fontWeight: 500, lineHeight: 1.35 }}>{def}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sentence examples */}
      {entry.sentences.length > 0 && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entry.sentences.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 13.5, fontStyle: 'italic', color: T.inkSoft, lineHeight: 1.4 }}>
                  {s.zh}
                </div>
                <div style={{ fontSize: 10.5, color: T.inkFaint, marginTop: 2, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase' }}>
                  {s.source}
                </div>
              </div>
              {s.audio_url && (
                <button onClick={() => playAudio(s.audio_url!)} title="Play audio" style={{ ...btnStyle, flexShrink: 0 }}>
                  <Icon name="speaker" size={13} strokeWidth={1.8} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '8px 14px', borderTop: `1px solid ${T.lineSoft}`, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onSave(entry.ab, entry.dialect_name, primaryDef, entry.wordDefs.length > 0 ? 'word' : 'sentence')}
          title="Save to notebook"
          style={btnStyle}
        >
          <Icon name="bookmark" size={14} strokeWidth={1.8} />
        </button>
        <button
          onClick={() => onCapture(entry.ab, primaryDef)}
          title="Add context in Capture"
          style={btnStyle}
        >
          <Icon name="capture" size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function DictionaryPage() {
  const { lang, dialectLabel } = useActiveLang()
  const router = useRouter()

  const [q, setQ] = useState('')
  const [glid, setGlid] = useState<string>('')
  const [userChangedGlid, setUserChangedGlid] = useState(false)
  const [dialects, setDialects] = useState<DialectOption[]>([])
  const [words, setWords] = useState<WordResult[]>([])
  const [sentences, setSentences] = useState<SentenceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'words' | 'merged' | 'sentences'>('words')
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
    }
  }, [lang, dialects, userChangedGlid])

  const runSearch = useCallback(async (term: string, glidFilter: string) => {
    if (!term.trim()) { setWords([]); setSentences([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    const params = new URLSearchParams({ q: term })
    if (glidFilter) params.set('glid', glidFilter)
    const res = await fetch(`/api/dict/search?${params}`)
    const data = await res.json()
    if (data.error) setDbError(data.error)
    setWords(data.words ?? [])
    setSentences(data.sentences ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q, glid), 320)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, glid, runSearch])

  // Merge words + sentences by (ab, dialect_name)
  const merged = useMemo<MergedEntry[]>(() => {
    const map = new Map<string, MergedEntry>()
    for (const w of words) {
      const key = `${w.word_ab}|${w.dialect_name}`
      if (!map.has(key)) map.set(key, { ab: w.word_ab, dialect_name: w.dialect_name, glid: w.glid, exact: false, wordDefs: [], sentences: [] })
      const e = map.get(key)!
      e.wordDefs.push(w.word_ch)
      if (w.exact) e.exact = true
    }
    for (const s of sentences) {
      const key = `${s.ab}|${s.dialect_name}`
      if (!map.has(key)) map.set(key, { ab: s.ab, dialect_name: s.dialect_name, glid: '', exact: false, wordDefs: [], sentences: [] })
      map.get(key)!.sentences.push({ zh: s.zh, source: s.source, audio_url: s.audio_url })
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1
      return a.ab.length - b.ab.length
    })
  }, [words, sentences])

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

  async function handleSaveMerged(ab: string, dialect: string, def: string, type: 'word' | 'sentence') {
    await createItem({ text: ab, type, language: dialect, notes: def })
    setSaveMsg(type === 'word' ? `Saved "${ab}"` : 'Sentence saved')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCaptureMerged(ab: string, def: string) {
    const params = new URLSearchParams({ text: ab, notes: def })
    router.push(`/capture?${params}`)
  }

  async function handleSave(word: WordResult) {
    await createItem({
      text: word.word_ab,
      type: 'word',
      language: word.dialect_name,
      notes: word.word_ch,
    })
    setSaveMsg(`Saved "${word.word_ab}"`)
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCapture(word: WordResult) {
    const params = new URLSearchParams({ text: word.word_ab, notes: word.word_ch })
    router.push(`/capture?${params}`)
  }

  async function handleSaveSentence(s: SentenceResult) {
    await createItem({ text: s.ab, type: 'sentence', language: s.dialect_name, notes: s.zh })
    setSaveMsg('Sentence saved')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  function handleCaptureSentence(s: SentenceResult) {
    const params = new URLSearchParams({ text: s.ab, notes: s.zh })
    router.push(`/capture?${params}`)
  }

  const exactWord = words.find(w => w.exact)
  const otherWords = words.filter(w => !w.exact)

  const selectedDialect = dialects.find(d => d.glid === glid)
  const searchPlaceholder = selectedDialect
    ? `Search in ${selectedDialect.group_name}, Chinese or English`
    : 'Search in all languages, Chinese or English'

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScreenHeader title="Dictionary" langName={lang.name} langDialect={dialectLabel} settingsTab="dict" />

      {/* DB error banner */}
      {dbError && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: T.amberBg, border: `1px solid ${T.amber}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.terra }}>Database not found</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            Place <code>ycm_master.db</code> at <code>packages/dictionary/ycm_master.db</code>
          </div>
        </div>
      )}

      {/* Search row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, minWidth: 0,
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

        {/* Language filter */}
        {dialects.length > 0 && (
          <select
            value={glid}
            onChange={e => { setGlid(e.target.value); setUserChangedGlid(true) }}
            style={{
              height: 52, borderRadius: 14, border: `1px solid ${T.line}`,
              background: T.paperHi, color: glid ? T.ink : T.inkMute,
              fontSize: 12.5, fontWeight: 500, padding: '0 10px',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">All</option>
            {dialects.map(d => (
              <option key={d.glid} value={d.glid}>{d.group_name}</option>
            ))}
          </select>
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
                      key={`${entry.ab}|${entry.dialect_name}|${i}`}
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
    </div>
  )
}
