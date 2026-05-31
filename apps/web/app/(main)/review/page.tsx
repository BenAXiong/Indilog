'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { useLang } from '@/lib/context/LangDialectProvider'
import {
  ensureFlashcards, listDueFlashcards, listUserLanguages, getExcludeFromReview,
  rateCard, rateCardRelearn, cardMeta, cardAudio,
  suspendCard, setFlagColor, deferCard, undoRating,
  type FlashcardWithItem, type Rating,
} from '@/lib/db/srs/flashcards'
import { getLangName } from '@/lib/lang/lang-bridge'
import { FLAG_COLORS, flagColorHex } from '@/lib/db/srs/flags'
import { estimateInterval, formatDays, type SMState } from '@/lib/db/srs/schedule'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionContext = {
  reviewedToday: number
  dailyGoal: number
  streak: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardSMState(card: FlashcardWithItem): SMState {
  return { ease_factor: card.ease_factor, interval_days: card.interval_days, repetitions: card.repetitions }
}

async function loadSessionContext(): Promise<SessionContext> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { reviewedToday: 0, dailyGoal: 20, streak: 0 }

  const today   = new Date().toISOString().slice(0, 10)
  const from30  = new Date(); from30.setDate(from30.getDate() - 29)
  const fromStr = from30.toISOString().slice(0, 10)

  const [profileRes, todayRes, dailyRes] = await Promise.all([
    supabase.from('ind_profiles').select('daily_goal').eq('user_id', user.id).maybeSingle(),
    supabase.from('ind_daily_stats').select('reviewed_count').eq('user_id', user.id).eq('date', today).maybeSingle(),
    supabase.from('ind_daily_stats').select('date, reviewed_count').eq('user_id', user.id).gte('date', fromStr).order('date', { ascending: false }),
  ])

  const reviewSet = new Set(
    (dailyRes.data ?? []).filter(r => (r.reviewed_count ?? 0) > 0).map(r => r.date)
  )
  let streak = 0
  const cur = new Date()
  while (reviewSet.has(cur.toISOString().slice(0, 10))) { streak++; cur.setDate(cur.getDate() - 1) }

  return {
    reviewedToday: todayRes.data?.reviewed_count ?? 0,
    dailyGoal:     profileRes.data?.daily_goal ?? 20,
    streak,
  }
}

async function countDueTomorrow(): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const now   = new Date().toISOString()
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('ind_flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('due_at', now)
    .lte('due_at', in24h)
    .is('suspended_at', null)
  return count ?? 0
}

// ─── OptionsSheet ─────────────────────────────────────────────────────────────

