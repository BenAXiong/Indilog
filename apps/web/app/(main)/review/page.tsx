'use client'

import { Suspense } from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { useLang } from '@/lib/context/LangDialectProvider'
import {
  ensureFlashcards, listDueFlashcards, countDueFlashcards, getExcludeFromReview,
  rateCard, rateCardRelearn, flushReviewEvents, cardMeta, cardAudio,
  suspendCard, unsuspendCard, setFlagColor, deferCard, setDueAt, undoRating, undoDefer, localDateStr, getStudyDate,
  type FlashcardWithItem, type Rating, type ListDueOpts, type PendingReviewEvent,
} from '@/lib/db/srs/flashcards'
import { getLangName, getGlid } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'
import { estimateInterval, formatDays, computeMasteryGrade, type SMState } from '@/lib/db/srs/schedule'
import { createClient } from '@/lib/supabase/client'
import { patchPreferences } from '@/lib/db/profile/preferences'
import { updateItem } from '@/lib/db/notebook/items'
import { listPriorityDecks, matchesPriorityDeck, NOTE_SOURCE_LABELS, type PriorityDeck } from '@/lib/db/srs/priority'
import { CardBack, resolveEffectiveMode } from '@/components/study/CardContent'
import { LangFilterSection, SessionToggle } from '@/components/study/LangFilterSection'
import { ReviewModeSelector } from '@/components/study/ReviewModeSelector'
import { SessionOptionsSheet } from '@/components/study/SessionOptionsSheet'
import { EditCardSheet, type EditCardPatch } from '@/components/study/EditCardSheet'
import { GradeBadge } from '@/components/study/GradeBadge'
import { SessionCard } from '@/components/study/SessionCard'
import { ReviewEnd } from '@/components/study/ReviewEnd'
import { useEnteringAnimation } from '@/lib/hooks/useEnteringAnimation'
import { useSwipeGesture } from '@/lib/hooks/useSwipeGesture'
import { useAudioPlayer } from '@/lib/hooks/useAudioPlayer'
import { useUndoStack } from '@/lib/hooks/useUndoStack'
import PerfMark from '@/components/perf/PerfMark'
import { recordManual } from '@/lib/perf/flow'
import { getSessionUser } from '@/lib/supabase/session'

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionContext = {
  reviewedToday:  number
  reviewTarget:   number
  prefReviewTarget: number
  streak:         number
  priorityDecks:  PriorityDeck[]
  reviewMoreSize: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardSMState(card: FlashcardWithItem): SMState {
  return { ease_factor: card.ease_factor, interval_days: card.interval_days, repetitions: card.repetitions }
}

async function loadSessionContext(): Promise<SessionContext> {
  const supabase = createClient()
  const user = await getSessionUser()
  if (!user) return { reviewedToday: 0, reviewTarget: 100, prefReviewTarget: 100, streak: 0, priorityDecks: [], reviewMoreSize: null }

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
  const prefReviewTarget = typeof prefs?.review_target === 'number' ? prefs.review_target : 100
  const reviewMoreSize = typeof prefs?.review_more_size === 'number' ? prefs.review_more_size : null
  if (typeof window !== 'undefined') localStorage.setItem('srs_review_target', String(prefReviewTarget))

  return {
    reviewedToday:         todayRes.data?.reviewed_count ?? 0,
    reviewTarget:          todayRes.data?.review_target ?? prefReviewTarget,
    prefReviewTarget,
    streak,
    priorityDecks,
    reviewMoreSize,
  }
}

// ─── OptionsSheet ─────────────────────────────────────────────────────────────

function OptionsSheet({
  showHardEasy, setShowHardEasy,
  showButtons, setShowButtons,
  prefReviewTarget, setPrefReviewTarget,
  reviewMode, setReviewMode,
  shuffleNew, setShuffleNew,
  showAllLangs, setShowAllLangs,
  excludedLangs, setExcludedLangs,
  onReloadNeeded,
  onClose,
}: {
  showHardEasy: boolean; setShowHardEasy: (v: boolean) => void
  showButtons:  boolean; setShowButtons:  (v: boolean) => void
  prefReviewTarget: number; setPrefReviewTarget: (v: number) => void
  reviewMode:   string;  setReviewMode:   (v: string) => void
  shuffleNew:   boolean; setShuffleNew:   (v: boolean) => void
  showAllLangs:  boolean; setShowAllLangs:  (v: boolean) => void
  excludedLangs: string[]; setExcludedLangs: (v: string[]) => void
  onReloadNeeded: () => void
  onClose: () => void
}) {
  return (
    <SessionOptionsSheet onClose={onClose}>
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, margin: '0 14px', overflow: 'hidden' }}>
        <ReviewModeSelector value={reviewMode} onChange={setReviewMode} />
        <SessionToggle label="Rating buttons" sub="Off = gesture-only grading" on={showButtons} onToggle={() => setShowButtons(!showButtons)} />
        <SessionToggle label="Hard + Easy" sub="Show all four grades, not just two" on={showHardEasy} onToggle={() => setShowHardEasy(!showHardEasy)} />
        <SessionToggle label="Shuffle new cards" sub="Randomise order within each deck level" on={shuffleNew} onToggle={() => { setShuffleNew(!shuffleNew); onReloadNeeded() }} />

        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.7 }}>
            ← Again · → Good · ↑ Easy · ↓ Suspend
          </div>
        </div>
      </div>

      {/* Language filter */}
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, margin: '10px 14px 0', overflow: 'hidden' }}>
        <LangFilterSection
          showAllLangs={showAllLangs}    setShowAllLangs={setShowAllLangs}
          excludedLangs={excludedLangs}  setExcludedLangs={setExcludedLangs}
          onReloadNeeded={onReloadNeeded}
          showAccumulateNote
        />
      </div>
    </SessionOptionsSheet>
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
  | { type: 'again';   cardId: string; insertedAt: number; lapsedInterval: number; prevDueAt: string | null }
  | { type: 'defer';   cardId: string; prevDueAt: string | null }
  | { type: 'suspend'; cardId: string; appendedOverflow: FlashcardWithItem | null; appendedAt: number | null }

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
  const [showEdit,       setShowEdit]      = useState(false)
  const [showHardEasy,   setShowHardEasyRaw] = useState(true)
  const [showButtons,    setShowButtonsRaw]  = useState(true)
  const [cardFlags,      setCardFlags]     = useState<Record<string, string | null>>({})
  const [showFlagPicker, setShowFlagPicker] = useState(false)
  const [prefReviewTarget, setPrefReviewTargetRaw] = useState(100)
  const [reviewMode,     setReviewModeRaw]  = useState('forward')
  const [shuffleNew,     setShuffleNewRaw]  = useState(false)
  const [showAllLangs,   setShowAllLangsRaw] = useState(true)
  const [excludedLangs,  setExcludedLangsRaw] = useState<string[]>([])
  const { playAudio, pauseAudio } = useAudioPlayer()
  const { push: pushUndo, pop: popUndo, count: undoCount } = useUndoStack<UndoEntry>()
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
  const entering = useEnteringAnimation(qIdx)

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
    getSessionUser().then((user) => {
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
  useEffect(() => { pauseAudio(); setShowKebab(false); setShowInspect(false); pendingRef.current = false }, [qIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autoplay in audio mode when card changes
  useEffect(() => {
    if (reviewMode !== 'audio') return
    const e = queue[qIdx]
    if (!e) return
    const url = cardAudio(e.card)
    if (url) playAudio(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, reviewMode])

  useEffect(() => {
    setShowHardEasyRaw(localStorage.getItem('srs_show_hard_easy') !== 'false')
    setShowButtonsRaw(localStorage.getItem('srs_show_buttons') !== 'false')
    const cap = parseInt(localStorage.getItem('srs_review_target') ?? '100')
    setPrefReviewTargetRaw(isNaN(cap) ? 100 : Math.min(300, Math.max(1,cap)))
    setReviewModeRaw(localStorage.getItem('srs_review_mode') ?? 'forward')
    setShuffleNewRaw(localStorage.getItem('srs_shuffle_new') === 'true')
    setShowAllLangsRaw(localStorage.getItem('srs_show_all_langs') !== 'false')
    try { setExcludedLangsRaw(JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]')) } catch {}
  }, [])

  function setShuffleNew(v: boolean)   { setShuffleNewRaw(v);   localStorage.setItem('srs_shuffle_new',    String(v)); patchPreferences({ shuffle_new: v }) }
  function setShowHardEasy(v: boolean) { setShowHardEasyRaw(v); localStorage.setItem('srs_show_hard_easy', String(v)); patchPreferences({ show_hard_easy: v }) }
  function setShowButtons(v: boolean)  { setShowButtonsRaw(v);  localStorage.setItem('srs_show_buttons',   String(v)); patchPreferences({ show_buttons: v }) }
  function setPrefReviewTarget(v: number) {
    const n = Math.min(999, Math.max(5, v))
    setPrefReviewTargetRaw(n); localStorage.setItem('srs_review_target', String(n)); patchPreferences({ review_target: n })
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
  const dialLabel = lang.dialect ? shortDialectLabel(lang.dialect, getGlid(lang.language) ?? '') : null
  const deckName = (() => {
    const deck = ctx.priorityDecks.find(d => matchesPriorityDeck(d, card.ind_items?.collection_id, card.ind_items?.note_source, card.ind_items?.level, card.ind_items?.lesson, card.ind_items?.language, card.ind_items?.dialect, card.ind_items?.tags))
    if (!deck) return null
    if (deck.filter_config?.label) return deck.filter_config.label
    if (deck.note_source) return NOTE_SOURCE_LABELS[deck.note_source] ?? null
    return card.ind_items?.ind_learn_collections?.name ?? null
  })()

  const targetWord  = card.ind_items?.target_word ?? null
  const hasZh       = !!(card.ind_items?.zh)
  const hasAudio    = !!cardAudio(card)
  const effectiveMode = resolveEffectiveMode(reviewMode, targetWord, hasZh, hasAudio)  // DEC-SRS06

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
      // Any Again: buffer event + requeue at end; write due_at=now+10min so card is genuinely
      // not available for 10 min if the session ends before it resurfaces.
      // Preserve original pre-lapse interval across retries.
      gradeHistoryRef.current.set(card.id, [...(gradeHistoryRef.current.get(card.id) ?? []), 'again'])
      const lapsedInterval = entry.lapsedInterval ?? card.interval_days ?? 1
      const prevDueAt = card.due_at ?? null
      pendingEventsRef.current.push({
        flashcard_id: card.id, rating: 'again',
        due_at: card.due_at ?? null, mode: effectiveMode,
        phase: 'review_requeue', reviewed_at: new Date().toISOString(),
      })
      const insertedAt = queueRef.current.length
      updateQueue(q => [...q, { card, lapsedInterval }])
      pushUndo({ type: 'again', cardId: card.id, insertedAt, lapsedInterval, prevDueAt })
      await Promise.all([
        setDueAt(card.id, new Date(Date.now() + 600_000).toISOString()),
        new Promise<void>(r => setTimeout(r, ANIM_MS)),
      ])
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
      await undoDefer(top.cardId, top.prevDueAt)
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

  async function handleEditSave(patch: EditCardPatch) {
    await updateItem(card.note_id, { ab: patch.ab || undefined, zh: patch.zh || undefined })
    updateQueue(q => q.map((e, i) => i !== qIdx || !e.card.ind_items ? e : {
      ...e,
      card: { ...e.card, ind_items: { ...e.card.ind_items, ab: patch.ab, zh: patch.zh || null } },
    }))
    setShowEdit(false)
  }

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture({
    flying:    !!gradingFly,
    setDrag,
    revealed,
    onEasy:    () => submit('easy'),
    onSuspend: handleSuspend,
    onAgain:   () => submit('again'),
    onGood:    () => submit('good'),
    onReveal:  () => setRevealed(true),
  })

  const visibleRatings = showHardEasy ? RATINGS : RATINGS.filter(r => r.id === 'again' || r.id === 'good')

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
            {getLangName(lang.language)}{dialLabel ? ` · ${dialLabel}` : ''}
          </div>
          {deckName && (
            <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {deckName}
            </div>
          )}
        </div>

        <button onClick={() => setShowEdit(true)} aria-label="Edit card" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="pen" size={15} strokeWidth={1.7} />
        </button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, minHeight: 20 }}>
          {/* Left: maturity pill */}
          <GradeBadge card={card} />
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

        <SessionCard
          card={card}
          effectiveMode={effectiveMode}
          targetWord={targetWord}
          playAudio={playAudio}
          drag={drag}
          gradingFly={gradingFly}
          entering={entering}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => {
            if (showFlagPicker) { setShowFlagPicker(false); return }
            if (!revealed) setRevealed(true)
          }}
          cursor={revealed ? 'default' : 'pointer'}
          horizontalLabels={
            revealed
              ? { left: { color: T.crimson, label: 'AGAIN' }, right: { color: T.sage, label: 'GOOD' } }
              : null
          }
          showSideHints={revealed}
          cardFlags={cardFlags}
          onSuspend={handleSuspend}
          showFlagPicker={showFlagPicker}
          onFlagToggle={() => setShowFlagPicker(p => !p)}
          onFlagSelect={handleSetFlag}
          backContent={
            revealed
              ? <CardBack card={card} effectiveMode={effectiveMode} showZhAfterAudio />
              : <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>tap to reveal</span>
          }
        />

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
      {showEdit && (
        <EditCardSheet card={card} onSave={handleEditSave} onClose={() => setShowEdit(false)} />
      )}
      {showOptions && (
        <OptionsSheet
          showHardEasy={showHardEasy}       setShowHardEasy={setShowHardEasy}
          showButtons={showButtons}         setShowButtons={setShowButtons}
          prefReviewTarget={prefReviewTarget} setPrefReviewTarget={setPrefReviewTarget}
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
  const customNoteSource = searchParams.get('noteSource') ?? undefined
  const customNoteType   = searchParams.get('noteType') ?? undefined
  const customTagsRaw    = searchParams.get('tags')
  const customTags       = customTagsRaw ? customTagsRaw.split(',').filter(Boolean) : undefined
  const customFlagRaw    = searchParams.get('flag') ?? ''
  const customFlagColors = customFlagRaw ? customFlagRaw.split(',').filter(Boolean) : undefined
  const customPlaceHeard = searchParams.get('placeHeard') ?? undefined
  const customDueOnly      = searchParams.get('dueOnly') !== 'false'
  const customIncludeUnseen = searchParams.get('includeUnseen') === 'true'

  const isAdvance    = searchParams.get('advance') === '1'
  const autostart    = searchParams.get('start') === '1' && !isCustom
  const reviewNParam = (() => { const v = parseInt(searchParams.get('n') ?? '', 10); return Number.isFinite(v) && v > 0 ? v : null })()

  const [mode,     setMode]     = useState<'landing' | 'reviewing' | 'done'>('landing')
  const [cards,    setCards]    = useState<FlashcardWithItem[]>([])
  const [overflow, setOverflow] = useState<FlashcardWithItem[]>([])
  const [ctx,     setCtx]     = useState<SessionContext>({ reviewedToday: 0, reviewTarget: 100, prefReviewTarget: 100, streak: 0, priorityDecks: [], reviewMoreSize: null })
  const [loading, setLoading] = useState(true)
  // S11c two-phase load: landing paints from sessionN (fast count) while the
  // full queue downloads; Begin waits on queueReady if tapped early
  const [sessionN,   setSessionN]   = useState<number | null>(null)
  const [queueReady, setQueueReady] = useState(false)
  const [starting,   setStarting]   = useState(false)
  const startPendingRef = useRef(false)
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
    // Two-phase load (perf S11c): a cheap count + context paint the landing fast;
    // the full queue (incl. overflow buffer, DEC-M5-01) keeps downloading in the
    // background — Begin/autostart wait on it. Backfill stays concurrent (S11b):
    // it only creates repetitions=0 cards, which Review sessions never load.
    setLoading(true)
    setQueueReady(false)
    const t0 = performance.now()
    ensureFlashcards()

    const optsP: Promise<ListDueOpts> = (async () => {
      if (isCustom) return {
        includeFlagColors:   customFlagColors,
        includePlaceHeard:   customPlaceHeard,
        includeLangs:        customLang ? [customLang] : undefined,
        includeDialect:      customDialect,
        includeCollectionId: customCollection,
        capturesOnly:        customCaptures,
        includeNoteSource:   customNoteSource,
        includeUnseen:       customIncludeUnseen || undefined,
        includeNoteTypes:    customNoteType ? [customNoteType] : undefined,
        includeTags:         customTags,
        dueOnly:             customDueOnly,
      }
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
      return opts
    })()

    const queueP = optsP.then(o => listDueFlashcards(o))

    // Fast phase — landing paints from count + context
    const [count, context] = await Promise.all([
      optsP.then(o => countDueFlashcards(o)),
      loadSessionContext(),
    ])
    const reviewMoreN = context.reviewMoreSize ?? Math.max(20, Math.round(context.reviewTarget / 50) * 5)
    const capFor = (len: number) => reviewNParam !== null ? Math.min(len, reviewNParam)
      : isCustom || isAdvance ? len
      : isMore         ? reviewMoreN
      : Math.max(0, context.reviewTarget - context.reviewedToday)
    setCtx(context)
    setSessionN(Math.min(count, capFor(count)))
    setLoading(false)

    // Slow phase — full queue; reconciles N and unblocks Begin
    const c = await queueP

    // Priority sort: deck 1 first, then deck 2, …, then non-priority. Stable — preserves due_at order within each group.
    if (!isCustom && context.priorityDecks.length > 0) {
      const priorityIdx = (x: FlashcardWithItem) => {
        const colId    = x.ind_items?.collection_id
        const src      = x.ind_items?.note_source
        const level    = x.ind_items?.level
        const lesson   = x.ind_items?.lesson
        const language = x.ind_items?.language
        const dialect  = x.ind_items?.dialect
        const tags     = x.ind_items?.tags
        const i = context.priorityDecks.findIndex(d => matchesPriorityDeck(d, colId, src, level, lesson, language, dialect, tags))
        return i === -1 ? Infinity : i
      }
      c.sort((a, b) => priorityIdx(a) - priorityIdx(b))
    }

    const sessionCap   = capFor(c.length)
    const sessionCards = c.slice(0, sessionCap)
    setCards(sessionCards)
    setOverflow(isCustom ? [] : c.slice(sessionCap))
    setSessionN(sessionCards.length)
    setQueueReady(true)
    recordManual('review-queue-ready', performance.now() - t0, { n: sessionCards.length })

    const shouldStart = (autostart && !autostartedRef.current) || startPendingRef.current
    startPendingRef.current = false
    setStarting(false)
    if (shouldStart && sessionCards.length > 0) {
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
      excludeLangs:       ctx.priorityDecks.length === 0 && localStorage.getItem('srs_show_all_langs') !== 'false'
        ? [] : JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]'),
      excludeCollections: exclude.collections,
      excludeCaptures:    exclude.captures,
    })
    if (ctx.priorityDecks.length > 0) {
      const priorityIdx = (x: FlashcardWithItem) => {
        const colId    = x.ind_items?.collection_id
        const src      = x.ind_items?.note_source
        const level    = x.ind_items?.level
        const lesson   = x.ind_items?.lesson
        const language = x.ind_items?.language
        const dialect  = x.ind_items?.dialect
        const tags     = x.ind_items?.tags
        const i = ctx.priorityDecks.findIndex(d => matchesPriorityDeck(d, colId, src, level, lesson, language, dialect, tags))
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
      <PerfMark flow="review-landing" when={!loading} meta={{ n: sessionN ?? 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <Link href={
          !isCustom ? '/' :
          customCollection ? '/study?tab=collections' :
          (customCaptures || (customNoteSource && customNoteSource !== 'curriculum')) ? '/study?tab=captures' :
          '/study'
        } style={{
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
      ) : (sessionN ?? 0) > 0 ? (
        <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 20, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 48, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {sessionN}
            </span>
            <span style={{ fontSize: 15, color: T.inkSoft }}>{sessionN === 1 ? 'card' : 'cards'} due</span>
          </div>
          <div style={{ fontSize: 13, color: T.inkMute }}>~{Math.ceil((sessionN ?? 0) * 0.5)} min</div>
          <button
            onClick={() => {
              if (queueReady) { setMode('reviewing'); return }
              startPendingRef.current = true
              setStarting(true)
            }}
            disabled={starting}
            style={{
              height: 56, borderRadius: 15, background: T.crimson, color: '#fff',
              border: 'none', fontSize: 17, fontWeight: 600, cursor: starting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: starting ? 0.75 : 1,
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2), 0 8px 18px rgba(120,30,15,0.18)',
            }}>
            <Icon name="play" size={15} color="#fff" />
            {starting ? 'Preparing…' : 'Begin session'}
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
