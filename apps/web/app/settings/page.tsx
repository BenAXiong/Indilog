'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { T } from '@/lib/tokens'
import { SectionHead, LangAvatar, Icon } from '@/components/ui'
import { LANGUAGES, getLanguage } from '@/lib/languages'
import { getGlid, getDialectsForLang } from '@/lib/learn/lang-bridge'
import { shortDialectLabel } from '@/lib/learn/dialects'

type Profile = {
  active_study_language: string
  default_dialect: string | null
  ui_locale: string
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'capture', label: 'Capture' },
] as const

type TabId = typeof TABS[number]['id']

function SettingsContent() {
  const searchParams = useSearchParams()
  const tab  = (searchParams.get('tab') ?? 'general') as TabId
  const from = searchParams.get('from') ?? '/'

  const [activeLang,    setActiveLang]    = useState('ami')
  const [activeDialect, setActiveDialect] = useState<string | null>(null)
  const [locale,        setLocale]        = useState('en')
  const [saving,        setSaving]        = useState(false)
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [pickedLang,    setPickedLang]    = useState<string | null>(null)
  const [userId,        setUserId]        = useState<string | null>(null)

  // Capture settings
  const [autoLookup, setAutoLookup] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('ind_auto_lookup')
    if (stored !== null) setAutoLookup(stored === 'true')
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('ind_profiles')
        .select('active_study_language, default_dialect, ui_locale')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return
          setActiveLang(data.active_study_language)
          setActiveDialect(data.default_dialect)
          setLocale(data.ui_locale)
        })
    })
  }, [])

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('ind_profiles').update(patch).eq('user_id', userId)
    setSaving(false)
  }, [userId])

  function closePicker() {
    setLangPickerOpen(false)
    setPickedLang(null)
  }

  function toggleAutoLookup() {
    const next = !autoLookup
    setAutoLookup(next)
    localStorage.setItem('ind_auto_lookup', String(next))
  }

  const currentLang  = getLanguage(activeLang) ?? LANGUAGES[0]
  const langGlid     = getGlid(activeLang) ?? '01'
  const dialectLabel = activeDialect ? shortDialectLabel(activeDialect, langGlid) : null

  return (
    <div style={{ padding: '4px 0 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <Link href={from} aria-label="Back" style={{
            width: 36, height: 36, borderRadius: 999, background: T.paperHi,
            border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.inkSoft, flexShrink: 0,
          }}>
            <Icon name="arrow-l" size={17} strokeWidth={1.8} />
          </Link>
          <h1 style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 26, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            Settings
          </h1>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '0 18px' }}>
        <div style={{
          display: 'flex', gap: 0,
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12,
          padding: 3,
        }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <Link
                key={t.id}
                href={`/settings?tab=${t.id}&from=${encodeURIComponent(from)}`}
                style={{
                  flex: 1, textAlign: 'center', padding: '8px 0',
                  borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? T.ink : T.inkSoft,
                  background: active ? T.paper : 'transparent',
                  border: `1px solid ${active ? T.lineSoft : 'transparent'}`,
                  textDecoration: 'none',
                  boxShadow: active ? '0 1px 4px rgba(43,34,26,0.08)' : 'none',
                  transition: 'background 0.15s',
                }}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── General tab ── */}
      {tab === 'general' && (
        <>
          {/* Study language */}
          <div style={{ padding: '0 18px' }}>
            <SectionHead title="Study language" />
            <button
              onClick={() => setLangPickerOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '12px 14px', borderRadius: 16, cursor: 'pointer',
                background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                textAlign: 'left',
              }}
            >
              <LangAvatar letter={currentLang.letter} color={currentLang.color} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 600, color: T.ink }}>
                  {currentLang.name}
                </div>
                {dialectLabel && (
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{dialectLabel}</div>
                )}
              </div>
              <Icon name="review" size={18} color={T.inkSoft} strokeWidth={1.8} />
            </button>
          </div>

          {/* Preferences */}
          <div style={{ padding: '0 18px' }}>
            <SectionHead title="Preferences" />
            <div style={{
              background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>Interface language</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { id: 'en', label: 'English',   soon: false },
                    { id: 'zh', label: '繁體中文', soon: true  },
                  ].map(o => {
                    const isActive = locale === o.id
                    const labelColor = isActive ? T.cream : o.soon ? T.inkFaint : T.ink
                    return (
                      <button
                        key={o.id}
                        disabled={o.soon}
                        onClick={() => {
                          if (o.soon) return
                          setLocale(o.id)
                          saveProfile({ ui_locale: o.id })
                        }}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 10,
                          background: isActive ? T.ink : T.paper,
                          color: labelColor,
                          border: `1px solid ${isActive ? T.ink : T.lineSoft}`,
                          fontSize: 13, fontWeight: 500,
                          cursor: o.soon ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {o.label}{o.soon ? ' · soon' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            {saving && (
              <div style={{
                fontSize: 11, color: T.inkFaint, textAlign: 'right', marginTop: 6,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                saving…
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Capture tab ── */}
      {tab === 'capture' && (
        <div style={{ padding: '0 18px' }}>
          <SectionHead title="Lookup" />
          <div style={{
            background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Auto-lookup</div>
                <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>
                  Automatically search definitions as you type
                </div>
              </div>
              {/* Toggle switch */}
              <button
                onClick={toggleAutoLookup}
                aria-checked={autoLookup}
                role="switch"
                style={{
                  width: 44, height: 26, borderRadius: 999,
                  background: autoLookup ? T.crimson : T.lineSoft,
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: autoLookup ? 21 : 3,
                  width: 20, height: 20, borderRadius: 999,
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language + dialect picker overlay */}
      {langPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div
            onClick={closePicker}
            style={{ position: 'absolute', inset: 0, background: 'rgba(30,15,5,0.4)' }}
          />
          <div style={{
            position: 'relative', background: T.paper,
            borderRadius: '20px 20px 0 0',
            paddingTop: 16, paddingBottom: 'max(48px, env(safe-area-inset-bottom))',
            maxHeight: '80dvh', overflowY: 'auto',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '0 auto 16px' }} />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 18px', marginBottom: 12,
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: T.ink, fontFamily: 'Newsreader, Georgia, serif' }}>
                {pickedLang ? 'Choose dialect' : 'Study language'}
              </span>
              <button
                onClick={closePicker}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: T.inkSoft }}
              >
                <Icon name="x" size={20} strokeWidth={2} color={T.inkSoft} />
              </button>
            </div>

            <div style={{ padding: '0 10px' }}>
              {pickedLang === null ? (
                LANGUAGES.map(l => {
                  const isActive = l.code === activeLang
                  return (
                    <button
                      key={l.code}
                      onClick={() => {
                        const dialects = getDialectsForLang(l.code)
                        if (dialects.length > 1) {
                          setPickedLang(l.code)
                        } else {
                          const dialect = dialects[0] ?? null
                          setActiveLang(l.code)
                          setActiveDialect(dialect)
                          saveProfile({ active_study_language: l.code, default_dialect: dialect })
                          closePicker()
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '10px 10px', borderRadius: 12,
                        background: isActive ? T.crimsonBg : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <LangAvatar letter={l.letter} color={l.color} size={32} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400, color: T.ink }}>
                        {l.name}
                        {l.nativeName && (
                          <span style={{ fontSize: 11.5, color: T.inkMute, fontWeight: 400 }}> · {l.nativeName}</span>
                        )}
                      </span>
                      {isActive && <Icon name="check" size={16} color={T.crimson} strokeWidth={2.4} />}
                    </button>
                  )
                })
              ) : (
                <div>
                  <button
                    onClick={() => setPickedLang(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: T.inkSoft, fontSize: 13, marginBottom: 10, padding: '4px 8px',
                    }}
                  >
                    <Icon name="arrow-l" size={15} strokeWidth={2} color={T.inkSoft} />
                    Back
                  </button>
                  {getDialectsForLang(pickedLang).map(d => {
                    const dGlid   = getGlid(pickedLang) ?? '01'
                    const label   = shortDialectLabel(d, dGlid)
                    const isActive = d === activeDialect && pickedLang === activeLang
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setActiveLang(pickedLang)
                          setActiveDialect(d)
                          saveProfile({ active_study_language: pickedLang, default_dialect: d })
                          closePicker()
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '12px 10px', borderRadius: 12,
                          background: isActive ? T.crimsonBg : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400, color: T.ink }}>
                          {label}
                        </span>
                        {isActive && <Icon name="check" size={16} color={T.crimson} strokeWidth={2.4} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
