'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Icon, Button } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useActiveLang } from '@/lib/hooks/useActiveLang'
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
        <Button variant="primary" size="md" icon="bookmark" style={{ flex: 1 }} onClick={() => onSave(word)}>
          Save word
        </Button>
        <Button variant="secondary" size="md" icon="capture" style={{ flex: 1 }} onClick={() => onCapture(word)}>
          Add context
        </Button>
      </div>
    </Card>
  )
}

// ─── Sentence card ────────────────────────────────────────────
function SentenceCard({ s }: { s: SentenceResult }) {
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
        {s.audio_url && (
          <a href={s.audio_url} target="_blank" rel="noreferrer" style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: T.inkSoft, textDecoration: 'none',
          }}>
            <Icon name="speaker" size={13} strokeWidth={1.8} />
            Audio
          </a>
        )}
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
  const [dialects, setDialects] = useState<DialectOption[]>([])
  const [words, setWords] = useState<WordResult[]>([])
  const [sentences, setSentences] = useState<SentenceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load dialects once
  useEffect(() => {
    fetch('/api/dict/dialects')
      .then(r => r.json())
      .then(data => {
        if (data.dialects) setDialects(data.dialects)
        if (data.error) setDbError(data.error)
      })
  }, [])

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

  const exactWord = words.find(w => w.exact)
  const otherWords = words.filter(w => !w.exact)

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScreenHeader title="Dictionary" langName={lang.name} langDialect={dialectLabel} />

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
            placeholder="Search words or sentences…"
            autoComplete="off"
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
            onChange={e => setGlid(e.target.value)}
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

      {/* No results */}
      {!loading && searched && words.length === 0 && sentences.length === 0 && !dbError && (
        <div style={{ padding: '28px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
          <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>No results for "{q}"</div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>Try a different spelling or remove the language filter.</div>
        </div>
      )}

      {/* Exact word match */}
      {!loading && exactWord && (
        <ExactWordCard word={exactWord} onSave={handleSave} onCapture={handleCapture} />
      )}

      {/* Sentence examples */}
      {!loading && sentences.length > 0 && (
        <div>
          <SectionHead title="Sentences" action={`${sentences.length} found`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sentences.slice(0, 8).map(s => <SentenceCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* Other word matches */}
      {!loading && otherWords.length > 0 && (
        <div>
          <SectionHead title="Also matches" action={`${otherWords.length}`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {otherWords.slice(0, 20).map(w => (
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
                  <button onClick={() => handleSave(w)} aria-label="Save word" style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    <Icon name="bookmark" size={15} strokeWidth={1.8} />
                  </button>
                  <button onClick={() => handleCapture(w)} aria-label="Open in Capture" style={{
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

      {/* Empty state — no search yet */}
      {!searched && !loading && (
        <div style={{ padding: '32px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
          <Icon name="dict" size={28} color={T.inkFaint} strokeWidth={1.4} />
          <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500, marginTop: 10 }}>Search the YCM corpus</div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>Words and sentences across all 16 Formosan languages</div>
        </div>
      )}
    </div>
  )
}
