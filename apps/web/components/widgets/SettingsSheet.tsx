'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { LangAvatar, Icon } from '@/components/ui'
import { LANGUAGES } from '@/lib/languages'
import { getGlid, getDialectsForLang, getLangName } from '@/lib/lang/lang-bridge'
import { shortDialectLabel, GLID_NAMES, GLID_FAMILIES } from '@/lib/lang/dialects'
import { useLang } from '@/lib/context/LangDialectProvider'
import { createClient } from '@/lib/supabase/client'
import { listUserLanguages, getStudyDate } from '@/lib/db/srs/flashcards'
import { savePreferences, DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/db/profile/preferences'
import type { User } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase/session'

// ── Settings sheet ────────────────────────────────────────────────────────────

export type Tab = 'general' | 'study' | 'capture' | 'dict' | 'translate'
type StudySubtab = 'size' | 'ui'

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
  const [studySubtab,    setStudySubtab]    = useState<StudySubtab>('size')
  const [user,           setUser]           = useState<User | null>(null)
  const [userId,         setUserId]         = useState<string | null>(null)
  const [locale,         setLocale]         = useState('en')
  const [saving,         setSaving]         = useState(false)
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [pickedLang,     setPickedLang]     = useState<string | null>(null)
  const [accountMenuOpen,setAccountMenuOpen]= useState(false)
  const [autoLookup,       setAutoLookup]       = useState(true)
  const [dictSources,      setDictSources]      = useState<string[]>(['moe', 'klokah'])
  const [mergeMode,        setMergeMode]        = useState(true)
  const [mergeModeInfoOpen, setMergeModeInfoOpen] = useState(false)
  const [dictLangGlid,     setDictLangGlidRaw]  = useState('')
  const [dictLangDialect,  setDictLangDialectRaw] = useState('')
  const [resetHour,        setResetHourRaw]     = useState(4)
  const [prefReviewTarget,    setPrefReviewTargetRaw]  = useState(100)
  const [prefLearnTarget,     setPrefLearnTargetRaw]   = useState(10)
  const [editingLearnSession,  setEditingLearnSession]  = useState(false)
  const [editingReviewSession, setEditingReviewSession] = useState(false)
  const [overrideSim,          setOverrideSim]          = useState(false)
  const [sizeInfoOpen,         setSizeInfoOpen]         = useState(false)
  const [learnTargetHint,      setLearnTargetHint]      = useState<number | null>(null)
  const [simActiveHint,        setSimActiveHint]        = useState(false)
  const [reviewTargetHint,    setReviewTargetHint]     = useState(100)
  const [reviewMode,       setReviewModeRaw]    = useState('forward')
  const [translateDialect, setTranslateDialect] = useState('ami_Coas')
  const [showHardEasy,    setShowHardEasyRaw]   = useState(true)
  const [showButtons,     setShowButtonsRaw]    = useState(true)
  const [shuffleNew,      setShuffleNewRaw]     = useState(false)
  const [showAllLangs,    setShowAllLangsRaw]   = useState(true)
  const [excludedLangs,   setExcludedLangsRaw]  = useState<string[]>([])
  const [availLangs,      setAvailLangs]        = useState<string[] | null>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('ind_auto_lookup')
    if (stored !== null) setAutoLookup(stored === 'true')
    const ss = localStorage.getItem('ind_dict_sources')
    if (ss) try { setDictSources(JSON.parse(ss)) } catch {}
    const mm = localStorage.getItem('ind_dict_merge_mode')
    if (mm !== null) setMergeMode(mm === 'true')
    const dl = localStorage.getItem('ind_dict_lang_glid')
    if (dl !== null) setDictLangGlidRaw(dl)
    const dd = localStorage.getItem('ind_dict_lang_dialect')
    if (dd !== null) setDictLangDialectRaw(dd)
    const h = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
    setResetHourRaw(isNaN(h) ? 4 : Math.min(6, Math.max(0, h)))
    const cap = parseInt(localStorage.getItem('srs_review_target') ?? '100')
    setPrefReviewTargetRaw(isNaN(cap) ? 100 : Math.min(999, Math.max(5, cap)))
    const lc = parseInt(localStorage.getItem('srs_learn_target') ?? '10')
    setPrefLearnTargetRaw(isNaN(lc) ? 10 : Math.min(50, Math.max(1, lc)))
    const rt = parseInt(localStorage.getItem('srs_review_target') ?? '100')
    setReviewTargetHint(isNaN(rt) ? 100 : rt)
    const lth = localStorage.getItem('srs_learn_target')
    setLearnTargetHint(lth !== null && !isNaN(parseInt(lth)) ? parseInt(lth) : null)
    setSimActiveHint(localStorage.getItem('srs_sim_active') === 'true')
    setReviewModeRaw(localStorage.getItem('srs_review_mode') ?? 'forward')
    setTranslateDialect(localStorage.getItem('translate_ami_dialect') ?? 'ami_Coas')
    setShowHardEasyRaw(localStorage.getItem('srs_show_hard_easy') !== 'false')
    setShowButtonsRaw(localStorage.getItem('srs_show_buttons') !== 'false')
    setShuffleNewRaw(localStorage.getItem('srs_shuffle_new') === 'true')
    setShowAllLangsRaw(localStorage.getItem('srs_show_all_langs') !== 'false')
    try { setExcludedLangsRaw(JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]')) } catch {}
  }, [])

  useEffect(() => {
    const supabase = createClient()
    getSessionUser().then((user) => {
      if (!user) return
      setUser(user); setUserId(user.id)
      supabase.from('ind_profiles').select('ui_locale, preferences').eq('user_id', user.id).single()
        .then(({ data }) => {
          if (!data) return
          if (data.ui_locale) setLocale(data.ui_locale)
          const p = { ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) } as UserPreferences
          setPrefReviewTargetRaw(p.review_target);       localStorage.setItem('srs_review_target',    String(p.review_target))
          setPrefLearnTargetRaw(p.learn_target);         localStorage.setItem('srs_learn_target',     String(p.learn_target))
          setReviewModeRaw(p.review_mode);     localStorage.setItem('srs_review_mode',     p.review_mode)
          setResetHourRaw(p.reset_hour);       localStorage.setItem('srs_reset_hour',      String(p.reset_hour))
          setShowHardEasyRaw(p.show_hard_easy);localStorage.setItem('srs_show_hard_easy',  String(p.show_hard_easy))
          setShowButtonsRaw(p.show_buttons);   localStorage.setItem('srs_show_buttons',    String(p.show_buttons))
          setShuffleNewRaw(p.shuffle_new);     localStorage.setItem('srs_shuffle_new',     String(p.shuffle_new))
          setShowAllLangsRaw(p.show_all_langs);localStorage.setItem('srs_show_all_langs',  String(p.show_all_langs))
          setExcludedLangsRaw(p.excluded_langs);localStorage.setItem('srs_excluded_langs', JSON.stringify(p.excluded_langs))
          setAutoLookup(p.auto_lookup);        localStorage.setItem('ind_auto_lookup',     String(p.auto_lookup))
          setDictSources(p.dict_sources);      localStorage.setItem('ind_dict_sources',    JSON.stringify(p.dict_sources))
          setMergeMode(p.dict_merge_mode);     localStorage.setItem('ind_dict_merge_mode', String(p.dict_merge_mode))
          setTranslateDialect(p.translate_dialect); localStorage.setItem('translate_ami_dialect', p.translate_dialect)
          localStorage.setItem('srs_shuffle_tests',    String(p.shuffle_tests))
          localStorage.setItem('srs_shuffle_exposure', String(p.shuffle_exposure))
        })
    })
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
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
    saveToCloud({ auto_lookup: next })
  }

  useEffect(() => {
    if (tab === 'study' && studySubtab === 'ui' && !showAllLangs && availLangs === null)
      listUserLanguages().then(setAvailLangs)
  }, [tab, studySubtab, showAllLangs, availLangs])

  function setShowHardEasy(v: boolean) { setShowHardEasyRaw(v); localStorage.setItem('srs_show_hard_easy', String(v)); saveToCloud({ show_hard_easy: v }) }
  function setShowButtons(v: boolean)  { setShowButtonsRaw(v);  localStorage.setItem('srs_show_buttons', String(v));   saveToCloud({ show_buttons: v }) }
  function setShuffleNew(v: boolean)   { setShuffleNewRaw(v);   localStorage.setItem('srs_shuffle_new', String(v));    saveToCloud({ shuffle_new: v }) }
  function setShowAllLangs(v: boolean) {
    setShowAllLangsRaw(v); localStorage.setItem('srs_show_all_langs', String(v))
    if (v) { setExcludedLangsRaw([]); localStorage.setItem('srs_excluded_langs', '[]'); saveToCloud({ show_all_langs: v, excluded_langs: [] }) }
    else   { saveToCloud({ show_all_langs: v }) }
    window.dispatchEvent(new CustomEvent('srs-prefs-changed'))
  }
  function toggleLang(code: string) {
    setExcludedLangsRaw(prev => {
      const next = prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
      localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
      saveToCloud({ excluded_langs: next })
      window.dispatchEvent(new CustomEvent('srs-prefs-changed'))
      return next
    })
  }

  function setPrefLearnTarget(n: number) {
    const v = Math.min(50, Math.max(1, n))
    setPrefLearnTargetRaw(v); localStorage.setItem('srs_learn_target', String(v)); saveToCloud({ learn_target: v })
    // Clear today's frozen learn_target so the dashboard re-computes on next refresh
    if (userId) {
      createClient().from('ind_daily_stats')
        .update({ learn_target: null }).eq('user_id', userId).eq('date', getStudyDate()).then(() => {})
    }
  }

  function buildPrefs(patch: Partial<UserPreferences> = {}): UserPreferences {
    return {
      review_target:     prefReviewTarget,
      learn_target:      prefLearnTarget,
      review_more_size:  null,
      review_mode:      reviewMode,
      reset_hour:       resetHour,
      show_hard_easy:   showHardEasy,
      show_buttons:     showButtons,
      shuffle_new:      shuffleNew,
      show_all_langs:   showAllLangs,
      excluded_langs:   excludedLangs,
      auto_lookup:      autoLookup,
      dict_sources:     dictSources,
      dict_merge_mode:  mergeMode,
      translate_dialect: translateDialect,
      shuffle_tests:    localStorage.getItem('srs_shuffle_tests')    !== 'false',
      shuffle_exposure: localStorage.getItem('srs_shuffle_exposure') !== 'false',
      ...patch,
    }
  }

  function saveToCloud(patch: Partial<UserPreferences>) {
    if (userId) savePreferences(userId, buildPrefs(patch))
  }

  function setDictLangGlid(g: string) {
    setDictLangGlidRaw(g)
    setDictLangDialectRaw('')
    localStorage.setItem('ind_dict_lang_glid', g)
    localStorage.setItem('ind_dict_lang_dialect', '')
    window.dispatchEvent(new CustomEvent('ind-dict-lang-changed', { detail: { glid: g, dialect: '' } }))
  }

  function setDictLangDialect(d: string) {
    setDictLangDialectRaw(d)
    localStorage.setItem('ind_dict_lang_dialect', d)
    window.dispatchEvent(new CustomEvent('ind-dict-lang-changed', { detail: { glid: dictLangGlid, dialect: d } }))
  }

  function toggleDictSource(id: string) {
    const next = dictSources.includes(id) ? dictSources.filter(s => s !== id) : [...dictSources, id]
    setDictSources(next)
    localStorage.setItem('ind_dict_sources', JSON.stringify(next))
    saveToCloud({ dict_sources: next })
    window.dispatchEvent(new CustomEvent('ind-dict-sources-changed', { detail: next }))
  }

  function toggleMergeMode() {
    const next = !mergeMode
    setMergeMode(next)
    localStorage.setItem('ind_dict_merge_mode', String(next))
    saveToCloud({ dict_merge_mode: next })
    window.dispatchEvent(new CustomEvent('ind-dict-merge-mode-changed', { detail: next }))
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
            <span style={{ color: T.inkMute, fontWeight: 400 }}>
              {' · '}{TABS.find(t => t.id === tab)?.label ?? ''}
              {tab === 'study' ? ` · ${studySubtab === 'size' ? 'Session size' : 'Session UI'}` : ''}
            </span>
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
                        onClick={() => { const n = resetHour + delta; setResetHourRaw(n); localStorage.setItem('srs_reset_hour', String(n)); saveToCloud({ reset_hour: n }) }}
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
                {([{ id: 'size', label: 'Session size' }, { id: 'ui', label: 'Session UI' }] as const).map(s => (
                  <button key={s.id} onClick={() => setStudySubtab(s.id)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    background: studySubtab === s.id ? T.paper : 'transparent',
                    border: `1px solid ${studySubtab === s.id ? T.lineSoft : 'transparent'}`,
                    boxShadow: studySubtab === s.id ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
                    color: studySubtab === s.id ? T.ink : T.inkMute,
                    fontSize: 13, fontWeight: studySubtab === s.id ? 600 : 400,
                    transition: 'all .15s',
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Session size subtab */}
              {studySubtab === 'size' && (
                <>
                  {/* Label row: Cards in each session + reset + info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                      Cards in each session
                    </span>
                    {/* Reset to defaults */}
                    <button
                      onClick={() => {
                        setPrefLearnTarget(10)
                        const v = 100; setPrefReviewTargetRaw(v); localStorage.setItem('srs_review_target', String(v)); saveToCloud({ review_target: v })
                      }}
                      title="Reset to defaults"
                      style={{ width: 26, height: 26, borderRadius: 7, background: 'none', border: `1px solid transparent`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="rotate-ccw" size={13} strokeWidth={1.8} color={T.inkFaint} />
                    </button>
                    {/* Info toggle */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setSizeInfoOpen(v => !v)}
                        style={{ width: 26, height: 26, borderRadius: 7, background: sizeInfoOpen ? T.paperHi : 'none', border: `1px solid ${sizeInfoOpen ? T.lineSoft : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Icon name="info" size={13} strokeWidth={1.8} color={sizeInfoOpen ? T.ink : T.inkFaint} />
                      </button>
                      {sizeInfoOpen && (
                        <div style={{
                          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20,
                          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                          borderRadius: 12, padding: '12px 14px', width: 240,
                          boxShadow: '0 4px 16px rgba(43,34,26,0.12)',
                        }}>
                          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMute, marginBottom: 10 }}>
                            How defaults work
                          </div>
                          {[
                            { label: 'No goal set', sub: 'App defaults — Learn 10, Review 100' },
                            { label: 'Manual goal', sub: 'Your caps are the daily pace. What you set here = what gets scheduled.' },
                            { label: 'Simulated goal', sub: 'Learn auto-calculated as daily new-card pace to hit goal by due date. Review auto-calculated as projected daily due count. Manual caps are overridden while simulation is active.' },
                          ].map((item, i) => (
                            <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{item.label}</div>
                              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{item.sub}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Learn + Review in one card */}
                  {(() => {
                    const learnGoal  = simActiveHint && learnTargetHint !== null ? learnTargetHint : prefLearnTarget
                    const goalMode   = simActiveHint ? 'calculated' : 'manual'
                    const displayVal = prefReviewTarget >= 999 ? 'All' : String(prefReviewTarget)
                    function saveReviewSession(n: number) {
                      const v = Math.min(999, Math.max(5, Math.round(n / 5) * 5))
                      setPrefReviewTargetRaw(v); localStorage.setItem('srs_review_target', String(v)); saveToCloud({ review_target: v })
                    }
                    const stepBtn = (label: string, disabled: boolean, onClick: () => void) => (
                      <button disabled={disabled} onClick={onClick}
                        style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.paper, color: T.inkSoft, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 300, opacity: disabled ? 0.35 : 1 }}>
                        {label}
                      </button>
                    )
                    const canEdit = !simActiveHint || overrideSim
                    return (
                      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, overflow: 'hidden' }}>
                        {/* Learn row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Learn session</div>
                            <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Current {goalMode} goal: {learnGoal} cards/day</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {editingLearnSession && canEdit && (<>
                              {stepBtn('−', prefLearnTarget <= 1,  () => setPrefLearnTarget(prefLearnTarget - 1))}
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color: T.ink, minWidth: 26, textAlign: 'center' }}>{prefLearnTarget}</span>
                              {stepBtn('+', prefLearnTarget >= 50, () => setPrefLearnTarget(prefLearnTarget + 1))}
                            </>)}
                            {(!editingLearnSession || !canEdit) && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color: T.ink }}>{prefLearnTarget}</span>}
                            {canEdit && (
                              <button onClick={() => setEditingLearnSession(v => !v)}
                                style={{ width: 26, height: 26, borderRadius: 7, background: editingLearnSession ? T.paperHi : 'none', border: `1px solid ${editingLearnSession ? T.lineSoft : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="pen" size={12} strokeWidth={2} color={T.inkFaint} />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Review row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Review session</div>
                            <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>Current {goalMode} goal: {reviewTargetHint} cards/day</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {editingReviewSession && canEdit && (<>
                              {stepBtn('−', prefReviewTarget <= 5,   () => saveReviewSession(prefReviewTarget - 5))}
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color: T.ink, minWidth: 28, textAlign: 'center' }}>{displayVal}</span>
                              {stepBtn('+', prefReviewTarget >= 999, () => saveReviewSession(prefReviewTarget + 5))}
                            </>)}
                            {(!editingReviewSession || !canEdit) && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color: T.ink }}>{displayVal}</span>}
                            {canEdit && (
                              <button onClick={() => setEditingReviewSession(v => !v)}
                                style={{ width: 26, height: 26, borderRadius: 7, background: editingReviewSession ? T.paperHi : 'none', border: `1px solid ${editingReviewSession ? T.lineSoft : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="pen" size={12} strokeWidth={2} color={T.inkFaint} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Override simulation caps — only shown when simulation is active */}
                  {simActiveHint && (
                    <div style={{
                      background: overrideSim ? T.amberBg : T.paperHi,
                      border: `1px solid ${overrideSim ? T.amber : T.lineSoft}`,
                      borderRadius: 14, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Override simulation caps</div>
                        <div style={{ fontSize: 12, color: overrideSim ? T.amber : T.inkMute, marginTop: 2 }}>
                          {overrideSim
                            ? 'Manual caps active — simulation pacing will be affected'
                            : 'Simulation sets session sizes automatically'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setOverrideSim(v => {
                            if (v) { setEditingLearnSession(false); setEditingReviewSession(false) }
                            return !v
                          })
                        }}
                        role="switch" aria-checked={overrideSim}
                        style={{ width: 44, height: 26, borderRadius: 999, background: overrideSim ? T.amber : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 3, left: overrideSim ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  )}

                  {/* Shuffle new */}
                  <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, overflow: 'hidden' }}>
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
                </>
              )}

              {/* Session UI subtab */}
              {studySubtab === 'ui' && (
                <>
                  {/* Review mode */}
                  <div>
                    <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Default mode</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {REVIEW_MODES.map(m => (
                        <button key={m.id}
                          onClick={() => { setReviewModeRaw(m.id); localStorage.setItem('srs_review_mode', m.id); saveToCloud({ review_mode: m.id }) }}
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
                    onClick={() => { setTranslateDialect(d.code); localStorage.setItem('translate_ami_dialect', d.code); saveToCloud({ translate_dialect: d.code }) }}
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
          {tab === 'dict' && (() => {
            const eparkActive = dictSources.includes('klokah')
            const labelStyle: React.CSSProperties = { fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }
            // Same language order as the app's main study-language picker (LANGUAGES),
            // not GLID_NAMES's own key order — those two only diverge at Saaroa/Kanakanavu.
            const orderedGlidLangs = LANGUAGES
              .map(l => getGlid(l.code))
              .filter((g): g is string => !!g && !!GLID_NAMES[g])
              .map(g => [g, GLID_NAMES[g]] as const)
            return (
              <>
                <div>
                  <div style={labelStyle}>Dictionary source</div>
                  <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([
                        { id: 'klokah', label: 'ePark',   disabled: false },
                        { id: 'moe',    label: 'Kilang',  disabled: false },
                        { id: 'ytd',    label: '族語辭典', disabled: true  },
                      ] as const).map(o => (
                        <button key={o.id} disabled={o.disabled}
                          onClick={() => { if (!o.disabled) toggleDictSource(o.id) }}
                          style={{ flex: 1, padding: '8px 6px', borderRadius: 9, background: dictSources.includes(o.id) ? T.ink : T.paper, border: `1px solid ${dictSources.includes(o.id) ? T.ink : T.lineSoft}`, cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.5 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: dictSources.includes(o.id) ? T.cream : T.ink, lineHeight: 1.2 }}>{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Merge mode</span>
                  <button
                    onClick={() => setMergeModeInfoOpen(v => !v)}
                    style={{ width: 22, height: 22, borderRadius: 6, background: mergeModeInfoOpen ? T.paper : 'none', border: `1px solid ${mergeModeInfoOpen ? T.lineSoft : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="info" size={12} strokeWidth={1.8} color={mergeModeInfoOpen ? T.ink : T.inkFaint} />
                  </button>
                  <div style={{ flex: 1 }} />
                  <button onClick={toggleMergeMode} role="switch" aria-checked={mergeMode}
                    style={{ width: 44, height: 26, borderRadius: 999, background: mergeMode ? T.crimson : T.lineSoft, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: mergeMode ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                  {mergeModeInfoOpen && (
                    <div style={{
                      position: 'absolute', left: 14, right: 14, top: 'calc(100% + 6px)', zIndex: 20,
                      background: T.paper, border: `1px solid ${T.lineSoft}`,
                      borderRadius: 12, padding: '12px 14px',
                      boxShadow: '0 4px 16px rgba(43,34,26,0.12)',
                    }}>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.5 }}>
                        When on, the same word found in multiple dialects shows as one result listing every dialect, instead of a separate card per dialect.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ opacity: eparkActive ? 1 : 0.4, pointerEvents: eparkActive ? 'auto' : 'none' }}>
                  <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Search language</span>
                    {!eparkActive && <span style={{ fontSize: 10, color: T.inkFaint, textTransform: 'none', letterSpacing: 0 }}>· enable ePark to use</span>}
                  </div>
                  <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14, overflow: 'hidden', display: 'flex' }}>
                    {/* Left: languages */}
                    <div style={{ flex: 1, borderRight: `1px solid ${T.lineSoft}` }}>
                      <button
                        onClick={() => setDictLangGlid('')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: !dictLangGlid ? T.crimsonBg : 'none', border: 'none', borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 13, fontWeight: !dictLangGlid ? 600 : 400, color: !dictLangGlid ? T.crimson : T.ink }}>Auto</span>
                        {!dictLangGlid && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                      </button>
                      {orderedGlidLangs.map(([g, name], i, arr) => {
                        const active = dictLangGlid === g
                        return (
                          <button
                            key={g}
                            onClick={() => setDictLangGlid(g)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: active ? T.crimsonBg : 'none', border: 'none', borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.crimson : T.ink }}>{name}</span>
                            {active && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                          </button>
                        )
                      })}
                    </div>
                    {/* Right: dialects for selected language */}
                    <div style={{ flex: 1 }}>
                      {!dictLangGlid ? (
                        <div style={{ padding: '16px 12px', fontSize: 12, color: T.inkFaint, textAlign: 'center' }}>
                          Select a language first
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setDictLangDialect('')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: !dictLangDialect ? T.crimsonBg : 'none', border: 'none', borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ fontSize: 13, fontWeight: !dictLangDialect ? 600 : 400, color: !dictLangDialect ? T.crimson : T.ink }}>All dialects</span>
                            {!dictLangDialect && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                          </button>
                          {(GLID_FAMILIES[dictLangGlid] ?? []).map((d, i, arr) => {
                            const active = dictLangDialect === d
                            return (
                              <button
                                key={d}
                                onClick={() => setDictLangDialect(d)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: active ? T.crimsonBg : 'none', border: 'none', borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none', cursor: 'pointer', textAlign: 'left' }}
                              >
                                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.crimson : T.ink }}>{d}</span>
                                {active && <Icon name="check" size={14} color={T.crimson} strokeWidth={2.4} />}
                              </button>
                            )
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )
          })()}

          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: T.inkFaint, letterSpacing: '0.06em' }}>
              {process.env.NEXT_PUBLIC_BUILD_TIME ?? 'dev'}
            </span>
          </div>
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
  const router = useRouter()

  function handleClose() {
    setOpen(false)
    router.refresh()
  }

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
        <button onClick={() => setOpen(true)} aria-label="Change language" style={{
          width: 32, height: 32, borderRadius: 999, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.paper, border: `1px solid ${T.lineSoft}`,
          color: T.inkSoft, cursor: 'pointer',
        }}>
          <Icon name="rotate-cw" size={15} strokeWidth={1.8} />
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
      {open && <SettingsSheet onClose={handleClose} initialTab={initialTab} />}
    </>
  )
}
