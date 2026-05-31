'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { listUserLanguages, listCustomSessionMeta } from '@/lib/db/srs/flashcards'
import { listCollections, type CollectionMeta } from '@/lib/db/progress/collections'
import { getLangName, getGlid, getDialectsForLang } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'
import { FLAG_COLORS, flagColorHex } from '@/lib/db/srs/flags'

type Props = { open: boolean; onClose: () => void }

const NOTE_TYPE_LABELS: Record<string, string> = {
  word: 'Word', sentence: 'Sentence', phrase: 'Phrase',
  dialogue: 'Dialogue', text: 'Text',
}

export default function CustomSessionSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [langs,       setLangs]       = useState<string[]>([])
  const [collections, setCollections] = useState<CollectionMeta[]>([])
  const [noteTypes,   setNoteTypes]   = useState<string[]>([])
  const [allTags,     setAllTags]     = useState<string[]>([])
  const [allPlaces,   setAllPlaces]   = useState<string[]>([])

  // Filters
  const [lang,         setLang]         = useState('')
  const [dialect,      setDialect]      = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [capturesOnly, setCapturesOnly] = useState(false)
  const [noteType,     setNoteType]     = useState('')
  const [cardType,     setCardType]     = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [flagColors,   setFlagColors]   = useState<string[]>([])  // empty = all
  const [placeHeard,   setPlaceHeard]   = useState('')
  const [dueOnly,      setDueOnly]      = useState(true)

  useEffect(() => {
    if (!open) return
    Promise.all([
      listUserLanguages(),
      listCollections(),
      listCustomSessionMeta(),
    ]).then(([l, c, meta]) => {
      setLangs(l); setCollections(c)
      setNoteTypes(meta.types); setAllTags(meta.tags); setAllPlaces(meta.places)
    })
  }, [open])

  useEffect(() => { setDialect('') }, [lang])

  if (!open) return null

  const dialects = lang ? getDialectsForLang(lang) : []
  const glid = lang ? (getGlid(lang) ?? '01') : '01'

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function toggleFlagColor(key: string) {
    setFlagColors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function handleStart() {
    const params = new URLSearchParams({ custom: '1' })
    if (lang)                params.set('lang', lang)
    if (dialect)             params.set('dialect', dialect)
    if (collectionId)        params.set('collectionId', collectionId)
    else if (capturesOnly)   params.set('capturesOnly', 'true')
    if (noteType)            params.set('noteType', noteType)
    if (cardType)            params.set('cardType', cardType)
    if (selectedTags.length) params.set('tags', selectedTags.join(','))
    if (flagColors.length)   params.set('flag', flagColors.join(','))
    if (placeHeard)          params.set('placeHeard', placeHeard)
    if (!dueOnly)            params.set('dueOnly', 'false')
    router.push(`/review?${params}`)
    onClose()
  }

  const sel: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 9, background: T.paperHi,
    border: `1px solid ${T.line}`, fontSize: 13.5, color: T.ink,
    fontFamily: 'inherit', cursor: 'pointer',
    appearance: 'none' as const, WebkitAppearance: 'none' as const,
    width: 168, flexShrink: 0,
  }
  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 0', borderBottom: `1px solid ${T.lineSoft}`,
  }
  const lbl: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: T.ink }
  const sub: React.CSSProperties = { fontSize: 11, color: T.inkMute, marginTop: 1 }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,10,0.35)', zIndex: 70 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: T.paper, borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`, zIndex: 71,
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'flex', flexDirection: 'column', maxHeight: '90dvh',
      }}>
        {/* Header */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 0' }}>
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink }}>
              Custom session
            </span>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 999, background: T.paperHi,
              border: `1px solid ${T.lineSoft}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: T.inkMute,
            }}>
              <Icon name="x" size={14} strokeWidth={2} />
            </button>
          </div>
          <div style={{ height: 1, background: T.lineSoft, margin: '10px 18px 0' }} />
        </div>

        {/* Scrollable filters */}
        <div style={{ overflowY: 'auto', padding: '4px 18px 0', flex: 1 }}>

          {/* Due only — top */}
          <div style={{ ...row, borderBottom: `1px solid ${T.lineSoft}` }}>
            <div><div style={lbl}>Due only</div><div style={sub}>Off = include all matching cards</div></div>
            <button onClick={() => setDueOnly(v => !v)} style={{
              width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: dueOnly ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', transition: 'background .15s',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: dueOnly ? 21 : 3, width: 20, height: 20,
                borderRadius: 999, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
              }} />
            </button>
          </div>

          {/* Language — only shown when user has multiple languages */}
          {langs.length > 1 && (
            <div style={row}>
              <div><div style={lbl}>Language</div></div>
              <select value={lang} onChange={e => { setLang(e.target.value); setCollectionId('') }} style={sel}>
                <option value="">All</option>
                {langs.map(l => <option key={l} value={l}>{getLangName(l)}</option>)}
              </select>
            </div>
          )}

          {/* Dialect */}
          {dialects.length > 1 && (
            <div style={row}>
              <div><div style={lbl}>Dialect</div></div>
              <select value={dialect} onChange={e => setDialect(e.target.value)} style={sel}>
                <option value="">All dialects</option>
                {dialects.map(d => <option key={d} value={d}>{shortDialectLabel(d, glid)}</option>)}
              </select>
            </div>
          )}

          {/* Source */}
          <div style={row}>
            <div><div style={lbl}>Source</div><div style={sub}>Collection or captures</div></div>
            <select
              value={collectionId || (capturesOnly ? '__cap__' : '')}
              onChange={e => {
                if (e.target.value === '__cap__') { setCapturesOnly(true); setCollectionId('') }
                else { setCapturesOnly(false); setCollectionId(e.target.value) }
              }}
              style={sel}
            >
              <option value="">All sources</option>
              <option value="__cap__">Captures only</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Place heard */}
          {allPlaces.length > 0 && (
            <div style={row}>
              <div><div style={lbl}>Place heard</div></div>
              <select value={placeHeard} onChange={e => setPlaceHeard(e.target.value)} style={sel}>
                <option value="">Anywhere</option>
                {allPlaces.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* Note type */}
          {noteTypes.length > 1 && (
            <div style={row}>
              <div><div style={lbl}>Note type</div></div>
              <select value={noteType} onChange={e => setNoteType(e.target.value)} style={sel}>
                <option value="">All types</option>
                {noteTypes.map(t => <option key={t} value={t}>{NOTE_TYPE_LABELS[t] ?? t}</option>)}
              </select>
            </div>
          )}

          {/* Card type */}
          <div style={row}>
            <div><div style={lbl}>Card type</div></div>
            <select value={cardType} onChange={e => setCardType(e.target.value)} style={sel}>
              <option value="">All</option>
              <option value="default">Default</option>
              <option value="sts">STS</option>
            </select>
          </div>

          {/* Flag — dot toggles */}
          <div style={{ padding: '11px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ ...lbl, marginBottom: 10 }}>Flag</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {FLAG_COLORS.map(f => {
                const on = flagColors.includes(f.key)
                return (
                  <button key={f.key} onClick={() => toggleFlagColor(f.key)} aria-label={f.key} style={{
                    width: 28, height: 28, borderRadius: 999, cursor: 'pointer',
                    background: flagColorHex(f.key) ?? undefined,
                    border: `3px solid ${on ? T.ink : 'transparent'}`,
                    boxShadow: on ? `0 0 0 1px ${flagColorHex(f.key)}` : 'none',
                    flexShrink: 0,
                  }} />
                )
              })}
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div style={{ padding: '11px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
              <div style={{ ...lbl, marginBottom: 8 }}>Tags <span style={{ ...sub, display: 'inline', marginLeft: 4 }}>any match</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allTags.map(tag => {
                  const on = selectedTags.includes(tag)
                  return (
                    <button key={tag} onClick={() => toggleTag(tag)} style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                      background: on ? T.crimson : T.paperHi,
                      color: on ? '#fff' : T.inkSoft,
                      border: `1px solid ${on ? T.crimson : T.line}`,
                      fontWeight: on ? 600 : 400,
                    }}>
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Start button */}
        <div style={{ padding: '12px 18px', flexShrink: 0, borderTop: `1px solid ${T.lineSoft}` }}>
          <button onClick={handleStart} style={{
            width: '100%', height: 52, borderRadius: 13, border: 'none',
            background: T.crimson, color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2)',
          }}>
            Start session
          </button>
        </div>
      </div>
    </>
  )
}
