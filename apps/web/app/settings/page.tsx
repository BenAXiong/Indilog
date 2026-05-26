'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Chip, LangAvatar, Icon } from '@/components/ui'
import { LANGUAGES, getLanguage } from '@/lib/languages'
import { getGlid, getDialectsForLang } from '@/lib/learn/lang-bridge'
import { shortDialectLabel } from '@/lib/learn/dialects'
import type { User } from '@supabase/supabase-js'

type Profile = {
  active_study_language: string
  default_dialect: string | null
  ui_locale: string
  daily_goal: number
}

const ACCOUNT_ROWS = [
  { label: 'Export notebook', icon: 'bookmark' as const },
  { label: 'About Indilog',   icon: 'leaf'     as const },
  { label: 'Sign out',        icon: 'logout'   as const, danger: true },
]

export default function SettingsPage() {
  const router = useRouter()
  const [user,          setUser]          = useState<User | null>(null)
  const [activeLang,    setActiveLang]    = useState('ami')
  const [activeDialect, setActiveDialect] = useState<string | null>(null)
  const [goal,          setGoal]          = useState(20)
  const [locale,        setLocale]        = useState('en')
  const [saving,        setSaving]        = useState(false)
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [pickedLang,    setPickedLang]    = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (!user) return
      supabase
        .from('ind_profiles')
        .select('active_study_language, default_dialect, ui_locale, daily_goal')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return
          setActiveLang(data.active_study_language)
          setActiveDialect(data.default_dialect)
          setLocale(data.ui_locale)
          setGoal(data.daily_goal)
        })
    })
  }, [])

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('ind_profiles').update(patch).eq('user_id', user.id)
    setSaving(false)
  }, [user])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleRowClick(label: string) {
    if (label === 'Sign out') handleSignOut()
  }

  function closePicker() {
    setLangPickerOpen(false)
    setPickedLang(null)
  }

  const currentLang   = getLanguage(activeLang) ?? LANGUAGES[0]
  const langGlid      = getGlid(activeLang) ?? '01'
  const dialectLabel  = activeDialect ? shortDialectLabel(activeDialect, langGlid) : null

  const displayName  = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '—'
  const displayEmail = user?.email ?? '—'

  return (
    <div style={{ padding: '4px 0 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <Link href="/" aria-label="Back to dashboard" style={{
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

      {/* Profile card */}
      <div style={{ padding: '0 18px' }}>
        <Card raised pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999, background: T.amberBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C6515',
            border: `1px solid ${T.amber}`,
          }}>
            <Icon name="user" size={22} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{displayName}</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{displayEmail}</div>
          </div>
          <Chip size="sm" tone="sage">{saving ? 'saving…' : 'synced'}</Chip>
        </Card>
      </div>

      {/* Active study language */}
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
          {/* Interface language */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>Interface language</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'en', label: 'English', soon: false },
                { id: 'zh', label: '繁體中文', soon: true },
              ].map(o => {
                const isActive = locale === o.id
                let labelColor: string = T.ink
                if (isActive) labelColor = T.cream
                else if (o.soon) labelColor = T.inkFaint
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

          {/* Daily review goal */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Daily review goal</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 600, color: T.crimson }}>
                  {goal}
                </span>
                <span style={{ fontSize: 11, color: T.inkMute }}>cards</span>
              </div>
            </div>
            <input
              type="range" min="5" max="50" step="5" value={goal}
              onChange={e => setGoal(Number(e.target.value))}
              onMouseUp={e => saveProfile({ daily_goal: Number((e.target as HTMLInputElement).value) })}
              onTouchEnd={e => saveProfile({ daily_goal: Number((e.target as HTMLInputElement).value) })}
              style={{ width: '100%', accentColor: T.crimson }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: T.inkFaint, marginTop: 2,
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              <span>5</span><span>25</span><span>50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Account" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
        }}>
          {ACCOUNT_ROWS.map((row, i, arr) => (
            <button
              key={row.label}
              onClick={() => handleRowClick(row.label)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 14px', textAlign: 'left',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                color: row.danger ? T.crimson : T.ink,
                background: 'none', cursor: 'pointer', border: 'none',
              }}
            >
              <Icon name={row.icon} size={17} color={row.danger ? T.crimson : T.inkSoft} strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{row.label}</span>
              {!row.danger && <Icon name="chevron" size={14} color={T.inkFaint} />}
            </button>
          ))}
        </div>
        <div style={{
          textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
          color: T.inkFaint, marginTop: 14, letterSpacing: '0.05em',
        }}>
          Indilog v0.1 · 行動族語筆記本
        </div>
      </div>

      {/* Language + dialect picker overlay */}
      {langPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <div
            onClick={closePicker}
            style={{ position: 'absolute', inset: 0, background: 'rgba(30,15,5,0.4)' }}
          />

          {/* Sheet */}
          <div style={{
            position: 'relative', background: T.paper,
            borderRadius: '20px 20px 0 0',
            paddingTop: 16, paddingBottom: 'max(48px, env(safe-area-inset-bottom))',
            maxHeight: '80dvh', overflowY: 'auto',
          }}>
            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 999, background: T.line,
              margin: '0 auto 16px',
            }} />

            {/* Sheet header */}
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
                /* Language list */
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
                /* Dialect list */
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
                    const dGlid  = getGlid(pickedLang) ?? '01'
                    const label  = shortDialectLabel(d, dGlid)
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
