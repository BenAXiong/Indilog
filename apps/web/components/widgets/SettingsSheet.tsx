'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { T } from '@/lib/tokens'
import { LangAvatar, Icon } from '@/components/ui'
import { LANGUAGES } from '@/lib/languages'
import { getGlid, getDialectsForLang, getLangName } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'
import { useLang } from '@/lib/context/LangDialectProvider'
import { createClient } from '@/lib/supabase/client'
import { listUserLanguages } from '@/lib/db/srs/flashcards'
import type { User } from '@supabase/supabase-js'

// ── Settings sheet ────────────────────────────────────────────────────────────

export type Tab = 'general' | 'study' | 'capture' | 'dict' | 'translate'
type StudySubtab = 'study' | 'review'

const TABS: { id: Tab; icon: 'home' | 'learn' | 'capture' | 'translate' | 'dict'; label: string }[] = [
  { id: 'general',   icon: 'home',      label: 'General'   },
  { id: 'study',     icon: 'learn',     label: 'Study'     },
  { id: 'capture',   icon: 'capture',   label: 'Capture'   },
  { id: 'translate', icon: 'translate', label: 'Translate' },
  { id: 'dict',      icon: 'dict',      label: 'Dict'      },
]

const REVIEW_MODES = [
  { id: 'forward', label: 'Forward' },
  { id: 'reverse', label: 'Reverse' },
  { id: 'audio',   label: 'Audio'   },
  { id: 'sts',     label: 'STS'     },
] as const

const AMI_DIALECTS_SETTINGS = [
  { code: 'ami_Coas', label: 'Coastal 海岸'      },
  { code: 'ami_Heng', label: 'Hengchun 恆春'     },
  { code: 'ami_Mala', label: 'Malan 馬蘭'        },
  { code: 'ami_Sout', label: 'Southern 南部'      },
  { code: 'ami_Xiug', label: 'Xiuguluan 秀姑巒'  },
]

