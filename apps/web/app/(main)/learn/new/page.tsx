'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { LANGUAGES } from '@/lib/languages'
import Icon from '@/components/ui/Icon'
import LangAvatar from '@/components/ui/LangAvatar'
import CollectionEditor from '@/components/learn/CollectionEditor'
import ImportDropzone from '@/components/learn/ImportDropzone'
import { saveCollection, type LevelInput } from '@/lib/db/progress/collections'

type Method = 'manual' | 'import'
type Step   = 'identity' | 'method' | 'editor'

const INITIAL_LEVELS: LevelInput[] = [{ lessons: [{ title: '', cards: [{ ab: '', zh: '' }] }] }]

export default function NewCollectionPage() {
  const router = useRouter()

  const [step,          setStep]          = useState<Step>('identity')
  const [method,        setMethod]        = useState<Method>('manual')
  const [importParsed,  setImportParsed]  = useState(false)
  const [name,          setName]          = useState('')
  const [langCode,      setLangCode]      = useState('ami')
  const [levels,        setLevels]        = useState<LevelInput[]>(INITIAL_LEVELS)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────
  const canContinue = name.trim().length > 0

  const handleSave = async () => {
    const hasCards = levels.some(lv =>
      lv.lessons.some(ls => ls.cards.some(c => c.ab.trim()))
    )
    if (!hasCards) { setError('Add at least one card with indigenous text.'); return }
    setError(null)
    setSaving(true)
    const id = await saveCollection(name.trim(), langCode, levels)
    setSaving(false)
    if (id) { router.push('/learn') }
    else     { setError('Failed to save. Please try again.') }
  }

  const handleImportParsed = (result: {
    name: string; language: string; levels: LevelInput[]; totalCards: number
  }) => {
    setName(prev => prev || result.name)
    setLangCode(result.language)
    setLevels(result.levels)
    setImportParsed(true)
    setStep('editor')
    // keep method = 'import' so we show the summary, not the CollectionEditor
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4, marginBottom: 24 }}>
        <Link href="/learn" style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, textDecoration: 'none',
        }}>
          <Icon name="arrow-l" size={16} strokeWidth={2} />
        </Link>
        <span style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 24, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
        }}>
          New collection
        </span>
      </div>

      {/* ── Step 1: Identity ─────────────────────────────────────────────────── */}
      {step === 'identity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="Collection name">
            <input
              autoFocus
              placeholder="e.g. Market vocabulary"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canContinue && setStep('method')}
              style={inputStyle}
            />
          </Field>

          <Field label="Language">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            }}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLangCode(lang.code)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 5, padding: '8px 4px', borderRadius: 12,
                    background: langCode === lang.code ? T.crimsonBg : T.paperHi,
                    border: `1.5px solid ${langCode === lang.code ? T.crimson : T.lineSoft}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <LangAvatar letter={lang.letter} color={lang.color} size={28} />
                  <span style={{
                    fontSize: 10, color: langCode === lang.code ? T.crimsonDp : T.inkSoft,
                    fontWeight: langCode === lang.code ? 700 : 400,
                  }}>
                    {lang.name}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <button
            onClick={() => setStep('method')}
            disabled={!canContinue}
            style={primaryBtnStyle(!canContinue)}
          >
            Continue <Icon name="arrow-r" size={17} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── Step 2: Method ───────────────────────────────────────────────────── */}
      {step === 'method' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 15, color: T.inkSoft, margin: 0 }}>
            How do you want to add content?
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MethodCard
              icon="pen"
              title="Add manually"
              desc="Build cards in the editor"
              active={method === 'manual'}
              onClick={() => { setMethod('manual'); setStep('editor') }}
            />
            <MethodCard
              icon="archive"
              title="Import file"
              desc=".json format"
              active={method === 'import'}
              onClick={() => { setMethod('import'); setStep('editor') }}
            />
            <MethodCard
              icon="capture"
              title="From captures"
              desc="Coming soon"
              disabled
              onClick={() => {}}
            />
          </div>

          <button
            onClick={() => setStep('identity')}
            style={{
              height: 36, padding: '0 14px', borderRadius: 10, fontSize: 13,
              background: 'transparent', border: `1px solid ${T.line}`,
              color: T.inkSoft, cursor: 'pointer', fontFamily: 'inherit',
              alignSelf: 'flex-start',
            }}
          >
            ← Back
          </button>
        </div>
      )}

      {/* ── Step 3: Editor or Import ─────────────────────────────────────────── */}
      {step === 'editor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            borderRadius: 12,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{name}</div>
              <div style={{ fontSize: 12, color: T.inkMute }}>
                {LANGUAGES.find(l => l.code === langCode)?.name ?? langCode}
              </div>
            </div>
            <button
              onClick={() => setStep('identity')}
              style={{
                height: 30, padding: '0 10px', borderRadius: 8, fontSize: 12,
                background: 'transparent', border: `1px solid ${T.lineSoft}`,
                color: T.inkMute, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Edit
            </button>
          </div>

          {method === 'import' && !importParsed && (
            <ImportDropzone onParsed={handleImportParsed} />
          )}

          {method === 'import' && importParsed && (
            <>
              <ImportedSummary levels={levels} />
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: T.crimsonBg, border: `1px solid #EFCAB8`,
                  fontSize: 13, color: T.crimsonDp,
                }}>{error}</div>
              )}
              <button onClick={handleSave} disabled={saving} style={primaryBtnStyle(saving)}>
                {saving ? 'Saving…' : 'Save collection'}
              </button>
            </>
          )}

          {method === 'manual' && (
            <>
              <CollectionEditor levels={levels} onChange={setLevels} />
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: T.crimsonBg, border: `1px solid #EFCAB8`,
                  fontSize: 13, color: T.crimsonDp,
                }}>{error}</div>
              )}
              <button onClick={handleSave} disabled={saving} style={primaryBtnStyle(saving)}>
                {saving ? 'Saving…' : 'Save collection'}
              </button>
            </>
          )}

          <button
            onClick={() => setStep('method')}
            style={{
              height: 36, padding: '0 14px', borderRadius: 10, fontSize: 13,
              background: 'transparent', border: `1px solid ${T.line}`,
              color: T.inkSoft, cursor: 'pointer', fontFamily: 'inherit',
              alignSelf: 'flex-start',
            }}
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ImportedSummary({ levels }: { levels: LevelInput[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
    })
  }, [])
  const totalCards = levels.reduce((s, lv) => s + lv.lessons.reduce((ss, ls) => ss + ls.cards.length, 0), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: T.inkFaint, marginBottom: 4 }}>
        {totalCards} cards · {levels.reduce((s, lv) => s + lv.lessons.length, 0)} lessons
      </div>
      {levels.flatMap((lv, li) =>
        lv.lessons.map((ls, lsi) => {
          const key = `${li}-${lsi}`
          const open = expanded.has(key)
          return (
            <div key={key} style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => toggle(key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="chevron" size={12} strokeWidth={2} color={T.inkFaint}
                    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
                  <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: T.inkFaint }}>
                    L{li + 1}-{lsi + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>
                    {ls.title || <em style={{ color: T.inkFaint, fontWeight: 400 }}>Untitled</em>}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: T.inkFaint }}>{ls.cards.length} cards</span>
              </button>
              {open && (
                <div style={{ borderTop: `1px solid ${T.lineSoft}`, padding: '6px 12px 8px' }}>
                  {ls.cards.slice(0, 10).map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '3px 0', fontSize: 12 }}>
                      <span style={{ color: T.ink, minWidth: 100, flexShrink: 0 }}>{c.ab}</span>
                      <span style={{ color: T.inkSoft }}>{c.zh}</span>
                    </div>
                  ))}
                  {ls.cards.length > 10 && (
                    <span style={{ fontSize: 11, color: T.inkFaint }}>+{ls.cards.length - 10} more…</span>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: T.inkMute,
        fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</label>
      {children}
    </div>
  )
}

function MethodCard({ icon, title, desc, active, disabled, onClick }: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string; desc: string; active?: boolean; disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 6, padding: '14px', borderRadius: 14, cursor: disabled ? 'default' : 'pointer',
        background: active ? T.crimsonBg : T.paperHi,
        border: `1.5px solid ${active ? T.crimson : T.lineSoft}`,
        opacity: disabled ? 0.4 : 1, fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <Icon name={icon} size={20} strokeWidth={1.6} color={active ? T.crimson : T.inkSoft} />
      <span style={{ fontSize: 14, fontWeight: 600, color: active ? T.crimsonDp : T.ink }}>{title}</span>
      <span style={{ fontSize: 12, color: T.inkFaint }}>{desc}</span>
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  height: 44, padding: '0 14px', borderRadius: 12, fontSize: 15,
  background: T.paperHi, border: `1px solid ${T.lineSoft}`,
  color: T.ink, fontFamily: 'inherit', outline: 'none', width: '100%',
}

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  height: 48, borderRadius: 14, fontSize: 15, fontWeight: 600,
  background: disabled ? T.lineSoft : T.crimson, color: disabled ? T.inkFaint : '#fff',
  border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
  opacity: disabled ? 0.6 : 1,
})
