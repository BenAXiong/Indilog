'use client'

import { Suspense } from 'react'
import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { useLang } from '@/lib/context/LangDialectProvider'
import {
  ensureFlashcards, listDueFlashcards, listUserLanguages, getExcludeFromReview,
  rateCard, rateCardRelearn, flushReviewEvents, cardMeta, cardAudio,
  suspendCard, unsuspendCard, setFlagColor, deferCard, undoRating, undoDefer, localDateStr, getStudyDate,
  type FlashcardWithItem, type Rating, type ListDueOpts, type PendingReviewEvent,
} from '@/lib/db/srs/flashcards'
import { getLangName } from '@/lib/lang/lang-bridge'
import { FLAG_COLORS, flagColorHex } from '@/lib/db/srs/flags'
import { estimateInterval, formatDays, computeMasteryGrade, type SMState } from '@/lib/db/srs/schedule'
import { createClient } from '@/lib/supabase/client'
import { patchPreferences } from '@/lib/db/profile/preferences'
import { listPriorityDecks } from '@/lib/db/srs/priority'

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionContext = {
  reviewedToday:         number
  reviewTarget:          number
  dailyCap:              number
  streak:                number
  priorityCollectionIds: string[]
  reviewMoreSize:        number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardSMState(card: FlashcardWithItem): SMState {
  return { ease_factor: card.ease_factor, interval_days: card.interval_days, repetitions: card.repetitions }
}

async function loadSessionContext(): Promise<SessionContext> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { reviewedToday: 0, reviewTarget: 100, dailyCap: 100, streak: 0, priorityCollectionIds: [], reviewMoreSize: null }

  const today   = getStudyDate()
  const from30  = new Date(); from30.setDate(from30.getDate() - 29)
  const fromStr = localDateStr(from30)

  const [profileRes, todayRes, dailyRes, priorityDecks] = await Promise.all([
    supabase.from('ind_profiles').select('preferences').eq('user_id', user.id).maybeSingle(),
    supabase.from('ind_daily_stats').select('reviewed_count, review_target').eq('user_id', user.id).eq('date', today).maybeSingle(),
    supabase.from('ind_daily_stats').select('date, reviewed_count').eq('user_id', user.id).gte('date', fromStr).order('date', { ascending: false }),
    listPriorityDecks(user.id),
  ])

  const reviewSet = new Set(
    (dailyRes.data ?? []).filter(r => (r.reviewed_count ?? 0) > 0).map(r => r.date)
  )
  let streak = 0
  let cur = today
  while (reviewSet.has(cur)) { streak++; const [y,m,d] = cur.split('-').map(Number); const p = new Date(y,m-1,d-1); cur = `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}` as typeof today }

  const prefs = profileRes.data?.preferences as Record<string, unknown> | null
  const dailyCap = typeof prefs?.review_cap === 'number' ? prefs.review_cap : 100
  const reviewMoreSize = typeof prefs?.review_more_size === 'number' ? prefs.review_more_size : null
  if (typeof window !== 'undefined') localStorage.setItem('srs_review_cap', String(dailyCap))

  return {
    reviewedToday:         todayRes.data?.reviewed_count ?? 0,
    reviewTarget:          todayRes.data?.review_target ?? dailyCap,
    dailyCap,
    streak,
    priorityCollectionIds: priorityDecks.map(d => d.collection_id),
    reviewMoreSize,
  }
}

type SessionReturning = { total: number; newCards: number; plantedOrAbove: number }

async function countSessionReturning(cardIds: string[]): Promise<SessionReturning> {
  if (!cardIds.length) return { total: 0, newCards: 0, plantedOrAbove: 0 }
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, newCards: 0, plantedOrAbove: 0 }
  const now = new Date().toISOString()
  const resetHour = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
  const nextReset = new Date()
  if (nextReset.getHours() >= resetHour) nextReset.setDate(nextReset.getDate() + 1)
  nextReset.setHours(resetHour, 0, 0, 0)
  const nextResetISO = nextReset.toISOString()
  const base = supabase.from('ind_flashcards').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).in('id', cardIds).gt('due_at', now).lte('due_at', nextResetISO).is('suspended_at', null)
  const [newRes, plantedRes] = await Promise.all([
    base.eq('repetitions', 1),
    base.gte('repetitions', 2),
  ])
  const newCards      = newRes.count      ?? 0
  const plantedOrAbove = plantedRes.count ?? 0
  return { total: newCards + plantedOrAbove, newCards, plantedOrAbove }
}

async function countDueTomorrow(): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const now = new Date().toISOString()
  const resetHour = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
  const nextReset = new Date()
  if (nextReset.getHours() >= resetHour) nextReset.setDate(nextReset.getDate() + 1)
  nextReset.setHours(resetHour, 0, 0, 0)
  const { count } = await supabase
    .from('ind_flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('due_at', now)
    .lte('due_at', nextReset.toISOString())
    .is('suspended_at', null)
  return count ?? 0
}

// ─── OptionsSheet ─────────────────────────────────────────────────────────────

