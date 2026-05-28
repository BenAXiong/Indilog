'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { T } from '@/lib/tokens'
import { Card, SectionHead, LangAvatar, Icon } from '@/components/ui'
import { LANGUAGES } from '@/lib/languages'
import { getGlid, getDialectsForLang } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'
import { useLang } from '@/lib/context/LangDialectProvider'
import type { User } from '@supabase/supabase-js'

function SettingsContent() {
  const searchParams = useSearchParams()
  const tab  = (searchParams.get('tab') ?? 'general') as 'general' | 'capture' | 'dict'
  const from = searchParams.get('from') ?? '/'
  const router = useRouter()

  const { lang, dialect, dialectLabel, setLang, setDialect } = useLang()

  const [user,            setUser]            = useState<User | null>(null)
  const [locale,          setLocale]          = useState('en')
  const [saving,          setSaving]          = useState(false)
  const [langPickerOpen,  setLangPickerOpen]  = useState(false)
  const [pickedLang,      setPickedLang]      = useState<string | null>(null)
  const [userId,          setUserId]          = useState<string | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  const [autoLookup,  setAutoLookup]  = useState(true)
  const [dictSources, setDictSources] = useState<string[]>(['klokah'])

  useEffect(() => {
    const stored = localStorage.getItem('ind_auto_lookup')
    if (stored !== null) setAutoLookup(stored === 'true')
    const storedSources = localStorage.getItem('ind_dict_sources')
    if (storedSources) {
      try { setDictSources(JSON.parse(storedSources)) } catch {}
    }
  }, [])

  // Fetch user identity and locale only — lang/dialect come from LangDialectProvider
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUser(user)
      setUserId(user.id)
      supabase
        .from('ind_profiles')
        .select('ui_locale')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => { if (data) setLocale(data.ui_locale) })
    })
  }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const saveLocale = useCallback(async (locale: string) => {
    if (!userId) return
    setSaving(true)
    await createClient().from('ind_profiles').update({ ui_locale: locale }).eq('user_id', userId)
    setSaving(false)
  }, [userId])

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function closePicker() { setLangPickerOpen(false); setPickedLang(null) }

  function toggleAutoLookup() {
    const next = !autoLookup
    setAutoLookup(next)
    localStorage.setItem('ind_auto_lookup', String(next))
  }

  function toggleDictSource(id: string) {
    setDictSources(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
      localStorage.setItem('ind_dict_sources', JSON.stringify(next))
      return next
    })
  }

  const displayName  = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '—'
  const displayEmail = user?.email ?? '—'

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

      {/* ── General tab ── */}
      {tab === 'general' && (
        <>
          {/* Account card */}
          <div style={{ padding: '0 18px' }}>
            <Card raised pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 999, background: T.amberBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${T.amber}`, flexShrink: 0,
              }}>
                <Icon name="user" size={22} strokeWidth={1.6} color="#8C6515" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayEmail}
                </div>
              </div>
              <div ref={accountMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => setAccountMenuOpen(v => !v)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: accountMenuOpen ? T.paper : 'transparent',
                    border: `1px solid ${accountMenuOpen ? T.lineSoft : 'transparent'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T.inkSoft,
                  }}
                >
                  <Icon name="more-v" size={18} strokeWidth={2.2} color={T.inkSoft} />
                </button>
                {accountMenuOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50,
                    background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(43,34,26,0.12)',
                    minWidth: 160, overflow: 'hidden',
                  }}>
                    {[
                      { label: 'Change account', icon: 'user' as const,   action: () => {} },
                      { label: 'About Indilog',  icon: 'leaf' as const,   action: () => {} },
                      { label: 'Sign out',       icon: 'logout' as const, action: handleSignOut, danger: true },
                    ].map((item, i, arr) => (
                      <button
                        key={item.label}
                        onClick={() => { setAccountMenuOpen(false); item.action() }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '11px 14px', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                          color: item.danger ? T.crimson : T.ink,
                          fontSize: 13.5, fontWeight: 500,
                        }}
                      >
                        <Icon name={item.icon} size={15} strokeWidth={1.8}
                          color={item.danger ? T.crimson : T.inkSoft} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            {saving && (
              <div style={{ fontSize: 11, color: T.inkFaint, textAlign: 'right', marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>
                saving…
              </div>
            )}
          </div>

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
              <LangAvatar letter={lang.letter} color={lang.color} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 600, color: T.ink }}>
                  {lang.name}
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
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
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
                          saveLocale(o.id)
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
          </div>
        </>
      )}

      {/* ── Capture tab ── */}
      {tab === 'capture' && (
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <SectionHead title="Lookup" />
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Auto-lookup</div>
                  <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>
                    Automatically search definitions as you type
                  </div>
                </div>
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
        </div>
      )}

      {/* ── Dictionary tab ── */}
      {tab === 'dict' && (
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <SectionHead title="Interface language" />
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { id: 'en', label: 'English',   soon: false },
                    { id: 'zh', label: '繁體中文', soon: true  },
                  ].map(o => {
                    const isActive = locale === o.id
                    return (
                      <button
                        key={o.id}
                        disabled={o.soon}
                        onClick={() => {
                          if (o.soon) return
                          setLocale(o.id)
                          saveLocale(o.id)
                        }}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 10,
                          background: isActive ? T.ink : T.paper,
                          color: isActive ? T.cream : o.soon ? T.inkFaint : T.ink,
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
          </div>

          <div>
            <SectionHead title="Dictionary source" />
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { id: 'klokah', label: 'Klokah',        soon: false },
                    { id: 'ytd',    label: '族語言線上辭典', soon: true  },
                    { id: 'moe',    label: 'MoE Dict',       soon: true  },
                  ] as const).map(o => {
                    const isActive = dictSources.includes(o.id)
                    return (
                      <button
                        key={o.id}
                        disabled={o.soon}
                        onClick={() => { if (!o.soon) toggleDictSource(o.id) }}
                        style={{
                          flex: 1, padding: '8px 6px', borderRadius: 10,
                          background: isActive ? T.ink : T.paper,
                          border: `1px solid ${isActive ? T.ink : T.lineSoft}`,
                          cursor: o.soon ? 'not-allowed' : 'pointer',
                          opacity: o.soon ? 0.5 : 1,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? T.cream : T.ink, lineHeight: 1.2 }}>
                          {o.label}
                        </span>
                        {o.soon && (
                          <span style={{ fontSize: 9.5, color: isActive ? T.cream : T.inkFaint, fontWeight: 400 }}>
                            soon
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Language + dialect picker overlay */}
      {langPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={closePicker} style={{ position: 'absolute', inset: 0, background: 'rgba(30,15,5,0.4)' }} />
          <div style={{
            position: 'relative', background: T.paper,
            borderRadius: '20px 20px 0 0',
            paddingTop: 16, paddingBottom: 'max(48px, env(safe-area-inset-bottom))',
            maxHeight: '80dvh', overflowY: 'auto',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: T.ink, fontFamily: 'Newsreader, Georgia, serif' }}>
                {pickedLang ? 'Choose dialect' : 'Study language'}
              </span>
              <button onClick={closePicker} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: T.inkSoft }}>
                <Icon name="x" size={20} strokeWidth={2} color={T.inkSoft} />
              </button>
            </div>

            <div style={{ padding: '0 10px' }}>
              {pickedLang === null ? (
                LANGUAGES.map(l => {
                  const isActive = l.code === lang.code
                  return (
                    <button
                      key={l.code}
                      onClick={() => {
                        const dialects = getDialectsForLang(l.code)
                        if (dialects.length > 1) {
                          setPickedLang(l.code)
                        } else {
                          setLang(l.code)
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
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: T.inkSoft, fontSize: 13, marginBottom: 10, padding: '4px 8px' }}
                  >
                    <Icon name="arrow-l" size={15} strokeWidth={2} color={T.inkSoft} />
                    Back
                  </button>
                  {getDialectsForLang(pickedLang).map(d => {
                    const label    = shortDialectLabel(d, getGlid(pickedLang) ?? '01')
                    const isActive = d === dialect && pickedLang === lang.code
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setLang(pickedLang)
                          setDialect(d)
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