function OptionsSheet({
  showHardEasy, setShowHardEasy,
  showButtons, setShowButtons,
  learningSteps, setLearningSteps,
  audioMode, setAudioMode,
  showAllLangs, setShowAllLangs,
  excludedLangs, setExcludedLangs,
  onReloadNeeded,
  onClose,
}: {
  showHardEasy: boolean; setShowHardEasy: (v: boolean) => void
  showButtons:  boolean; setShowButtons:  (v: boolean) => void
  learningSteps: number; setLearningSteps: (v: number) => void
  audioMode:    boolean; setAudioMode:    (v: boolean) => void
  showAllLangs:  boolean; setShowAllLangs:  (v: boolean) => void
  excludedLangs: string[]; setExcludedLangs: (v: string[]) => void
  onReloadNeeded: () => void
  onClose: () => void
}) {
  const [availLangs, setAvailLangs] = useState<string[] | null>(null)

  useEffect(() => {
    if (!showAllLangs && availLangs === null) listUserLanguages().then(setAvailLangs)
  }, [showAllLangs, availLangs])

  function handleToggleShowAll(v: boolean) {
    setShowAllLangs(v)
    localStorage.setItem('srs_show_all_langs', String(v))
    if (v) { setExcludedLangs([]); localStorage.setItem('srs_excluded_langs', '[]') }
    onReloadNeeded()
  }

  function handleToggleLang(code: string) {
    const nowExcluded = !excludedLangs.includes(code)
    const next = nowExcluded ? [...excludedLangs, code] : excludedLangs.filter(l => l !== code)
    setExcludedLangs(next)
    localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
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
          <Toggle label="Audio mode" sub="Play button as front — falls back to text when no audio" on={audioMode} onToggle={() => setAudioMode(!audioMode)} />
          <Toggle label="Rating buttons" sub="Off = gesture-only grading" on={showButtons} onToggle={() => setShowButtons(!showButtons)} />
          <Toggle label="Hard + Easy" sub="Show all four grades, not just two" on={showHardEasy} onToggle={() => setShowHardEasy(!showHardEasy)} />

          {/* Learning passes stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>Learning passes</div>
              <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 1 }}>Times a new card repeats before graduating</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setLearningSteps(learningSteps - 1)} disabled={learningSteps <= 1} style={{
                width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`,
                background: T.paperHi, color: T.inkSoft, cursor: learningSteps <= 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 300, opacity: learningSteps <= 1 ? 0.35 : 1,
              }}>−</button>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 16, fontWeight: 700, color: T.ink, minWidth: 20, textAlign: 'center' }}>
                {learningSteps}
              </span>
              <button onClick={() => setLearningSteps(learningSteps + 1)} disabled={learningSteps >= 5} style={{
                width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`,
                background: T.paperHi, color: T.inkSoft, cursor: learningSteps >= 5 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 300, opacity: learningSteps >= 5 ? 0.35 : 1,
              }}>+</button>
            </div>
          </div>

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
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint }}>{code}</span>
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

type CardPhase = 'review' | 'new' | 'relearn'

type QueueEntry = {
  card:             FlashcardWithItem
  pass:             number    // 0 = first encounter, 1+ = requeue pass
  phase:            CardPhase
  originalInterval: number   // for relearn: the interval before the lapse
  restarts:         number    // how many times this card has been reset to pass 0
}

// Mature threshold: cards with interval ≥ 7d trigger a relearn burst on lapse
const MATURE_THRESHOLD = 7
// Max full restarts before forcing Good graduation
const MAX_RESTARTS = 3

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
  ctx,
  onExit,
  onReloadNeeded,
}: {
  cards: FlashcardWithItem[]
  ctx: SessionContext
  onExit: (reviewed: number) => void
  onReloadNeeded: () => void
}) {
  const [queue, setQueue] = useState<QueueEntry[]>(() =>
    cards.map(c => ({
      card: c, pass: 0, restarts: 0,
      phase: (c.repetitions === 0 && c.interval_days === 0) ? 'new' : 'review',
      originalInterval: c.interval_days,
    }))
  )
  const [qIdx,          setQIdx]          = useState(0)
  const completedRef                       = useRef(new Set<string>())
  const [revealed,       setRevealed]      = useState(false)
  const [showOptions,    setShowOptions]   = useState(false)
  const [showHardEasy,   setShowHardEasyRaw] = useState(true)
  const [showButtons,    setShowButtonsRaw]  = useState(true)
  const [learningSteps,  setLearningStepsRaw] = useState(3)
  const [cardFlags,      setCardFlags]     = useState<Record<string, string | null>>({})
  const [showFlagPicker, setShowFlagPicker] = useState(false)
  const [audioMode,      setAudioModeRaw]  = useState(false)
  const [showAllLangs,   setShowAllLangsRaw] = useState(true)
  const [excludedLangs,  setExcludedLangsRaw] = useState<string[]>([])
  const swipeStart   = useRef({ x: 0, y: 0 })
  const audioRef     = useRef<HTMLAudioElement | null>(null)
  type LastRated = { cardId: string; prevState: { ease_factor: number; interval_days: number; repetitions: number; due_at: string | null } }
  const lastRatedRef = useRef<LastRated | null>(null)
  const [canUndo, setCanUndo] = useState(false)

  // Stop audio when card advances
  useEffect(() => { audioRef.current?.pause() }, [qIdx])

  // Autoplay in audio mode when card changes
  useEffect(() => {
    if (!audioMode) return
    const e = queue[qIdx]
    if (!e) return
    const url = cardAudio(e.card)
    if (url) playAudio(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, audioMode])

  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url)
    audioRef.current = a
    a.play().catch(() => {})
  }

  useEffect(() => {
    setShowHardEasyRaw(localStorage.getItem('srs_show_hard_easy') !== 'false')
    setShowButtonsRaw(localStorage.getItem('srs_show_buttons') !== 'false')
    const saved = parseInt(localStorage.getItem('srs_learning_steps') ?? '3')
    setLearningStepsRaw(isNaN(saved) ? 3 : Math.min(5, Math.max(1, saved)))
    setAudioModeRaw(localStorage.getItem('srs_audio_mode') === 'true')
    setShowAllLangsRaw(localStorage.getItem('srs_show_all_langs') !== 'false')
    try { setExcludedLangsRaw(JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]')) } catch {}
  }, [])

  function setShowHardEasy(v: boolean) { setShowHardEasyRaw(v); localStorage.setItem('srs_show_hard_easy', String(v)) }
  function setShowButtons(v: boolean)  { setShowButtonsRaw(v);  localStorage.setItem('srs_show_buttons', String(v)) }
  function setLearningSteps(v: number) {
    const n = Math.min(5, Math.max(1, v))
    setLearningStepsRaw(n)
    localStorage.setItem('srs_learning_steps', String(n))
  }
  function setAudioMode(v: boolean) { setAudioModeRaw(v); localStorage.setItem('srs_audio_mode', String(v)) }
  function setShowAllLangs(v: boolean) { setShowAllLangsRaw(v) }
  function setExcludedLangs(v: string[]) { setExcludedLangsRaw(v) }

  // Session end: fires when queue is exhausted
  useEffect(() => {
    if (queue.length > 0 && qIdx >= queue.length) onExit(completedRef.current.size)
  }, [qIdx, queue.length, onExit])

  const entry = queue[qIdx]
  if (!entry) return null  // transitioning to done state

  const { card, phase, pass, originalInterval, restarts } = entry
  const lang  = cardMeta(card)
  const state = cardSMState(card)
  const isLearning  = phase !== 'review'
  const isFinalPass = pass >= learningSteps - 1

  // Phase label / color for top-right of card
  const phaseLabel =
    phase === 'relearn' ? 'Relearning'
    : phase === 'new' && (pass > 0 || restarts > 0) ? 'Learning'
    : phase === 'new' ? 'New'
    : lang.type
  const phaseColor =
    phase === 'relearn' ? T.amber : phase === 'new' ? T.sage : T.inkFaint

  const isSts       = card.card_type === 'sts'
  const stsWord     = isSts ? ((card.metadata?.target_word as string) ?? '') : ''
  const stsSentence = card.ind_items?.ab ?? ''
  const stsLayout   = isSts ? ((card.metadata?.layout as string) ?? 'word') : 'word'

  // Card border tint based on phase
  const cardBorderColor =
    phase === 'relearn' ? '#EBD49A'
    : phase === 'new' ? '#D2D8AE'
    : T.lineSoft

  // Pending requeue count
  const pendingRequeue = queue.slice(qIdx + 1).filter(e => e.pass > 0).length

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showOptions) return
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true) }
      } else {
        if      (e.key === '1' || e.key === 'ArrowLeft')               submit('again')
        else if (e.key === '2' && showHardEasy && !isLearning)         submit('hard')
        else if (e.key === '3' || e.key === 'ArrowRight')              submit('good')
        else if ((e.key === '4' && showHardEasy) || e.key === 'ArrowUp') submit('easy')
        else if (e.key === 'ArrowDown')                                 handleSuspend()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, showHardEasy, showOptions, isLearning]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(rating: Rating) {
    lastRatedRef.current = null
    setCanUndo(false)
    const r: Rating = (isLearning && rating === 'hard') ? 'again' : rating
    const prevState = { ease_factor: card.ease_factor, interval_days: card.interval_days, repetitions: card.repetitions, due_at: card.due_at }

    if (phase === 'review') {
      if (r === 'again' && card.interval_days >= MATURE_THRESHOLD) {
        setQueue(prev => [...prev, { card, pass: 0, restarts: 0, phase: 'relearn', originalInterval: card.interval_days }])
      } else {
        await rateCard(card.id, r, state)
        completedRef.current.add(card.id)
        lastRatedRef.current = { cardId: card.id, prevState }; setCanUndo(true)
      }

    } else if (phase === 'new') {
      if (r === 'again') {
        // "Repeat"
        if (isFinalPass) {
          if (restarts >= MAX_RESTARTS) {
            // Cap reached → force Good graduation
            await rateCard(card.id, 'good', state)
            completedRef.current.add(card.id)
            lastRatedRef.current = { cardId: card.id, prevState }; setCanUndo(true)
          } else {
            // Reset to pass 0
            setQueue(prev => [...prev, { ...entry, pass: 0, restarts: restarts + 1 }])
          }
        } else {
          setQueue(prev => [...prev, { ...entry, pass: pass + 1 }])
        }
      } else {
        // "Easy" (first attempt, non-final) or "Got it!" (final / after restart)
        const useGood = isFinalPass || restarts >= 1
        await rateCard(card.id, useGood ? 'good' : 'easy', state)
        completedRef.current.add(card.id)
        lastRatedRef.current = { cardId: card.id, prevState }; setCanUndo(true)
      }

    } else { // relearn
      if (r === 'again') {
        // "Repeat"
        if (isFinalPass) {
          if (restarts >= MAX_RESTARTS) {
            await rateCard(card.id, 'again', state)
            completedRef.current.add(card.id)
            lastRatedRef.current = { cardId: card.id, prevState }; setCanUndo(true)
          } else {
            setQueue(prev => [...prev, { ...entry, pass: 0, restarts: restarts + 1 }])
          }
        } else {
          setQueue(prev => [...prev, { ...entry, pass: pass + 1 }])
        }
      } else {
        // "Got it!" — 50% recovery
        await rateCardRelearn(card.id, 'good', state, originalInterval)
        completedRef.current.add(card.id)
        lastRatedRef.current = { cardId: card.id, prevState }; setCanUndo(true)
      }
    }

    setRevealed(false)
    setShowFlagPicker(false)
    setQIdx(qi => qi + 1)
  }

  async function handleDefer() {
    await deferCard(card.id)
    lastRatedRef.current = null
    setCanUndo(false)
    setRevealed(false)
    setShowFlagPicker(false)
    setQIdx(qi => qi + 1)
  }

  async function handleUndo() {
    const last = lastRatedRef.current
    if (!last) return
    await undoRating(last.cardId, last.prevState)
    completedRef.current.delete(last.cardId)
    lastRatedRef.current = null
    setCanUndo(false)
    setRevealed(false)
    setQIdx(qi => qi - 1)
  }

  function skipCurrent() {
    setRevealed(false)
    setQIdx(qi => qi + 1)
  }

  async function handleSuspend() {
    await suspendCard(card.id)
    setShowFlagPicker(false)
    skipCurrent()
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
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStart.current.x
    const dy = e.changedTouches[0].clientY - swipeStart.current.y
    const absX = Math.abs(dx), absY = Math.abs(dy)
    if (!revealed) { if (absX < 10 && absY < 10) setRevealed(true); return }
    const THRESH = 70
    if (absX > absY && absX > THRESH) submit(dx < 0 ? 'again' : 'good')
    else if (absY > absX && absY > THRESH) { if (dy < 0) submit('easy'); else handleSuspend() }
  }

  // Rating buttons
  const RATINGS: { id: Rating; label: string; color: string }[] = [
    { id: 'again', label: 'Again', color: T.crimson },
    { id: 'hard',  label: 'Hard',  color: T.terra   },
    { id: 'good',  label: 'Good',  color: T.sage    },
    { id: 'easy',  label: 'Easy',  color: T.amber   },
  ]
  // Learning/relearn: 2 buttons only (Repeat + Easy/Got it!)
  const visibleRatings = isLearning
    ? RATINGS.filter(r => r.id === 'again' || r.id === 'easy')
    : showHardEasy ? RATINGS : RATINGS.filter(r => r.id === 'again' || r.id === 'good')

  const intervals = useMemo(() =>
    Object.fromEntries(RATINGS.map(r => [r.id, formatDays(estimateInterval(state, r.id))])),
  [card.id, card.ease_factor, card.interval_days, card.repetitions] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Context-aware button label
  function ratingLabel(id: Rating): string {
    if (phase === 'new') {
      if (id === 'again') return 'Repeat'
      const useGotIt = isFinalPass || restarts >= 1
      return useGotIt ? 'Got it!' : 'Easy'
    }
    if (phase === 'relearn') {
      return id === 'again' ? 'Repeat' : 'Got it!'
    }
    return { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }[id] ?? id
  }

  // Context-aware interval sub-label
  function intervalLabel(id: Rating): string {
    if (phase === 'new') {
      if (id === 'again') {
        if (isFinalPass) return restarts >= MAX_RESTARTS ? formatDays(estimateInterval(state, 'good')) : '↩ 0'
        return '↩'
      }
      const useGood = isFinalPass || restarts >= 1
      return formatDays(estimateInterval(state, useGood ? 'good' : 'easy'))
    }
    if (phase === 'relearn') {
      if (id === 'again') return isFinalPass ? '↩ 0' : '↩'
      return formatDays(Math.max(1, Math.floor(originalInterval * 0.5)))
    }
    return intervals[id]
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: T.cream, display: 'flex', flexDirection: 'column' }}>

      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 0', flexShrink: 0 }}>
        <button onClick={() => onExit(completedRef.current.size)} aria-label="Exit session" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lang.language}{lang.dialect ? ` · ${lang.dialect}` : ''}
          </div>
        </div>

        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, color: T.inkSoft, fontWeight: 600, letterSpacing: '0.01em', flexShrink: 0 }}>
          {qIdx + 1} / {queue.length}
        </span>

        <button onClick={handleDefer} aria-label="Defer to tomorrow" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="skip-fwd" size={15} strokeWidth={1.8} />
        </button>

        <button onClick={() => setShowOptions(true)} aria-label="Session options" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="settings" size={16} strokeWidth={1.7} />
        </button>
      </div>

      {/* Progress bar + requeue indicator */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ height: 4, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${(qIdx / Math.max(queue.length, 1)) * 100}%`, height: '100%', background: T.crimson, borderRadius: 999, transition: 'width .3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, minHeight: 16 }}>
          {canUndo ? (
            <button onClick={handleUndo} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.03em',
            }}>
              <Icon name="rotate-ccw" size={10} strokeWidth={2} color={T.inkFaint} />
              undo
            </button>
          ) : <span />}
          {pendingRequeue > 0 && (
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, letterSpacing: '0.03em' }}>
              ↩ {pendingRequeue} returning
            </span>
          )}
        </div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 16px 0', overflow: 'hidden' }}>
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => {
            if (showFlagPicker) { setShowFlagPicker(false); return }
            if (!revealed) setRevealed(true)
          }}
          style={{
            position: 'relative', background: T.paperHi, borderRadius: 22,
            border: `1px solid ${cardBorderColor}`, padding: '26px 22px', minHeight: 280,
            display: 'flex', flexDirection: 'column', cursor: revealed ? 'default' : 'pointer',
            boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
          }}
        >
          {/* Phase label */}
          <div style={{ position: 'absolute', top: 14, right: 16 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: phaseColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {phaseLabel}
            </span>
          </div>

          {/* Flag + suspend */}
          <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 2, alignItems: 'center' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowFlagPicker(p => !p)} aria-label="Set flag" style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: currentFlagHex ?? T.inkFaint,
            }}>
              <Icon name={currentFlag ? 'bookmarkF' : 'bookmark'} size={15} strokeWidth={1.8} />
            </button>
            <button onClick={handleSuspend} aria-label="Suspend card" style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkFaint,
            }}>
              <Icon name="archive" size={15} strokeWidth={1.8} />
            </button>
            {showFlagPicker && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingLeft: 4 }}>
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

          {/* Swipe affordances */}
          {!revealed && (
            <>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.crimson, opacity: 0.5 }}>
                <Icon name="arrow-l" size={17} strokeWidth={2} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>again</span>
              </div>
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.sage, opacity: 0.55 }}>
                <Icon name="arrow-r" size={17} strokeWidth={2} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl' }}>good</span>
              </div>
            </>
          )}

          {/* Front */}
          <div style={{ flex: revealed ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
            {audioMode && cardAudio(card) ? (
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
            ) : isSts && stsLayout === 'sentence' ? (
              /* STS sentence layout — full sentence with target highlighted */
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.5 }}>
                {renderHighlighted(stsSentence, stsWord)}
              </div>
            ) : isSts ? (
              /* STS word layout — target word + blurred sentence hint */
              <>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.22 }}>
                  {stsWord}
                </div>
                {!revealed && stsSentence && (
                  <div style={{ marginTop: 12, fontSize: 13, color: T.inkSoft, lineHeight: 1.5, maxWidth: 260, filter: 'blur(3px)', opacity: 0.5, userSelect: 'none', pointerEvents: 'none' }}>
                    {stsSentence}
                  </div>
                )}
              </>
            ) : (
              /* Default layout */
              <>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.22 }}>
                  {card.ind_items?.ab}
                </div>
                {audioMode && (
                  <span style={{ marginTop: 10, fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint }}>
                    ♪ no audio
                  </span>
                )}
                {!audioMode && cardAudio(card) && (
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

          {/* Answer */}
          {revealed ? (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 1, background: T.lineSoft }} />
              <div style={{ textAlign: 'center' }}>
                {isSts && stsLayout === 'word' && stsSentence && (
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
                    {renderHighlighted(stsSentence, stsWord)}
                  </div>
                )}
                {audioMode && !isSts && (
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.inkSoft, letterSpacing: '-0.01em', marginBottom: 6 }}>
                    {card.ind_items?.ab}
                  </div>
                )}
                <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {card.ind_items?.zh ?? '—'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 'auto', paddingTop: 22, textAlign: 'center' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                tap to reveal
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pass dots (learning / relearn only) */}
      {phase !== 'review' && (
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 7, padding: '10px 0 0' }}>
          {Array.from({ length: learningSteps }).map((_, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: 999,
              background: i <= pass ? phaseColor : 'transparent',
              border: `1.5px solid ${i <= pass ? phaseColor : T.line}`,
              transition: 'all .2s',
            }} />
          ))}
        </div>
      )}

      {/* Rating row */}
      <div style={{ padding: '16px 16px 32px', flexShrink: 0 }}>
        {revealed && showButtons ? (
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
                <span style={{ fontSize: 13.5 }}>{ratingLabel(r.id)}</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, opacity: 0.75, fontWeight: 500 }}>{intervalLabel(r.id)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Options sheet */}
      {showOptions && (
        <OptionsSheet
          showHardEasy={showHardEasy}       setShowHardEasy={setShowHardEasy}
          showButtons={showButtons}         setShowButtons={setShowButtons}
          learningSteps={learningSteps}     setLearningSteps={setLearningSteps}
          audioMode={audioMode}             setAudioMode={setAudioMode}
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

function ReviewEnd({
  sessionCount,
  goalMet,
  streak,
  onReviewMore,
  onDone,
}: {
  sessionCount: number
  goalMet: boolean
  streak: number
  onReviewMore: () => void
  onDone: () => void
}) {
  const [dueTomorrow, setDueTomorrow] = useState<number | null>(null)

  useEffect(() => {
    countDueTomorrow().then(setDueTomorrow)
  }, [])

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

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px', position: 'relative', zIndex: 2 }}>
        {goalMet && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: '#4A7320', background: T.sageBg, border: '1px solid #D2D8AE',
            padding: '6px 13px', borderRadius: 999, marginBottom: 22,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="check" size={13} color="#4A7320" strokeWidth={2.6} /> Daily goal met
          </span>
        )}

        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 92, fontWeight: 600, color: T.ink, letterSpacing: '-0.04em', lineHeight: 0.9 }}>
          {sessionCount}
        </div>
        <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 8, fontWeight: 500 }}>
          cards reviewed
        </div>

        {dueTomorrow !== null && (
          <div style={{
            marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 16px', borderRadius: 14, background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="card" size={16} color={T.amber} strokeWidth={1.8} />
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.02em' }}>
              {dueTomorrow}
            </span>
            <span style={{ fontSize: 13, color: T.inkSoft }}>due tomorrow</span>
          </div>
        )}

        {!goalMet && dueTomorrow !== null && dueTomorrow < 5 && (
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-start', gap: 7, maxWidth: 280, fontSize: 12, color: T.inkMute, lineHeight: 1.5, textAlign: 'left' }}>
            <Icon name="capture" size={14} color={T.sage} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Capture more words today to keep your streak growing tomorrow.</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '0 16px 40px', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={handleShare} style={{
          width: '100%', height: 46, borderRadius: 13, background: T.paperHi, color: T.ink,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
        }}>
          <Icon name="share" size={16} strokeWidth={1.9} /> Share progress
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onReviewMore} style={{
            flex: 1, height: 52, borderRadius: 14, background: T.paperHi, color: T.ink,
            border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
          }}>
            <Icon name="review" size={15} strokeWidth={2} /> Review more
          </button>
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

export default function ReviewPage() {
  const { lang, dialectLabel } = useLang()
  const searchParams = useSearchParams()
  const flagParam    = searchParams.get('flag')    // specific color: 'red' etc
  const filterParam  = searchParams.get('filter')  // 'flagged' = any color
  const flagColor    = flagParam ?? (filterParam === 'flagged' ? 'any' : undefined)

  const [mode,    setMode]    = useState<'landing' | 'reviewing' | 'done'>('landing')
  const [cards,   setCards]   = useState<FlashcardWithItem[]>([])
  const [ctx,     setCtx]     = useState<SessionContext>({ reviewedToday: 0, dailyGoal: 20, streak: 0 })
  const [loading, setLoading] = useState(true)
  const [sessionCount, setSessionCount] = useState(0)
  const [sessionKey,   setSessionKey]   = useState(0)

  function getExcludeLangs(): string[] {
    if (localStorage.getItem('srs_show_all_langs') === 'false') {
      try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch {}
    }
    return []
  }

  async function reload() {
    await ensureFlashcards()
    const exclude = await getExcludeFromReview()
    const [c, context] = await Promise.all([
      listDueFlashcards({
        flagColor,
        excludeLangs:        getExcludeLangs(),
        excludeCollections:  exclude.collections,
        excludeCaptures:     exclude.captures,
      }),
      loadSessionContext(),
    ])
    setCards(c)
    setCtx(context)
    setLoading(false)
  }

  async function handleReloadNeeded() {
    await reload()
    setSessionKey(k => k + 1)
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSessionExit(reviewed: number) {
    setSessionCount(reviewed)
    if (reviewed > 0) {
      setMode('done')
    } else {
      setMode('landing')
    }
    reload()
  }

  function handleReviewMore() {
    setMode(cards.length > 0 ? 'reviewing' : 'landing')
  }

  const goalMet = ctx.reviewedToday + sessionCount >= ctx.dailyGoal

  // Full-screen overlays (reviewing + done)
  if (mode === 'reviewing' && cards.length > 0) {
    return <ReviewSession key={sessionKey} cards={cards} ctx={ctx} onExit={handleSessionExit} onReloadNeeded={handleReloadNeeded} />
  }

  if (mode === 'done') {
    return <ReviewEnd sessionCount={sessionCount} goalMet={goalMet} streak={ctx.streak} onReviewMore={handleReviewMore} onDone={() => setMode('landing')} />
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