function OptionsSheet({
  showHardEasy, setShowHardEasy,
  showButtons, setShowButtons,
  dailyCap, setDailyCap,
  reviewMode, setReviewMode,
  shuffleNew, setShuffleNew,
  showAllLangs, setShowAllLangs,
  excludedLangs, setExcludedLangs,
  onReloadNeeded,
  onClose,
}: {
  showHardEasy: boolean; setShowHardEasy: (v: boolean) => void
  showButtons:  boolean; setShowButtons:  (v: boolean) => void
  dailyCap:     number;  setDailyCap:     (v: number) => void
  reviewMode:   string;  setReviewMode:   (v: string) => void
  shuffleNew:   boolean; setShuffleNew:   (v: boolean) => void
  showAllLangs:  boolean; setShowAllLangs:  (v: boolean) => void
  excludedLangs: string[]; setExcludedLangs: (v: string[]) => void
  onReloadNeeded: () => void
  onClose: () => void
}) {
  const [availLangs, setAvailLangs] = useState<string[] | null>(null)

  useEffect(() => {
    if (!showAllLangs && availLangs === null) listUserLanguages().then(setAvailLangs)
  }, [showAllLangs, availLangs])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function handleToggleShowAll(v: boolean) {
    setShowAllLangs(v)
    localStorage.setItem('srs_show_all_langs', String(v))
    if (v) {
      setExcludedLangs([]); localStorage.setItem('srs_excluded_langs', '[]')
      patchPreferences({ show_all_langs: v, excluded_langs: [] })
    } else {
      patchPreferences({ show_all_langs: v })
    }
    onReloadNeeded()
  }

  function handleToggleLang(code: string) {
    const nowExcluded = !excludedLangs.includes(code)
    const next = nowExcluded ? [...excludedLangs, code] : excludedLangs.filter(l => l !== code)
    setExcludedLangs(next)
    localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
    patchPreferences({ excluded_langs: next })
    onReloadNeeded()
  }

  const Toggle = ({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 1 }}>{sub}</div>
      </div>
      <button onClick={onToggle} aria-label={`Toggle ${label}`} style={{
        width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? T.sage : T.line, border: 'none', cursor: 'pointer', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20,
          borderRadius: 999, background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
        }} />
      </button>
    </div>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,22,16,0.32)', zIndex: 20 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 21,
        background: T.cream, borderRadius: '22px 22px 0 0',
        padding: '10px 0 32px', boxShadow: '0 -12px 36px rgba(40,30,20,0.2)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.line, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '0 16px 10px' }}>
          Session options
        </div>
        <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, margin: '0 14px', overflow: 'hidden' }}>
          {/* Review mode selector */}
          <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ fontSize: 14, color: T.ink, fontWeight: 500, marginBottom: 8 }}>Review mode</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['forward', 'reverse', 'audio', 'sts'] as const).map(m => (
                <button key={m} onClick={() => setReviewMode(m)} style={{
                  padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: reviewMode === m ? T.crimsonBg : T.paper,
                  border: `1.5px solid ${reviewMode === m ? T.crimson : T.lineSoft}`,
                  color: reviewMode === m ? T.crimson : T.inkMute,
                }}>{m}</button>
              ))}
            </div>
          </div>
          <Toggle label="Rating buttons" sub="Off = gesture-only grading" on={showButtons} onToggle={() => setShowButtons(!showButtons)} />
          <Toggle label="Hard + Easy" sub="Show all four grades, not just two" on={showHardEasy} onToggle={() => setShowHardEasy(!showHardEasy)} />
          <Toggle label="Shuffle new cards" sub="Randomise order within each deck level" on={shuffleNew} onToggle={() => { setShuffleNew(!shuffleNew); onReloadNeeded() }} />

          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.7 }}>
              ← Again · → Good · ↑ Easy · ↓ Suspend
            </div>
          </div>
        </div>

        {/* Language filter */}
        <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, margin: '10px 14px 0', overflow: 'hidden' }}>
          <Toggle
            label="Show all languages"
            sub="Include all languages in this session"
            on={showAllLangs}
            onToggle={() => handleToggleShowAll(!showAllLangs)}
          />
          {!showAllLangs && (
            <div style={{ padding: '4px 16px 14px', borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 0 8px' }}>
                Languages
              </div>
              {availLangs === null ? (
                <div style={{ fontSize: 13, color: T.inkMute, padding: '4px 0' }}>Loading…</div>
              ) : availLangs.map(code => {
                const included = !excludedLangs.includes(code)
                return (
                  <button key={code} onClick={() => handleToggleLang(code)} style={{
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
              <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
                Excluded languages still accumulate due cards.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── ReviewSession ────────────────────────────────────────────────────────────

type QueueEntry = {
  card: FlashcardWithItem
  lapsedInterval?: number  // set when requeued after Again; triggers 50% recovery on re-rating
}

type PrevSMState = { ease_factor: number; interval_days: number; repetitions: number; due_at: string | null }

type UndoEntry =
  | { type: 'rate';    cardId: string; prevState: PrevSMState; wasLapsed: boolean; lapsedInterval?: number }
  | { type: 'again';   cardId: string; insertedAt: number; lapsedInterval: number }
  | { type: 'defer';   cardId: string; prevDueAt: string | null }
  | { type: 'suspend'; cardId: string; appendedOverflow: FlashcardWithItem | null; appendedAt: number | null }

function renderHighlighted(sentence: string, target: string) {
  if (!target || !sentence) return sentence
  const idx = sentence.toLowerCase().indexOf(target.toLowerCase())
  if (idx === -1) return sentence
  return (
    <>
      {sentence.slice(0, idx)}
      <mark style={{ background: 'rgba(213,155,64,0.18)', color: T.amber, borderRadius: 3, padding: '0 2px', fontStyle: 'normal' }}>
        {sentence.slice(idx, idx + target.length)}
      </mark>
      {sentence.slice(idx + target.length)}
    </>
  )
}

function ReviewSession({
  cards,
  overflow: initialOverflow,
  ctx,
  onExit,
  onReloadNeeded,
}: {
  cards:    FlashcardWithItem[]
  overflow: FlashcardWithItem[]
  ctx:      SessionContext
  onExit:   (reviewed: number, reviewedCards: FlashcardWithItem[], gradeHistory: Map<string, Rating[]>) => void
  onReloadNeeded: () => void
}) {
  const [queue,    setQueue]    = useState<QueueEntry[]>(() => cards.map(c => ({ card: c })))
  const [overflow, setOverflow] = useState<FlashcardWithItem[]>(initialOverflow)
  const [qIdx,          setQIdx]          = useState(0)
  const [handledCount,  setHandledCount]  = useState(0)
  const [totalCards,    setTotalCards]    = useState(cards.length)
  const completedRef                       = useRef(new Set<string>())
  const gradeHistoryRef                    = useRef(new Map<string, Rating[]>())
  const [revealed,       setRevealed]      = useState(false)
  const [showOptions,    setShowOptions]   = useState(false)
  const [showHardEasy,   setShowHardEasyRaw] = useState(true)
  const [showButtons,    setShowButtonsRaw]  = useState(true)
  const [cardFlags,      setCardFlags]     = useState<Record<string, string | null>>({})
  const [showFlagPicker, setShowFlagPicker] = useState(false)
  const [dailyCap,       setDailyCapRaw]    = useState(100)
  const [reviewMode,     setReviewModeRaw]  = useState('forward')
  const [shuffleNew,     setShuffleNewRaw]  = useState(false)
  const [showAllLangs,   setShowAllLangsRaw] = useState(true)
  const [excludedLangs,  setExcludedLangsRaw] = useState<string[]>([])
  const swipeStart   = useRef({ x: 0, y: 0 })
  const audioRef     = useRef<HTMLAudioElement | null>(null)
  const undoStackRef  = useRef<UndoEntry[]>([])
  const [undoCount,    setUndoCount]    = useState(0)
  const queueRef      = useRef<QueueEntry[]>(cards.map(c => ({ card: c })))
  const overflowRef   = useRef<FlashcardWithItem[]>(initialOverflow)
  const [showKebab,    setShowKebab]    = useState(false)
  const onExitRef = useRef(onExit)
  useEffect(() => { onExitRef.current = onExit })
  const sessionEndFiredRef = useRef(false)
  const pendingRef         = useRef(false)
  const pendingEventsRef   = useRef<PendingReviewEvent[]>([])
  const [drag,       setDrag]       = useState<{ x: number; y: number } | null>(null)
  const [gradingFly, setGradingFly] = useState<{ x: number; y: number; color: string; label: string } | null>(null)
  const [entering,   setEntering]   = useState(true)

  // ── DEV inspect ──────────────────────────────────────────────────────────────
  const [showInspect,    setShowInspect]    = useState(false)
  const [inspectTab,     setInspectTab]     = useState<'srs' | 'others'>('srs')
  type ReviewRow = { id: string; rating: string; mode: string | null; phase: string; reviewed_at: string; due_at: string | null }
  const [inspectHistory, setInspectHistory] = useState<ReviewRow[] | null>(null)
  useEffect(() => {
    const cardId = queue[qIdx]?.card?.id
    if (!showInspect || !cardId) return
    setInspectHistory(null)
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      sb.from('ind_reviews')
        .select('id, rating, mode, phase, reviewed_at, due_at')
        .eq('flashcard_id', cardId)
        .order('reviewed_at', { ascending: false })
        .limit(20)
        .then(({ data }) => setInspectHistory((data ?? []) as ReviewRow[]))
    })
  }, [showInspect, qIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop audio + close kebab when card advances; reset action gate
  useEffect(() => { audioRef.current?.pause(); setShowKebab(false); setShowInspect(false); pendingRef.current = false }, [qIdx])

  useEffect(() => {
    setEntering(true)
    let cancelled = false
    requestAnimationFrame(() => { requestAnimationFrame(() => { if (!cancelled) setEntering(false) }) })
    return () => { cancelled = true }
  }, [qIdx])

  // Autoplay in audio mode when card changes
  useEffect(() => {
    if (reviewMode !== 'audio') return
    const e = queue[qIdx]
    if (!e) return
    const url = cardAudio(e.card)
    if (url) playAudio(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, reviewMode])

  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url)
    audioRef.current = a
    a.play().catch(() => {})
  }

  useEffect(() => {
    setShowHardEasyRaw(localStorage.getItem('srs_show_hard_easy') !== 'false')
    setShowButtonsRaw(localStorage.getItem('srs_show_buttons') !== 'false')
    const cap = parseInt(localStorage.getItem('srs_review_cap') ?? '100')
    setDailyCapRaw(isNaN(cap) ? 100 : Math.min(300, Math.max(1,cap)))
    setReviewModeRaw(localStorage.getItem('srs_review_mode') ?? 'forward')
    setShuffleNewRaw(localStorage.getItem('srs_shuffle_new') === 'true')
    setShowAllLangsRaw(localStorage.getItem('srs_show_all_langs') !== 'false')
    try { setExcludedLangsRaw(JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]')) } catch {}
  }, [])

  function setShuffleNew(v: boolean)   { setShuffleNewRaw(v);   localStorage.setItem('srs_shuffle_new',    String(v)); patchPreferences({ shuffle_new: v }) }
  function setShowHardEasy(v: boolean) { setShowHardEasyRaw(v); localStorage.setItem('srs_show_hard_easy', String(v)); patchPreferences({ show_hard_easy: v }) }
  function setShowButtons(v: boolean)  { setShowButtonsRaw(v);  localStorage.setItem('srs_show_buttons',   String(v)); patchPreferences({ show_buttons: v }) }
  function setDailyCap(v: number) {
    const n = Math.min(999, Math.max(5, v))
    setDailyCapRaw(n); localStorage.setItem('srs_review_cap', String(n)); patchPreferences({ review_cap: n })
  }
  function setReviewMode(v: string) { setReviewModeRaw(v); localStorage.setItem('srs_review_mode', v); patchPreferences({ review_mode: v }) }
  function setShowAllLangs(v: boolean) { setShowAllLangsRaw(v) }
  function setExcludedLangs(v: string[]) { setExcludedLangsRaw(v) }

  // Session end: fires once when queue is exhausted.
  // onExit is kept in a ref so this effect doesn't re-run when ReviewPage re-renders
  // (which would cause onExit to fire multiple times as reload() triggers state updates).
  useEffect(() => {
    if (queue.length > 0 && qIdx >= queue.length && !sessionEndFiredRef.current) {
      sessionEndFiredRef.current = true
      flushReviewEvents(pendingEventsRef.current).then(() => {})
      pendingEventsRef.current = []
      onExitRef.current(completedRef.current.size, cards.filter(c => completedRef.current.has(c.id)), gradeHistoryRef.current)
    }
  }, [qIdx, queue.length])

  const entry = queue[qIdx]

  // Keyboard shortcuts
  useEffect(() => {
    if (!entry) return
    function onKey(e: KeyboardEvent) {
      if (showOptions) return
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true) }
        else if (e.key === 'ArrowUp')   submit('easy')
        else if (e.key === 'ArrowDown') handleSuspend()
      } else {
        if      (e.key === '1' || e.key === 'ArrowLeft')                submit('again')
        else if (e.key === '2' && showHardEasy)                         submit('hard')
        else if (e.key === '3' || e.key === 'ArrowRight')               submit('good')
        else if ((e.key === '4' && showHardEasy) || e.key === 'ArrowUp') submit('easy')
        else if (e.key === 'ArrowDown')                                  handleSuspend()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, showHardEasy, showOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rating button definitions — placed here so useMemo below can reference them
  const RATINGS: { id: Rating; label: string; color: string }[] = [
    { id: 'again', label: 'Again', color: T.crimson },
    { id: 'hard',  label: 'Hard',  color: T.terra   },
    { id: 'good',  label: 'Good',  color: T.sage    },
    { id: 'easy',  label: 'Easy',  color: T.amber   },
  ]

  // Intervals memoised for rating buttons
  const intervals = useMemo(() => {
    if (!entry) return {} as Record<string, string>
    const st = cardSMState(entry.card)
    return Object.fromEntries(RATINGS.map(r => [r.id, formatDays(estimateInterval(st, r.id))]))
  }, [entry?.card?.id, entry?.card?.ease_factor, entry?.card?.interval_days, entry?.card?.repetitions]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return null  // transitioning to done state

  const { card } = entry
  const lang     = cardMeta(card)
  const state    = cardSMState(card)
  const phaseLabel = lang.type

  const targetWord  = card.ind_items?.target_word ?? null
  const hasZh       = !!(card.ind_items?.zh)
  const hasAudio    = !!cardAudio(card)
  // Resolve effective mode with fallback chain (DEC-SRS06)
  const effectiveMode =
    reviewMode === 'sts'     && targetWord  ? 'sts'
    : reviewMode === 'sts'   && !targetWord  ? 'reverse'
    : reviewMode === 'audio' && hasAudio     ? 'audio'
    : reviewMode === 'audio' && !hasAudio    ? 'reverse'
    : reviewMode === 'reverse' && hasZh      ? 'reverse'
    : reviewMode === 'reverse' && !hasZh     ? 'forward'
    : 'forward'
  const isSts       = effectiveMode === 'sts'
  const isAudio     = effectiveMode === 'audio'
  const isReverse   = effectiveMode === 'reverse'
  const stsWord     = targetWord ?? ''
  const stsSentence = card.ind_items?.ab ?? ''

  function pushUndo(entry: UndoEntry) { undoStackRef.current.push(entry); setUndoCount(n => n + 1) }
  function popUndo(): UndoEntry | undefined { const e = undoStackRef.current.pop(); setUndoCount(n => n - 1); return e }
  function updateQueue(updater: (q: QueueEntry[]) => QueueEntry[]) { const next = updater(queueRef.current); queueRef.current = next; setQueue(next) }
  function updateOverflow(updater: (o: FlashcardWithItem[]) => FlashcardWithItem[]) { const next = updater(overflowRef.current); overflowRef.current = next; setOverflow(next) }

  function ratingToFly(r: Rating): { x: number; y: number; color: string; label: string } {
    if (r === 'again') return { x: -700, y: -80,  color: T.crimson, label: 'AGAIN' }
    if (r === 'hard')  return { x:  300, y: -650,  color: T.terra,   label: 'HARD'  }
    if (r === 'easy')  return { x:   60, y: -700,  color: T.amber,   label: 'EASY'  }
    return                     { x:  700, y: -80,  color: T.sage,    label: 'GOOD'  }
  }

  async function submit(rating: Rating) {
    if (pendingRef.current) return
    pendingRef.current = true

    const fly = ratingToFly(rating)
    setGradingFly(fly)
    setDrag(null)

    const ANIM_MS = 350
    const isLapsed = entry.lapsedInterval !== undefined

    if (rating === 'again') {
      // Any Again: buffer event + requeue +10; preserve original pre-lapse interval across retries
      gradeHistoryRef.current.set(card.id, [...(gradeHistoryRef.current.get(card.id) ?? []), 'again'])
      const lapsedInterval = entry.lapsedInterval ?? card.interval_days ?? 1
      pendingEventsRef.current.push({
        flashcard_id: card.id, rating: 'again',
        due_at: card.due_at ?? null, mode: effectiveMode,
        phase: 'review_requeue', reviewed_at: new Date().toISOString(),
      })
      const insertedAt = Math.min(qIdx + 11, queueRef.current.length)
      updateQueue(q => [...q.slice(0, insertedAt), { card, lapsedInterval }, ...q.slice(insertedAt)])
      pushUndo({ type: 'again', cardId: card.id, insertedAt, lapsedInterval })
      await new Promise<void>(r => setTimeout(r, ANIM_MS))
      setGradingFly(null)
      setRevealed(false)
      setShowFlagPicker(false)
      setQIdx(qi => qi + 1)
      return
    }

    const prevState: PrevSMState = { ease_factor: card.ease_factor, interval_days: card.interval_days, repetitions: card.repetitions, due_at: card.due_at }

    try {
      await Promise.all([
        isLapsed
          // Requeued card rated Good/Easy/Hard: 50% interval recovery (Hard mapped to Good)
          ? rateCardRelearn(card.id, (rating === 'hard' ? 'good' : rating) as 'good' | 'easy', state, entry.lapsedInterval!, effectiveMode, rating)
          : rateCard(card.id, rating, state, effectiveMode),
        new Promise<void>(r => setTimeout(r, ANIM_MS)),
      ])
    } catch {
      setGradingFly(null)
      pendingRef.current = false
      return
    }

    setGradingFly(null)
    completedRef.current.add(card.id)
    gradeHistoryRef.current.set(card.id, [...(gradeHistoryRef.current.get(card.id) ?? []), rating])
    setHandledCount(c => c + 1)
    pushUndo({ type: 'rate', cardId: card.id, prevState, wasLapsed: isLapsed, lapsedInterval: entry.lapsedInterval })
    setRevealed(false)
    setShowFlagPicker(false)
    setQIdx(qi => qi + 1)
  }

  async function handleDefer() {
    if (pendingRef.current) return
    pendingRef.current = true
    const prevDueAt = card.due_at ?? null
    await deferCard(card.id)
    setTotalCards(n => n - 1)
    pushUndo({ type: 'defer', cardId: card.id, prevDueAt })
    setRevealed(false)
    setShowFlagPicker(false)
    setQIdx(qi => qi + 1)
  }

  async function handleUndo() {
    if (pendingRef.current) return
    pendingRef.current = true
    const top = popUndo()
    if (!top) { pendingRef.current = false; return }

    if (top.type === 'rate') {
      await undoRating(top.cardId, top.prevState)
      completedRef.current.delete(top.cardId)
      const prevGrades = gradeHistoryRef.current.get(top.cardId) ?? []
      gradeHistoryRef.current.set(top.cardId, prevGrades.slice(0, -1))
      setHandledCount(c => c - 1)
      setRevealed(false)
      setQIdx(qi => qi - 1)
      return
    }

    if (top.type === 'again') {
      updateQueue(q => [...q.slice(0, top.insertedAt), ...q.slice(top.insertedAt + 1)])
      // Remove the most recent buffered 'again' event for this card (LIFO)
      let idx = -1
      for (let i = pendingEventsRef.current.length - 1; i >= 0; i--) {
        if (pendingEventsRef.current[i].flashcard_id === top.cardId && pendingEventsRef.current[i].rating === 'again') { idx = i; break }
      }
      if (idx !== -1) pendingEventsRef.current.splice(idx, 1)
      const prevGrades = gradeHistoryRef.current.get(top.cardId) ?? []
      gradeHistoryRef.current.set(top.cardId, prevGrades.slice(0, -1))
      setRevealed(false)
      setQIdx(qi => qi - 1)
      return
    }

    if (top.type === 'defer') {
      await undoDefer(top.cardId, top.prevDueAt)
      setTotalCards(n => n + 1)
      setRevealed(false)
      setQIdx(qi => qi - 1)
      return
    }

    if (top.type === 'suspend') {
      await unsuspendCard(top.cardId)
      if (top.appendedOverflow !== null && top.appendedAt !== null) {
        updateQueue(q => [...q.slice(0, top.appendedAt!), ...q.slice(top.appendedAt! + 1)])
        updateOverflow(o => [top.appendedOverflow!, ...o])
      } else {
        setTotalCards(n => n + 1)
      }
      setRevealed(false)
      setQIdx(qi => qi - 1)
    }
  }

  async function handleSuspend() {
    if (pendingRef.current) return
    pendingRef.current = true
    setGradingFly({ x: 0, y: 700, color: T.inkSoft, label: 'PAUSE' })
    setDrag(null)
    await Promise.all([
      suspendCard(card.id),
      new Promise<void>(r => setTimeout(r, 350)),
    ])
    setGradingFly(null)
    setShowFlagPicker(false)
    setRevealed(false)
    let appendedOverflow: FlashcardWithItem | null = null
    let appendedAt: number | null = null
    if (overflowRef.current.length > 0) {
      appendedOverflow = overflowRef.current[0]
      appendedAt = queueRef.current.length
      updateQueue(q => [...q, { card: appendedOverflow! }])
      updateOverflow(o => o.slice(1))
    } else {
      setTotalCards(n => n - 1)
    }
    pushUndo({ type: 'suspend', cardId: card.id, appendedOverflow, appendedAt })
    setQIdx(qi => qi + 1)
  }

  function handleSetFlag(color: string | null) {
    setCardFlags(prev => ({ ...prev, [card.id]: color }))
    setShowFlagPicker(false)
    setFlagColor(card.id, color)
  }

  const currentFlag    = card.id in cardFlags ? cardFlags[card.id] : (card.flag_color ?? null)
  const currentFlagHex = flagColorHex(currentFlag)

  function onTouchStart(e: React.TouchEvent) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (gradingFly) return
    const dx = e.touches[0].clientX - swipeStart.current.x
    const dy = e.touches[0].clientY - swipeStart.current.y
    setDrag({ x: dx, y: dy })
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStart.current.x
    const dy = e.changedTouches[0].clientY - swipeStart.current.y
    const absX = Math.abs(dx), absY = Math.abs(dy)
    const THRESH = 70
    setDrag(null)
    if (!revealed) {
      if (absX < 10 && absY < 10) { setRevealed(true); return }
      if (absY > absX && absY > THRESH) {
        if (dy < 0) { submit('easy'); return }   // up = easy
        else        { handleSuspend(); return }  // down = suspend
      }
      return  // horizontal swipes before flip do nothing
    }
    // After flip: ← again, → good, ↓ suspend, ↑ easy
    if (absX > absY && absX > THRESH) submit(dx < 0 ? 'again' : 'good')
    else if (absY > absX && absY > THRESH) { if (dy < 0) submit('easy'); else handleSuspend() }
  }

  const visibleRatings = showHardEasy ? RATINGS : RATINGS.filter(r => r.id === 'again' || r.id === 'good')

  // ── Tinder swipe visuals ──────────────────────────────────────────────────────
  const swipeDx = drag?.x ?? gradingFly?.x ?? 0
  const swipeDy = drag?.y ?? gradingFly?.y ?? 0
  const swipeRot = Math.max(-15, Math.min(15, swipeDx * 0.04))
  const cardTransform = (drag || gradingFly)
    ? `translate(${swipeDx}px, ${swipeDy}px) rotate(${swipeRot}deg)`
    : entering ? 'translateY(70px)' : 'translate(0px,0px) rotate(0deg)'
  const cardTransition = drag
    ? 'none'
    : gradingFly
    ? 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s ease'
    : entering
    ? 'none'
    : 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease-out'
  const cardOpacity = gradingFly ? 0.5 : entering ? 0 : 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: T.cream, display: 'flex', flexDirection: 'column' }}>

      {/* Session header */}
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 0', flexShrink: 0 }}>
        <button onClick={() => {
          flushReviewEvents(pendingEventsRef.current).then(() => {})
          pendingEventsRef.current = []
          onExit(completedRef.current.size, cards.filter(c => completedRef.current.has(c.id)), gradeHistoryRef.current)
        }} aria-label="Exit session" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getLangName(lang.language)}{lang.dialect ? ` · ${lang.dialect}` : ''}
          </div>
        </div>

        <button onClick={() => setShowOptions(true)} aria-label="Session options" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="settings" size={16} strokeWidth={1.7} />
        </button>

        {/* Kebab — skip + suspend + dev */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setShowKebab(p => !p)} aria-label="More actions" style={{
            width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.inkSoft, cursor: 'pointer',
          }}>
            <Icon name="more-v" size={16} strokeWidth={2} />
          </button>
          {showKebab && (
            <>
              <div onClick={() => setShowKebab(false)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 26,
                background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                borderRadius: 13, boxShadow: '0 4px 16px rgba(43,34,26,0.12)',
                overflow: 'hidden', minWidth: 185,
              }}>
                <button onClick={() => { setShowKebab(false); handleDefer() }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 14, color: T.ink, textAlign: 'left',
                }}>
                  <Icon name="skip-fwd" size={15} strokeWidth={1.8} color={T.inkSoft} />
                  Skip to tomorrow
                </button>
                <div style={{ height: 1, background: T.lineSoft }} />
                <button onClick={() => { setShowKebab(false); handleSuspend() }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 14, color: T.ink, textAlign: 'left',
                }}>
                  <Icon name="pause" size={15} strokeWidth={1.8} color={T.inkSoft} />
                  Suspend card
                </button>
                <div style={{ height: 1, background: T.lineSoft }} />
                <button onClick={() => { setShowKebab(false); setShowInspect(p => !p) }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13, color: T.inkMute, textAlign: 'left',
                  fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em',
                }}>
                  <Icon name="layers" size={14} strokeWidth={1.8} color={T.inkFaint} />
                  Inspect card
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress bar + counter / undo row */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ height: 4, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${(handledCount / Math.max(totalCards, 1)) * 100}%`, height: '100%', background: T.crimson, borderRadius: 999, transition: 'width .3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 5, minHeight: 20 }}>
          {/* Left: returning indicator */}
          <div />
          {/* Right: counter stacked above undo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, color: T.inkSoft, fontWeight: 600, letterSpacing: '0.01em' }}>
              {handledCount} / {totalCards}
            </span>
            {undoCount > 0 && (
              <button onClick={handleUndo} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 18, color: T.inkSoft, letterSpacing: '0.03em',
              }}>
                <Icon name="rotate-ccw" size={20} strokeWidth={2} color={T.inkSoft} />
                undo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card area — flex column so hints sit naturally above/below card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 16px 0' }}>

        {/* ↑ easy hint — outside card, above */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8, opacity: 0.65 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: T.amber }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>easy</span>
            <Icon name="chevron" size={13} strokeWidth={2} style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>

        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => {
            if (showFlagPicker) { setShowFlagPicker(false); return }
            if (!revealed) setRevealed(true)
          }}
          style={{
            position: 'relative', background: T.paperHi, borderRadius: 22,
            border: `1px solid ${T.lineSoft}`, padding: '26px 22px', minHeight: 280,
            display: 'flex', flexDirection: 'column', cursor: revealed ? 'default' : 'pointer',
            touchAction: 'none',
            boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
            transform: cardTransform,
            transition: cardTransition,
            opacity: cardOpacity,
            willChange: 'transform',
          }}
        >
          {/* Swipe color overlay + stamp */}
          {(drag || gradingFly) && (() => {
            const dx = drag?.x ?? gradingFly?.x ?? 0
            const dy = drag?.y ?? gradingFly?.y ?? 0
            const absX = Math.abs(dx), absY = Math.abs(dy)

            let color = '', label = ''
            if (gradingFly) {
              color = gradingFly.color; label = gradingFly.label
            } else if (absX > absY) {
              if (revealed) { color = dx < 0 ? T.crimson : T.sage; label = dx < 0 ? 'AGAIN' : 'GOOD' }
            } else {
              color = dy < 0 ? T.amber : T.inkSoft; label = dy < 0 ? 'EASY' : 'PAUSE'
            }
            if (!color) return null

            const intensity = gradingFly ? 1 : Math.min(Math.max(absX, absY) / 90, 1)
            const isH = absX >= absY
            const stampPos: CSSProperties = isH
              ? (dx > 0
                ? { top: 20, left: 20, transform: 'rotate(-10deg)' }
                : { top: 20, right: 20, transform: 'rotate(10deg)' })
              : (dy < 0
                ? { bottom: 20, left: '50%', transform: 'translateX(-50%)' }
                : { top: 20, left: '50%', transform: 'translateX(-50%)' })

            return (
              <>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 22, pointerEvents: 'none', zIndex: 5,
                  background: color, opacity: intensity * 0.22,
                }} />
                {intensity > 0.15 && (
                  <div style={{
                    position: 'absolute', pointerEvents: 'none', zIndex: 6,
                    opacity: Math.min((intensity - 0.15) / 0.35, 1),
                    ...stampPos,
                  }}>
                    <span style={{
                      display: 'block', fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 18, fontWeight: 800, letterSpacing: '0.1em',
                      color, border: `2.5px solid ${color}`, borderRadius: 6, padding: '3px 10px',
                    }}>{label}</span>
                  </div>
                )}
              </>
            )
          })()}

          {/* Top-right: flag button + picker (opens downward) */}
          <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowFlagPicker(p => !p)} aria-label="Set flag" style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: currentFlagHex ?? T.inkFaint,
            }}>
              <Icon name={currentFlag ? 'flagF' : 'flag'} size={15} strokeWidth={1.8} />
            </button>
            {showFlagPicker && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                {FLAG_COLORS.map(fc => (
                  <button key={fc.key} onClick={() => handleSetFlag(fc.key)} style={{
                    width: 22, height: 22, borderRadius: 999, border: 'none',
                    background: fc.color, cursor: 'pointer', flexShrink: 0,
                    boxShadow: currentFlag === fc.key ? `0 0 0 2px #fff, 0 0 0 3.5px ${fc.color}` : 'none',
                  }} />
                ))}
                <button onClick={() => handleSetFlag(null)} style={{
                  width: 22, height: 22, borderRadius: 999,
                  border: `1.5px solid ${T.lineSoft}`, background: T.paper,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: T.inkMute, flexShrink: 0,
                }}>×</button>
              </div>
            )}
          </div>

          {/* Top-center: grade badge */}
          {(() => {
            const grade = computeMasteryGrade(card)
            const GS: Record<string, { color: string; bg: string; border: string }> = {
              seed:     { color: T.amber,    bg: T.amberBg,  border: '#EBD49A' },
              planted:  { color: T.inkSoft,  bg: T.paperHi,  border: T.lineSoft },
              rooted:   { color: '#566234',  bg: '#E4E7CC',  border: '#D2D8AE' },
              blooming: { color: '#3a601a',  bg: '#cfe8b8',  border: '#b2d895' },
            }
            const gs = GS[grade]
            return (
              <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)' }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: gs.color, background: gs.bg, border: `1px solid ${gs.border}`,
                  padding: '2px 7px', borderRadius: 5,
                }}>{grade}</span>
              </div>
            )
          })()}

          {/* Top-left: suspend */}
          <div style={{ position: 'absolute', top: 10, left: 12 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={handleSuspend} aria-label="Suspend card" style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkFaint,
            }}>
              <Icon name="pause" size={15} strokeWidth={1.8} />
            </button>
          </div>

          {/* Left/right swipe hints — inside card, visible only after flip */}
          {revealed && (
            <>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.crimson, opacity: 0.65 }}>
                <Icon name="arrow-l" size={17} strokeWidth={2} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>again</span>
              </div>
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.sage, opacity: 0.65 }}>
                <Icon name="arrow-r" size={17} strokeWidth={2} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl' }}>good</span>
              </div>
            </>
          )}

          {/* Front — anchored above divider, never moves on reveal */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', padding: '0 24px 16px' }}>
            {isAudio ? (
              /* Audio mode — large play button as prompt */
              <button
                onClick={e => { e.stopPropagation(); playAudio(cardAudio(card)!) }}
                aria-label="Play audio"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 64, height: 64, borderRadius: 999,
                  background: T.crimson, border: 'none',
                  cursor: 'pointer', color: '#fff',
                  boxShadow: '0 2px 14px rgba(180,40,30,0.22)',
                }}
              >
                <Icon name="speaker" size={26} strokeWidth={1.6} />
              </button>
            ) : isSts ? (
              /* STS — full sentence with target word highlighted */
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.5 }}>
                {renderHighlighted(stsSentence, stsWord)}
              </div>
            ) : isReverse ? (
              /* Reverse — zh as prompt */
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
                {card.ind_items?.zh ?? '—'}
              </div>
            ) : (
              /* Forward — ab as prompt */
              <>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.22 }}>
                  {card.ind_items?.ab}
                </div>
                {cardAudio(card) && (
                  <button
                    onClick={e => { e.stopPropagation(); playAudio(cardAudio(card)!) }}
                    aria-label="Play audio"
                    style={{
                      marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34, borderRadius: 999, flexShrink: 0,
                      background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                      cursor: 'pointer', color: T.inkSoft,
                    }}
                  >
                    <Icon name="speaker" size={14} strokeWidth={1.8} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Divider — always at vertical center */}
          <div style={{ height: 1, background: T.lineSoft, flexShrink: 0 }} />

          {/* Answer or hint — anchored below divider */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center', paddingTop: 16 }}>
            {revealed ? (
              <>
                {isAudio && (
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.inkSoft, letterSpacing: '-0.01em', marginBottom: 6 }}>
                    {card.ind_items?.ab}
                  </div>
                )}
                {isReverse ? (
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
                    {card.ind_items?.ab}
                  </div>
                ) : (
                  <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                    {card.ind_items?.zh ?? '—'}
                  </div>
                )}
              </>
            ) : (
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                tap to reveal
              </span>
            )}
          </div>
        </div>

        {/* ↓ suspend hint — outside card, below */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, opacity: 0.65 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: T.inkFaint }}>
            <Icon name="chev-d" size={13} strokeWidth={2} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>suspend</span>
          </div>
        </div>
      </div>

      {/* Rating row */}
      <div style={{ padding: '16px 16px 32px', flexShrink: 0 }}>
        {showButtons && revealed ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleRatings.length}, 1fr)`, gap: 7 }}>
            {visibleRatings.map(r => (
              <button
                key={r.id}
                onClick={() => submit(r.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '12px 4px', borderRadius: 13,
                  background: T.paperHi, border: `1.5px solid ${r.color}`,
                  color: r.color, fontWeight: 600, cursor: 'pointer', transition: 'background .1s, color .1s',
                }}
                onPointerDown={e => { (e.currentTarget as HTMLButtonElement).style.background = r.color; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                onPointerUp={e => { (e.currentTarget as HTMLButtonElement).style.background = T.paperHi; (e.currentTarget as HTMLButtonElement).style.color = r.color }}
                onPointerLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.paperHi; (e.currentTarget as HTMLButtonElement).style.color = r.color }}
              >
                <span style={{ fontSize: 13.5 }}>{r.label}</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, opacity: 0.75, fontWeight: 500 }}>{intervals[r.id]}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* DEV inspect sheet */}
      {showInspect && (() => {
        const grade = computeMasteryGrade(card)
        const gradeColors: Record<string, string> = { seed: '#C89A20', planted: '#888', rooted: '#566234', blooming: '#3a601a' }
        function fmt(iso: string | null) {
          if (!iso) return '—'
          const d = new Date(iso)
          const diff = d.getTime() - Date.now()
          const abs = Math.abs(diff), sign = diff < 0 ? '-' : '+'
          const rel = abs < 60_000 ? 'now'
            : abs < 3_600_000 ? `${sign}${Math.round(abs/60_000)}m`
            : abs < 86_400_000 ? `${sign}${Math.round(abs/3_600_000)}h`
            : `${sign}${Math.round(abs/86_400_000)}d`
          return `${d.toISOString().slice(0, 16).replace('T', ' ')} (${rel})`
        }
        const srsRows: [string, string][] = [
          ['ab',            card.ind_items?.ab ?? '—'],
          ['zh',            card.ind_items?.zh ?? '—'],
          ['target_word',   card.ind_items?.target_word ?? '—'],
          ['mastery',        grade],
          ['repetitions',   String(card.repetitions)],
          ['ease_factor',   card.ease_factor.toFixed(2)],
          ['interval_days', card.interval_days % 1 === 0 ? String(card.interval_days) : card.interval_days.toFixed(2)],
          ['due_at',        fmt(card.due_at)],
          ['suspended_at',  fmt(card.suspended_at)],
          ...(entry.lapsedInterval !== undefined ? [['lapsed_interval', String(entry.lapsedInterval)] as [string, string]] : []),
        ]
        const othersRows: [string, string][] = [
          ['language',    lang.language],
          ['dialect',     lang.dialect ?? '—'],
          ['card_type',   card.ind_items?.type ?? '—'],
          ['session_mode', effectiveMode],
          ['note_source', card.ind_items?.note_source ?? '—'],
          ['collection',  card.ind_items?.ind_learn_collections?.name ?? card.ind_items?.collection_id ?? '—'],
          ['level',       String(card.ind_items?.level ?? '—')],
          ['lesson',      String(card.ind_items?.lesson ?? '—')],
          ['position',    String(card.ind_items?.position ?? '—')],
          ['place_heard', card.ind_items?.place_heard ?? '—'],
          ['tags',        card.ind_items?.tags?.join(', ') ?? '—'],
          ['flag_color',  card.flag_color ?? '—'],
          ['created_at',  fmt(card.created_at)],
          ['id',          card.id],
          ['note_id',     card.note_id],
        ]
        const MONO: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' }
        return (
          <>
            <div onClick={() => setShowInspect(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 30 }} />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 31,
              background: '#1a1a1a', borderRadius: '18px 18px 0 0',
              height: '95vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
            }}>
              {/* Sheet header */}
              <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ ...MONO, fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                  Card Inspector · DEV
                </span>
                <button onClick={() => setShowInspect(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
                  <Icon name="close" size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
                {(['srs', 'others'] as const).map(t => (
                  <button key={t} onClick={() => setInspectTab(t)} style={{
                    flex: 1, padding: '7px 0', background: 'none', border: 'none',
                    borderBottom: `2px solid ${inspectTab === t ? '#666' : 'transparent'}`,
                    ...MONO, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: inspectTab === t ? '#ccc' : '#444',
                    cursor: 'pointer',
                  }}>{t}</button>
                ))}
              </div>

              {/* Scrollable content */}
              <div style={{ overflowY: 'auto', padding: '0 16px 40px' }}>
                {inspectTab === 'srs' ? (
                  <>
                    {/* SRS fields */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: 11, marginTop: 2 }}>
                      <tbody>
                        {srsRows.map(([k, v]) => (
                          <tr key={k} style={{ borderBottom: '1px solid #2a2a2a' }}>
                            <td style={{ padding: '5px 8px 5px 0', color: '#555', whiteSpace: 'nowrap', width: 130, verticalAlign: 'top' }}>{k}</td>
                            <td onClick={() => navigator.clipboard.writeText(v)} style={{ padding: '5px 0', color: k === 'mastery' ? gradeColors[v] ?? '#ccc' : '#ccc', wordBreak: 'break-all', cursor: 'pointer' }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Review history */}
                    <div style={{ ...MONO, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 6px', fontWeight: 700 }}>
                      Review history
                    </div>
                    {inspectHistory === null ? (
                      <div style={{ fontSize: 11, color: '#555', ...MONO }}>loading…</div>
                    ) : inspectHistory.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#555', ...MONO }}>no reviews yet</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: 11 }}>
                        <thead>
                          <tr>
                            {['reviewed_at', 'rating', 'mode', 'phase'].map(h => (
                              <td key={h} style={{ padding: '3px 6px 3px 0', color: '#444', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</td>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inspectHistory.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #222' }}>
                              <td style={{ padding: '4px 6px 4px 0', color: '#888', whiteSpace: 'nowrap' }}>{r.reviewed_at.slice(0, 16).replace('T', ' ')}</td>
                              <td style={{ padding: '4px 6px 4px 0', color: r.rating === 'again' ? '#e06c6c' : r.rating === 'easy' ? '#C89A20' : r.rating === 'good' ? '#7bab4a' : '#c8844a', whiteSpace: 'nowrap' }}>{r.rating}</td>
                              <td style={{ padding: '4px 6px 4px 0', color: '#666', whiteSpace: 'nowrap' }}>{r.mode ?? '—'}</td>
                              <td style={{ padding: '4px 0', color: '#555', whiteSpace: 'nowrap' }}>{r.phase}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: 11, marginTop: 2 }}>
                    <tbody>
                      {othersRows.map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '5px 8px 5px 0', color: '#555', whiteSpace: 'nowrap', width: 130, verticalAlign: 'top' }}>{k}</td>
                          <td onClick={() => navigator.clipboard.writeText(v)} style={{ padding: '5px 0', color: '#ccc', wordBreak: 'break-all', cursor: 'pointer' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Options sheet */}
      {showOptions && (
        <OptionsSheet
          showHardEasy={showHardEasy}       setShowHardEasy={setShowHardEasy}
          showButtons={showButtons}         setShowButtons={setShowButtons}
          dailyCap={dailyCap}               setDailyCap={setDailyCap}
          reviewMode={reviewMode}           setReviewMode={setReviewMode}
          shuffleNew={shuffleNew}           setShuffleNew={setShuffleNew}
          showAllLangs={showAllLangs}       setShowAllLangs={setShowAllLangs}
          excludedLangs={excludedLangs}     setExcludedLangs={setExcludedLangs}
          onReloadNeeded={onReloadNeeded}
          onClose={() => setShowOptions(false)}
        />
      )}
    </div>
  )
}

// ─── ReviewEnd ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#C14B2C', '#EDAB32', '#7A9F3C', '#B06030', '#F5D060']

const GRADE_DOT_COLOR: Record<Rating, string> = {
  again: T.crimson,
  hard:  T.terra,
  good:  T.sage,
  easy:  T.amber,
}

function ReviewEnd({
  sessionCount,
  goalMet,
  streak,
  reviewedCards,
  gradeHistory,
  reviewMoreN: reviewMoreNProp,
  onReviewMore,
  onDone,
}: {
  sessionCount: number
  goalMet: boolean
  streak: number
  reviewedCards: FlashcardWithItem[]
  gradeHistory: Map<string, Rating[]>
  reviewMoreN: number
  onReviewMore: (n: number) => void
  onDone: () => void
}) {
  const [dueTomorrow,      setDueTomorrow]      = useState<number | null>(null)
  const [sessionReturning, setSessionReturning] = useState<SessionReturning | null>(null)
  const [listExpanded,     setListExpanded]     = useState(false)
  const [reviewMoreN,      setReviewMoreNRaw]   = useState(reviewMoreNProp)
  const [editingMore,      setEditingMore]      = useState(false)

  useEffect(() => { countDueTomorrow().then(setDueTomorrow) }, [])
  useEffect(() => {
    countSessionReturning(reviewedCards.map(c => c.id)).then(setSessionReturning)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setReviewMoreN(n: number) {
    const v = Math.max(10, Math.round(n / 5) * 5)
    setReviewMoreNRaw(v)
    localStorage.setItem('srs_review_more_size', String(v))
    patchPreferences({ review_more_size: v })
  }

  const confetti = useMemo(() => {
    let s = 11
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    return Array.from({ length: 22 }, (_, i) => ({
      left: rnd() * 100, top: rnd() * 45, rot: rnd() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 6 + rnd() * 6, h: 9 + rnd() * 8, round: rnd() > 0.6,
    }))
  }, [])

  function handleShare() {
    const text = `Reviewed ${sessionCount} card${sessionCount !== 1 ? 's' : ''}${streak > 0 ? ` · 🔥 ${streak}-day streak` : ''} — studying Amis`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text).catch(() => {})
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: T.cream, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Confetti */}
      {goalMet && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          {confetti.map((p, i) => (
            <span key={i} style={{
              position: 'absolute', left: `${p.left}%`, top: `${p.top}%`,
              width: p.w, height: p.h, background: p.color,
              borderRadius: p.round ? 999 : 2, transform: `rotate(${p.rot}deg)`, opacity: 0.9,
            }} />
          ))}
        </div>
      )}

      {/* Close */}
      <div style={{ padding: '10px 16px 0', display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 2 }}>
        <button onClick={onDone} aria-label="Close" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, cursor: 'pointer',
        }}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Main scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 28px 20px' }}>
          {goalMet && (
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              color: '#4A7320', background: T.sageBg, border: '1px solid #D2D8AE',
              padding: '6px 13px', borderRadius: 999, marginBottom: 18,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="check" size={13} color="#4A7320" strokeWidth={2.6} /> Daily goal met
            </span>
          )}
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 88, fontWeight: 600, color: T.ink, letterSpacing: '-0.04em', lineHeight: 0.9 }}>
            {sessionCount}
          </div>
          <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 8, fontWeight: 500 }}>cards reviewed</div>

          {dueTomorrow !== null && (
            <>
              <div style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 14, background: T.paperHi, border: `1px solid ${T.lineSoft}`,
              }}>
                <Icon name="card" size={16} color={T.amber} strokeWidth={1.8} />
                <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em' }}>{dueTomorrow}</span>
                <span style={{ fontSize: 13, color: T.inkSoft }}>due tomorrow</span>
              </div>
              {sessionReturning !== null && sessionReturning.total > 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: T.inkMute }}>
                  {sessionReturning.total} card{sessionReturning.total !== 1 ? 's' : ''} from this session will be back before the next reset ({sessionReturning.newCards} New and {sessionReturning.plantedOrAbove} Planted or above).
                </div>
              )}
              {sessionReturning !== null && sessionReturning.plantedOrAbove > 0 && (
                <Link href="/review?start=1&advance=1" style={{
                  marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 12, textDecoration: 'none',
                  background: T.amberBg, color: T.amber,
                  fontSize: 13, fontWeight: 600,
                }}>
                  Review {sessionReturning.plantedOrAbove} in advance?
                </Link>
              )}
            </>
          )}

          {!goalMet && dueTomorrow !== null && dueTomorrow < 5 && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 7, maxWidth: 280, fontSize: 12, color: T.inkMute, lineHeight: 1.5, textAlign: 'left' }}>
              <Icon name="capture" size={14} color={T.sage} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>Capture more words today to keep your streak growing tomorrow.</span>
            </div>
          )}
        </div>

        {/* Reviewed items list */}
        {reviewedCards.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <button
              onClick={() => setListExpanded(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                fontSize: 13, fontWeight: 600, color: T.inkSoft,
              }}
            >
              <span>{reviewedCards.length} card{reviewedCards.length !== 1 ? 's' : ''} this session</span>
              <Icon name="chev-d" size={14} strokeWidth={2} style={{ transform: listExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {listExpanded && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {reviewedCards.map(c => {
                  const grades = gradeHistory.get(c.id) ?? []
                  return (
                    <div key={c.id} style={{
                      padding: '8px 14px', borderRadius: 10,
                      background: T.paper, border: `1px solid ${T.lineSoft}`,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{c.ind_items?.ab}</span>
                        {c.ind_items?.zh && <span style={{ fontSize: 12, color: T.inkSoft }}>{c.ind_items.zh}</span>}
                      </div>
                      {grades.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                          {grades.map((g, i) => (
                            <div key={i} style={{
                              width: 6, height: 6, borderRadius: 999,
                              background: GRADE_DOT_COLOR[g], opacity: 0.85,
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '0 16px 40px', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {editingMore && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 14px', borderRadius: 13, background: T.paperHi, border: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 13, color: T.inkSoft }}>Review</span>
            <button onClick={() => setReviewMoreN(reviewMoreN - 5)} disabled={reviewMoreN <= 10} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`, background: T.paper, color: T.inkSoft, cursor: reviewMoreN <= 10 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: reviewMoreN <= 10 ? 0.35 : 1, fontSize: 16 }}>−</button>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 16, fontWeight: 700, color: T.ink, minWidth: 32, textAlign: 'center' }}>{reviewMoreN}</span>
            <button onClick={() => setReviewMoreN(reviewMoreN + 5)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`, background: T.paper, color: T.inkSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>+</button>
            <span style={{ fontSize: 13, color: T.inkSoft }}>more cards</span>
          </div>
        )}
        <button onClick={handleShare} style={{
          width: '100%', height: 46, borderRadius: 13, background: T.paperHi, color: T.ink,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
        }}>
          <Icon name="share" size={16} strokeWidth={1.9} /> Share progress
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Review N more — with inline editable N */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 0, borderRadius: 14, border: `1px solid ${T.line}`, overflow: 'hidden', background: T.paperHi, boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset' }}>
            <button onClick={() => onReviewMore(reviewMoreN)} style={{
              flex: 1, height: 52, background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 15, fontWeight: 600, cursor: 'pointer', color: T.ink,
            }}>
              <Icon name="review" size={15} strokeWidth={2} /> {reviewMoreN} more
            </button>
            <button onClick={() => setEditingMore(v => !v)} aria-label="Edit count" style={{
              width: 36, background: 'none', border: 'none', borderLeft: `1px solid ${T.lineSoft}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkFaint,
            }}>
              <Icon name="pen" size={13} strokeWidth={2} />
            </button>
          </div>
          <button onClick={onDone} style={{
            flex: 1, height: 52, borderRadius: 14,
            background: T.crimson, color: '#fff', border: `1px solid ${T.crimson}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(120,30,15,0.2)',
          }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── Landing ──────────────────────────────────────────────────────────────────

function ReviewPage() {
  const { lang, dialectLabel } = useLang()
  const router           = useRouter()
  const searchParams     = useSearchParams()
  const flagParam        = searchParams.get('flag')
  const filterParam      = searchParams.get('filter')
  const flagColor        = flagParam ?? (filterParam === 'flagged' ? 'any' : undefined)
  const isCustom         = searchParams.get('custom') === '1'
  const isMore           = searchParams.get('more') === '1'
  const customLang       = searchParams.get('lang') ?? undefined
  const customDialect    = searchParams.get('dialect') ?? undefined
  const customCollection = searchParams.get('collectionId') ?? undefined
  const customCaptures   = searchParams.get('capturesOnly') === 'true'
  const customNoteType   = searchParams.get('noteType') ?? undefined
  const customTagsRaw    = searchParams.get('tags')
  const customTags       = customTagsRaw ? customTagsRaw.split(',').filter(Boolean) : undefined
  const customFlagRaw    = searchParams.get('flag') ?? ''
  const customFlagColors = customFlagRaw ? customFlagRaw.split(',').filter(Boolean) : undefined
  const customPlaceHeard = searchParams.get('placeHeard') ?? undefined
  const customDueOnly    = searchParams.get('dueOnly') !== 'false'

  const isAdvance  = searchParams.get('advance') === '1'
  const autostart = searchParams.get('start') === '1' && !isCustom

  const [mode,     setMode]     = useState<'landing' | 'reviewing' | 'done'>('landing')
  const [cards,    setCards]    = useState<FlashcardWithItem[]>([])
  const [overflow, setOverflow] = useState<FlashcardWithItem[]>([])
  const [ctx,     setCtx]     = useState<SessionContext>({ reviewedToday: 0, reviewTarget: 100, dailyCap: 100, streak: 0, priorityCollectionIds: [], reviewMoreSize: null })
  const [loading, setLoading] = useState(true)
  const [sessionCount,    setSessionCount]    = useState(0)
  const [sessionKey,      setSessionKey]      = useState(0)
  const [reviewedCards,   setReviewedCards]   = useState<FlashcardWithItem[]>([])
  const [gradeHistory,    setGradeHistory]    = useState<Map<string, Rating[]>>(new Map())
  const autostartedRef = useRef(false)

  function getExcludeLangs(): string[] {
    if (localStorage.getItem('srs_show_all_langs') === 'false') {
      try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch {}
    }
    return []
  }

  async function reload() {
    await ensureFlashcards()
    const [c, context] = await Promise.all([
      isCustom
        ? listDueFlashcards({
            includeFlagColors:   customFlagColors,
            includePlaceHeard:   customPlaceHeard,
            includeLangs:        customLang ? [customLang] : undefined,
            includeDialect:      customDialect,
            includeCollectionId: customCollection,
            capturesOnly:        customCaptures,
            includeNoteTypes:    customNoteType ? [customNoteType] : undefined,
            includeTags:         customTags,
            dueOnly:             customDueOnly,
          })
        : (async () => {
            const exclude = await getExcludeFromReview()
            const opts: ListDueOpts = {
              flagColor,
              excludeLangs:       getExcludeLangs(),
              excludeCollections: exclude.collections,
              excludeCaptures:    exclude.captures,
            }
            if (isAdvance) {
              const resetHour = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
              const nextReset = new Date()
              if (nextReset.getHours() >= resetHour) nextReset.setDate(nextReset.getDate() + 1)
              nextReset.setHours(resetHour, 0, 0, 0)
              opts.advanceUntil = nextReset.toISOString()
            }
            return listDueFlashcards(opts)
          })(),
      loadSessionContext(),
    ])

    // Priority sort: deck 1 first, then deck 2, …, then non-priority. Stable — preserves due_at order within each group.
    const priorityIds = context.priorityCollectionIds
    if (!isCustom && priorityIds.length > 0) {
      const priorityIdx = (x: FlashcardWithItem) => {
        const colId = x.ind_items?.collection_id
        if (!colId) return Infinity
        const i = priorityIds.indexOf(colId)
        return i === -1 ? Infinity : i
      }
      c.sort((a, b) => priorityIdx(a) - priorityIdx(b))
    }

    const reviewMoreN  = context.reviewMoreSize ?? Math.max(20, Math.round(context.reviewTarget / 50) * 5)
    const sessionCap   = isCustom || isAdvance ? c.length
      : isMore         ? reviewMoreN
      : Math.max(0, context.reviewTarget - context.reviewedToday)
    setCards(c.slice(0, sessionCap))
    setOverflow(isCustom ? [] : c.slice(sessionCap))
    setCtx(context)
    setLoading(false)
    if (autostart && !autostartedRef.current && c.length > 0) {
      autostartedRef.current = true
      setMode('reviewing')
    }
  }

  async function handleReloadNeeded() {
    await reload()
    setSessionKey(k => k + 1)
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSessionExit(reviewed: number, rc: FlashcardWithItem[] = [], history: Map<string, Rating[]> = new Map()) {
    setSessionCount(reviewed)
    setReviewedCards(rc)
    setGradeHistory(history)
    if (reviewed > 0) {
      setMode('done')
    } else if (autostart) {
      router.push('/')
      return
    } else {
      setMode('landing')
    }
    reload()
  }

  async function handleReviewMore(n: number) {
    const exclude = await getExcludeFromReview()
    const more = await listDueFlashcards({
      excludeLangs:       ctx.priorityCollectionIds.length === 0 && localStorage.getItem('srs_show_all_langs') !== 'false'
        ? [] : JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]'),
      excludeCollections: exclude.collections,
      excludeCaptures:    exclude.captures,
    })
    const priorityIds = ctx.priorityCollectionIds
    if (priorityIds.length > 0) {
      const priorityIdx = (x: FlashcardWithItem) => {
        const colId = x.ind_items?.collection_id
        if (!colId) return Infinity
        const i = priorityIds.indexOf(colId)
        return i === -1 ? Infinity : i
      }
      more.sort((a, b) => priorityIdx(a) - priorityIdx(b))
    }
    setCards(more.slice(0, n))
    setMode(more.length > 0 ? 'reviewing' : 'landing')
  }

  const goalMet = ctx.reviewedToday + sessionCount >= ctx.reviewTarget

  // Full-screen overlays (reviewing + done)
  if (mode === 'reviewing' && cards.length > 0) {
    return <ReviewSession key={sessionKey} cards={cards} overflow={overflow} ctx={ctx} onExit={handleSessionExit} onReloadNeeded={handleReloadNeeded} />
  }

  if (mode === 'done') {
    return <ReviewEnd
      sessionCount={sessionCount}
      goalMet={goalMet}
      streak={ctx.streak}
      reviewedCards={reviewedCards}
      gradeHistory={gradeHistory}
      reviewMoreN={ctx.reviewMoreSize ?? Math.max(20, Math.round(ctx.reviewTarget / 50) * 5)}
      onReviewMore={handleReviewMore}
      onDone={autostart ? () => router.push('/') : () => setMode('landing')}
    />
  }

  // Landing
  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <Link href="/" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, textDecoration: 'none',
        }}>
          <Icon name="arrow-l" size={17} strokeWidth={1.8} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lang.name}{dialectLabel ? ` · ${dialectLabel}` : ''}
          </div>
          <h1 style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1, marginTop: 2 }}>
            {flagColor ? 'Flagged' : 'Review'}
          </h1>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-iv-shimmer" style={{ width: 120, height: 16, borderRadius: 8, background: T.lineSoft }} />
        </div>
      ) : cards.length > 0 ? (
        <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 20, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 48, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {cards.length}
            </span>
            <span style={{ fontSize: 15, color: T.inkSoft }}>{cards.length === 1 ? 'card' : 'cards'} due</span>
          </div>
          <div style={{ fontSize: 13, color: T.inkMute }}>~{Math.ceil(cards.length * 0.5)} min</div>
          <button onClick={() => setMode('reviewing')} style={{
            height: 56, borderRadius: 15, background: T.crimson, color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2), 0 8px 18px rgba(120,30,15,0.18)',
          }}>
            <Icon name="play" size={15} color="#fff" />
            Begin session
          </button>
        </div>
      ) : (
        <div style={{ padding: '32px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>All caught up!</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>Come back tomorrow to keep your streak going.</div>
          <Link href="/study" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 16, fontSize: 13, color: T.crimson, fontWeight: 600, textDecoration: 'none' }}>
            <Icon name="learn" size={14} color={T.crimson} strokeWidth={2} /> Go to Study
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ReviewPageWithSuspense() {
  return <Suspense><ReviewPage /></Suspense>
}
