'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { listUserLanguages } from '@/lib/db/srs/flashcards'
import { listCollections, type CollectionMeta } from '@/lib/db/progress/collections'
import { getLangName, getGlid, getDialectsForLang } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'

type Props = { open: boolean; onClose: () => void }

export default function CustomSessionSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [langs,       setLangs]       = useState<string[]>([])
  const [collections, setCollections] = useState<CollectionMeta[]>([])

  const [lang,         setLang]         = useState('')
  const [dialect,      setDialect]      = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [capturesOnly, setCapturesOnly] = useState(false)
  const [dueOnly,      setDueOnly]      = useState(true)

  useEffect(() => {
    if (!open) return
    Promise.all([listUserLanguages(), listCollections()]).then(([l, c]) => {
      setLangs(l); setCollections(c)
    })
  }, [open])

  // Reset dialect when language changes
  useEffect(() => { setDialect('') }, [lang])

  if (!open) return null

  const dialects = lang ? getDialectsForLang(lang) : []
  const glid = lang ? (getGlid(lang) ?? '01') : '01'

  function handleStart() {
    const params = new URLSearchParams({ custom: '1' })
    if (lang)         params.set('lang', lang)
    if (dialect)      params.set('dialect', dialect)
    if (collectionId) params.set('collectionId', collectionId)
    else if (capturesOnly) params.set('capturesOnly', 'true')
    if (!dueOnly)     params.set('dueOnly', 'false')
    router.push(`/review?${params}`)
    onClose()
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '13px 0', borderBottom: `1px solid ${T.lineSoft}`,
  }
  const labelStyle: React.CSSProperties = { fontSize: 14.5, fontWeight: 600, color: T.ink }
  const subStyle:   React.CSSProperties = { fontSize: 11.5, color: T.inkMute, marginTop: 1 }
  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 9, background: T.paperHi,
    border: `1px solid ${T.line}`, fontSize: 13.5, color: T.ink,
    fontFamily: 'inherit', cursor: 'pointer', appearance: 'none' as const,
    WebkitAppearance: 'none' as const, minWidth: 140, textAlign: 'right',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,10,0.35)', zIndex: 70 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: T.paper, borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`, zIndex: 71,
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
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

        <div style={{ padding: '4px 18px 20px', display: 'flex', flexDirection: 'column' }}>

          {/* Language */}
          <div style={rowStyle}>
            <div><div style={labelStyle}>Language</div><div style={subStyle}>Filter by language</div></div>
            <select value={lang} onChange={e => { setLang(e.target.value); setCollectionId('') }} style={selectStyle}>
              <option value="">All</option>
              {langs.map(l => <option key={l} value={l}>{getLangName(l)}</option>)}
            </select>
          </div>

          {/* Dialect — only when language has multiple dialects */}
          {dialects.length > 1 && (
            <div style={rowStyle}>
              <div><div style={labelStyle}>Dialect</div><div style={subStyle}>Filter by dialect</div></div>
              <select value={dialect} onChange={e => setDialect(e.target.value)} style={selectStyle}>
                <option value="">All dialects</option>
                {dialects.map(d => (
                  <option key={d} value={d}>{shortDialectLabel(d, glid)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Source */}
          <div style={rowStyle}>
            <div><div style={labelStyle}>Source</div><div style={subStyle}>Collection or captures</div></div>
            <select
              value={collectionId || (capturesOnly ? '__captures__' : '')}
              onChange={e => {
                if (e.target.value === '__captures__') { setCapturesOnly(true); setCollectionId('') }
                else { setCapturesOnly(false); setCollectionId(e.target.value) }
              }}
              style={selectStyle}
            >
              <option value="">All sources</option>
              <option value="__captures__">Captures only</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Due only toggle */}
          <div style={{ ...rowStyle, borderBottom: 'none', paddingBottom: 4 }}>
            <div><div style={labelStyle}>Due only</div><div style={subStyle}>Off = include all matching cards</div></div>
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

          <button onClick={handleStart} style={{
            marginTop: 16, height: 52, borderRadius: 13, border: 'none',
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