function SettingsSheet({ onClose, initialTab = 'general' }: { onClose: () => void; initialTab?: Tab }) {
  const { lang, dialect, dialectLabel, setLang, setDialect } = useLang()

  const [tab,            setTab]            = useState<Tab>(initialTab)
  const [studySubtab,    setStudySubtab]    = useState<StudySubtab>('study')
  const [user,           setUser]           = useState<User | null>(null)
  const [userId,         setUserId]         = useState<string | null>(null)
  const [locale,         setLocale]         = useState('en')
  const [saving,         setSaving]         = useState(false)
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [pickedLang,     setPickedLang]     = useState<string | null>(null)
  const [accountMenuOpen,setAccountMenuOpen]= useState(false)
  const [autoLookup,       setAutoLookup]       = useState(true)
  const [dictSources,      setDictSources]      = useState<string[]>(['moe'])
  const [resetHour,        setResetHourRaw]     = useState(4)
  const [dailyCap,         setDailyCapRaw]      = useState(100)
  const [reviewMode,       setReviewModeRaw]    = useState('forward')
  const [translateDialect, setTranslateDialect] = useState('ami_Coas')
  const [showHardEasy,    setShowHardEasyRaw]   = useState(true)
  const [showButtons,     setShowButtonsRaw]    = useState(true)
  const [shuffleNew,      setShuffleNewRaw]     = useState(false)
  const [learningSteps,   setLearningStepsRaw]  = useState(3)
  const [showAllLangs,    setShowAllLangsRaw]   = useState(true)
  const [excludedLangs,   setExcludedLangsRaw]  = useState<string[]>([])
  const [availLangs,      setAvailLangs]        = useState<string[] | null>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('ind_auto_lookup')
    if (stored !== null) setAutoLookup(stored === 'true')
    const ss = localStorage.getItem('ind_dict_sources')
    if (ss) try { setDictSources(JSON.parse(ss)) } catch {}
    const h = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
    setResetHourRaw(isNaN(h) ? 4 : Math.min(6, Math.max(0, h)))
    const cap = parseInt(localStorage.getItem('srs_daily_cap') ?? '100')
    setDailyCapRaw(isNaN(cap) ? 100 : Math.min(300, Math.max(10, cap)))
    setReviewModeRaw(localStorage.getItem('srs_review_mode') ?? 'forward')
    setTranslateDialect(localStorage.getItem('translate_ami_dialect') ?? 'ami_Coas')
    setShowHardEasyRaw(localStorage.getItem('srs_show_hard_easy') !== 'false')
    setShowButtonsRaw(localStorage.getItem('srs_show_buttons') !== 'false')
    setShuffleNewRaw(localStorage.getItem('srs_shuffle_new') === 'true')
    const steps = parseInt(localStorage.getItem('srs_learning_steps') ?? '3')
    setLearningStepsRaw(isNaN(steps) ? 3 : Math.min(5, Math.max(1, steps)))
    setShowAllLangsRaw(localStorage.getItem('srs_show_all_langs') !== 'false')
    try { setExcludedLangsRaw(JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]')) } catch {}
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUser(user); setUserId(user.id)
      supabase.from('ind_profiles').select('ui_locale').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setLocale(data.ui_locale) })
    })
  }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node))
        setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const saveLocale = useCallback(async (l: string) => {
    if (!userId) return
    setSaving(true)
    await createClient().from('ind_profiles').update({ ui_locale: l }).eq('user_id', userId)
    setSaving(false)
  }, [userId])

  async function handleSignOut() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  function closePicker() { setLangPickerOpen(false); setPickedLang(null) }

  function toggleAutoLookup() {
    const next = !autoLookup; setAutoLookup(next)
    localStorage.setItem('ind_auto_lookup', String(next))
  }

  useEffect(() => {
    if (tab === 'study' && studySubtab === 'review' && !showAllLangs && availLangs === null)
      listUserLanguages().then(setAvailLangs)
  }, [tab, studySubtab, showAllLangs, availLangs])

  function setShowHardEasy(v: boolean) { setShowHardEasyRaw(v); localStorage.setItem('srs_show_hard_easy', String(v)) }
  function setShowButtons(v: boolean)  { setShowButtonsRaw(v);  localStorage.setItem('srs_show_buttons', String(v)) }
  function setShuffleNew(v: boolean)   { setShuffleNewRaw(v);   localStorage.setItem('srs_shuffle_new', String(v)) }
  function setLearningSteps(v: number) {
    const n = Math.min(5, Math.max(1, v)); setLearningStepsRaw(n); localStorage.setItem('srs_learning_steps', String(n))
  }
  function setShowAllLangs(v: boolean) {
    setShowAllLangsRaw(v); localStorage.setItem('srs_show_all_langs', String(v))
    if (v) { setExcludedLangsRaw([]); localStorage.setItem('srs_excluded_langs', '[]') }
  }
  function toggleLang(code: string) {
    setExcludedLangsRaw(prev => {
      const next = prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
      localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
      return next
    })
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
    // Backdrop + sheet
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,15,5,0.4)' }} />

      <div style={{
        position: 'relative', background: T.paper,
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
        height: '80vh', maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '12px auto 0' }} />

        {/* Sheet header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 0' }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 500, color: T.ink }}>
            Settings
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: T.inkSoft }}>
            <Icon name="x" size={20} strokeWidth={2} color={T.inkSoft} />
          </button>
        </div>

        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0', justifyContent: 'center' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-label={t.label}
              style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: tab === t.id ? T.ink : T.paperHi,
                color: tab === t.id ? T.cream : T.inkSoft,
                border: `1px solid ${tab === t.id ? T.ink : T.lineSoft}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={t.icon} size={15} strokeWidth={1.7} color="currentColor" />
            </button>
          ))}
          {saving && (
            <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 'auto', alignSelf: 'center', fontFamily: '"JetBrains Mono", monospace' }}>
              saving…
            </span>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

          {/* ── General ── */}
          {tab === 'general' && (
            <>
              {/* Account */}
              <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: T.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.amber}`, flexShrink: 0 }}>
                  <Icon name="user" size={20} strokeWidth={1.6} color="#8C6515" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</div>
                </div>
                <div ref={accountMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setAccountMenuOpen(v => !v)}
                    style={{ width: 30, height: 30, borderRadius: 8, background: accountMenuOpen ? T.paper : 'transparent', border: `1px solid ${accountMenuOpen ? T.lineSoft : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Icon name="more-v" size={17} strokeWidth={2.2} color={T.inkSoft} />
                  </button>
                  {accountMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 70, background: T.paperHi, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: '0 4px 16px rgba(43,34,26,0.12)', minWidth: 160, overflow: 'hidden' }}>
                      {[
                        { label: 'Sign out', icon: 'logout' as const, action: handleSignOut, danger: true },
                      ].map((item) => (
                        <button key={item.label} onClick={() => { setAccountMenuOpen(false); item.action() }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: T.crimson, fontSize: 13.5, fontWeight: 500 }}>
                          <Icon name={item.icon} size={15} strokeWidth={1.8} color={T.crimson} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Study language */}
              <div>
                <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Study language</div>
                <button
                  onClick={() => setLangPickerOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', background: T.paperHi, border: `1px solid ${T.lineSoft}`, textAlign: 'left' }}
                >
                  <LangAvatar letter={lang.letter} color={lang.color} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 600, color: T.ink }}>{lang.name}</div>
                    {dialectLabel && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{dialectLabel}</div>}
                  </div>
                  <Icon name="chevron" size={16} color={T.inkSoft} strokeWidth={1.8} />
                </button>
              </div>

              {/* Daily reset */}
              <div>
                <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Study</div>
                <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Daily reset</div>
                    <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Hour the new study day begins</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {[{ delta: -1, disabled: resetHour <= 0 }, { delta: 1, disabled: resetHour >= 6 }].map(({ delta, disabled }, i) => (
                      <button key={i} disabled={disabled}
                        onClick={() => { const n = resetHour + delta; setResetHourRaw(n); localStorage.setItem('srs_reset_hour', String(n)) }}
                        style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.paper, color: T.inkSoft, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 300, opacity: disabled ? 0.35 : 1 }}>
                        {delta < 0 ? '−' : '+'}
                      </button>
                    ))}
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, color: T.ink, minWidth: 30, textAlign: 'center' }}>
                      {resetHour === 0 ? '12am' : `${resetHour}am`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interface language */}
              <div>
                <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Preferences</div>
                <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>Interface language</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ id: 'en', label: 'English', soon: false }, { id: 'zh', label: '繁體中文', soon: true }].map(o => (
                      <button key={o.id} disabled={o.soon}
                        onClick={() => { if (!o.soon) { setLocale(o.id); saveLocale(o.id) } }}
                        style={{ flex: 1, padding: '7px', borderRadius: 9, background: locale === o.id ? T.ink : T.paper, color: locale === o.id ? T.cream : o.soon ? T.inkFaint : T.ink, border: `1px solid ${locale === o.id ? T.ink : T.lineSoft}`, fontSize: 13, fontWeight: 500, cursor: o.soon ? 'not-allowed' : 'pointer' }}>
                        {o.label}{o.soon ? ' · soon' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Study (with Review subtab) ── */}
          {tab === 'study' && (
            <>
              {/* Subtab segmented control */}
              <div style={{ display: 'flex', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 11, padding: 3, gap: 3 }}>
                {(['study', 'review'] as const).map(s => (
                  <button key={s} onClick={() => setStudySubtab(s)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    background: studySubtab === s ? T.paper : 'transparent',
                    border: `1px solid ${studySubtab === s ? T.lineSoft : 'transparent'}`,
                    boxShadow: studySubtab === s ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
                    color: studySubtab === s ? T.ink : T.inkMute,
                    fontSize: 13, fontWeight: studySubtab === s ? 600 : 400,
                    transition: 'all .15s',
                  }}>
                    {s === 'study' ? 'Study' : 'Review'}
                  </button>
                ))}
              </div>

              {/* Study subtab */}
              {studySubtab === 'study' && (
                <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, overflow: 'hidden' }}>
                  {/* Daily cap */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Daily cap</div>
                      <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Max reviews per day</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {[{ delta: -10, disabled: dailyCap <= 10 }, { delta: 10, disabled: dailyCap >= 300 }].map(({ delta, disabled }, i) => (
                        <button key={i} disabled={disabled}
                          onClick={() => { const n = Math.min(300, Math.max(10, dailyCap + delta)); setDailyCapRaw(n); localStorage.setItem('srs_daily_cap', String(n)) }}
                          style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.paper, color: T.inkSoft, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 300, opacity: disabled ? 0.35 : 1 }}>
                          {delta < 0 ? '−' : '+'}
                        </button>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={dailyCap}
                        onChange={e => {
                          const n = parseInt(e.target.value.replace(/\D/g, ''))
                          if (!isNaN(n)) { const c = Math.min(300, n); setDailyCapRaw(c); if (c >= 10) localStorage.setItem('srs_daily_cap', String(c)) }
                        }}
                        onBlur={() => { const c = Math.min(300, Math.max(10, dailyCap)); setDailyCapRaw(c); localStorage.setItem('srs_daily_cap', String(c)) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color: T.ink, width: 48, textAlign: 'center', background: T.paper, border: `1px solid ${T.lineSoft}`, borderRadius: 7, padding: '3px 4px', outline: 'none' }}
                      />
                    </div>
                  </div>
                  {/* Learning passes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Learning passes</div>
                      <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Times a new card repeats before graduating</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {[{ delta: -1, disabled: learningSteps <= 1 }, { delta: 1, disabled: learningSteps >= 5 }].map(({ delta, disabled }, i) => (
                        <button key={i} disabled={disabled}
                          onClick={() => setLearningSteps(learningSteps + delta)}
                          style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.paper, color: T.inkSoft, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 300, opacity: disabled ? 0.35 : 1 }}>
                          {delta < 0 ? '−' : '+'}
                        </button>
                      ))}
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, color: T.ink, minWidth: 20, textAlign: 'center' }}>{learningSteps}</span>
                    </div>
                  </div>
                  {/* Shuffle new */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Shuffle new cards</div>
                      <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Randomise order within each deck level</div>
                    </div>
                    <button onClick={() => setShuffleNew(!shuffleNew)} role="switch" aria-checked={shuffleNew}
                      style={{ width: 44, height: 26, borderRadius: 999, background: shuffleNew ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: shuffleNew ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Review subtab */}
              {studySubtab === 'review' && (
                <>
                  {/* Review mode */}
                  <div>
                    <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Default mode</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {REVIEW_MODES.map(m => (
                        <button key={m.id}
                          onClick={() => { setReviewModeRaw(m.id); localStorage.setItem('srs_review_mode', m.id) }}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 9, background: reviewMode === m.id ? T.crimsonBg : T.paperHi, border: `1.5px solid ${reviewMode === m.id ? T.crimson : T.lineSoft}`, color: reviewMode === m.id ? T.crimson : T.inkMute, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Display toggles */}
                  <div>
                    <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Display</div>
                    <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Rating buttons</div>
                          <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Off = gesture-only grading</div>
                        </div>
                        <button onClick={() => setShowButtons(!showButtons)} role="switch" aria-checked={showButtons}
                          style={{ width: 44, height: 26, borderRadius: 999, background: showButtons ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: showButtons ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Hard + Easy</div>
                          <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Show all four grades, not just two</div>
                        </div>
                        <button onClick={() => setShowHardEasy(!showHardEasy)} role="switch" aria-checked={showHardEasy}
                          style={{ width: 44, height: 26, borderRadius: 999, background: showHardEasy ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: showHardEasy ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Language filter */}
                  <div>
                    <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Languages</div>
                    <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: showAllLangs ? undefined : `1px solid ${T.lineSoft}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Show all languages</div>
                          <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Include all languages in review</div>
                        </div>
                        <button onClick={() => setShowAllLangs(!showAllLangs)} role="switch" aria-checked={showAllLangs}
                          style={{ width: 44, height: 26, borderRadius: 999, background: showAllLangs ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: showAllLangs ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                      {!showAllLangs && (
                        <div style={{ padding: '8px 14px 12px' }}>
                          {availLangs === null ? (
                            <div style={{ fontSize: 13, color: T.inkMute, padding: '4px 0' }}>Loading…</div>
                          ) : availLangs.map(code => {
                            const included = !excludedLangs.includes(code)
                            return (
                              <button key={code} onClick={() => toggleLang(code)} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '8px 0', background: 'none', border: 'none',
                                cursor: 'pointer', textAlign: 'left',
                              }}>
                                <div style={{
                                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                  background: included ? T.crimson : 'transparent',
                                  border: `1.5px solid ${included ? T.crimson : T.line}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {included && <Icon name="check" size={11} color="#fff" strokeWidth={2.5} />}
                                </div>
                                <span style={{ fontSize: 14, color: T.ink }}>{getLangName(code)}</span>
                              </button>
                            )
                          })}
                          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 4, lineHeight: 1.5 }}>
                            Excluded languages still accumulate due cards.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Translate ── */}
          {tab === 'translate' && (
            <div>
              <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Default Amis dialect</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {AMI_DIALECTS_SETTINGS.map(d => (
                  <button key={d.code}
                    onClick={() => { setTranslateDialect(d.code); localStorage.setItem('translate_ami_dialect', d.code) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, background: translateDialect === d.code ? T.crimsonBg : T.paperHi, border: `1.5px solid ${translateDialect === d.code ? T.crimson : T.lineSoft}`, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 14, fontWeight: translateDialect === d.code ? 600 : 400, color: T.ink }}>{d.label}</span>
                    {translateDialect === d.code && <Icon name="check" size={15} color={T.crimson} strokeWidth={2.4} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Capture ── */}
          {tab === 'capture' && (
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Auto-lookup</div>
                <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Automatically search definitions as you type</div>
              </div>
              <button onClick={toggleAutoLookup} role="switch" aria-checked={autoLookup}
                style={{ width: 44, height: 26, borderRadius: 999, background: autoLookup ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: autoLookup ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          )}

          {/* ── Dict ── */}
          {tab === 'dict' && (
            <div>
              <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dictionary source</div>
              <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { id: 'klokah', label: 'ePark',        soon: false },
                    { id: 'moe',    label: 'Kilang',       soon: false },
                    { id: 'ytd',    label: '族語辭典', soon: true  },
                  ] as const).map(o => (
                    <button key={o.id} disabled={o.soon}
                      onClick={() => { if (!o.soon) toggleDictSource(o.id) }}
                      style={{ flex: 1, padding: '8px 6px', borderRadius: 9, background: dictSources.includes(o.id) ? T.ink : T.paper, border: `1px solid ${dictSources.includes(o.id) ? T.ink : T.lineSoft}`, cursor: o.soon ? 'not-allowed' : 'pointer', opacity: o.soon ? 0.5 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: dictSources.includes(o.id) ? T.cream : T.ink, lineHeight: 1.2 }}>{o.label}</span>
                      {o.soon && <span style={{ fontSize: 9.5, color: dictSources.includes(o.id) ? T.cream : T.inkFaint }}>soon</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Language picker overlay — above settings sheet */}
      {langPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={closePicker} style={{ position: 'absolute', inset: 0, background: 'rgba(30,15,5,0.4)' }} />
          <div style={{ position: 'relative', background: T.paper, borderRadius: '20px 20px 0 0', paddingTop: 16, paddingBottom: 'max(48px, env(safe-area-inset-bottom))', maxHeight: '80dvh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: T.line, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: T.ink, fontFamily: 'Newsreader, Georgia, serif' }}>
                {pickedLang ? 'Choose dialect' : 'Study language'}
              </span>
              <button onClick={closePicker} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
                <Icon name="x" size={20} strokeWidth={2} color={T.inkSoft} />
              </button>
            </div>
            <div style={{ padding: '0 10px' }}>
              {pickedLang === null ? (
                LANGUAGES.map(l => {
                  const isActive = l.code === lang.code
                  return (
                    <button key={l.code}
                      onClick={() => { const d = getDialectsForLang(l.code); if (d.length > 1) setPickedLang(l.code); else { setLang(l.code); closePicker() } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 10px', borderRadius: 12, background: isActive ? T.crimsonBg : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <LangAvatar letter={l.letter} color={l.color} size={32} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400, color: T.ink }}>
                        {l.name}{l.nativeName && <span style={{ fontSize: 11.5, color: T.inkMute, fontWeight: 400 }}> · {l.nativeName}</span>}
                      </span>
                      {isActive && <Icon name="check" size={16} color={T.crimson} strokeWidth={2.4} />}
                    </button>
                  )
                })
              ) : (
                <div>
                  <button onClick={() => setPickedLang(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: T.inkSoft, fontSize: 13, marginBottom: 10, padding: '4px 8px' }}>
                    <Icon name="arrow-l" size={15} strokeWidth={2} color={T.inkSoft} /> Back
                  </button>
                  {getDialectsForLang(pickedLang).map(d => {
                    const label    = shortDialectLabel(d, getGlid(pickedLang) ?? '01')
                    const isActive = d === dialect && pickedLang === lang.code
                    return (
                      <button key={d}
                        onClick={() => { setLang(pickedLang); setDialect(d); closePicker() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 10px', borderRadius: 12, background: isActive ? T.crimsonBg : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400, color: T.ink }}>{label}</span>
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

// ── Exported trigger button ───────────────────────────────────────────────────

export default function SettingsButton({
  variant = 'gear',
  initialTab,
}: {
  variant?: 'gear' | 'change' | 'sidebar'
  initialTab?: Tab
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'gear' && (
        <button onClick={() => setOpen(true)} aria-label="Settings" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: T.inkSoft, cursor: 'pointer',
        }}>
          <Icon name="settings" size={17} strokeWidth={1.6} />
        </button>
      )}
      {variant === 'change' && (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 12, color: T.inkSoft, padding: '6px 10px', borderRadius: 8,
          background: T.paper, border: `1px solid ${T.lineSoft}`,
          fontWeight: 500, cursor: 'pointer',
        }}>
          Change
        </button>
      )}
      {variant === 'sidebar' && (
        <button onClick={() => setOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '8px 12px', borderRadius: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.inkSoft, fontSize: 13, fontWeight: 500,
        }}>
          <Icon name="settings" size={17} strokeWidth={1.6} color="currentColor" />
          Settings
        </button>
      )}
      {open && <SettingsSheet onClose={() => setOpen(false)} initialTab={initialTab} />}
    </>
  )
}
