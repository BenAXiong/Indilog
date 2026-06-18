'use client'

import { Suspense } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { useLang } from '@/lib/context/LangDialectProvider'
import {
  listLearnFlashcards, graduateLearnCard, suspendCard, unsuspendCard, setFlagColor, cardMeta, cardAudio,
  flushReviewEvents, getStudyDate, undoGraduateLearnCard,
  type FlashcardWithItem, type PendingReviewEvent,
} from '@/lib/db/srs/flashcards'
import { patchPreferences } from '@/lib/db/profile/preferences'
import { getLangName } from '@/lib/lang/lang-bridge'
import { createClient } from '@/lib/supabase/client'
import { listPriorityDecks } from '@/lib/db/srs/priority'
import { CardBack, resolveEffectiveMode } from '@/components/study/CardContent'
import { LangFilterSection, SessionToggle } from '@/components/study/LangFilterSection'
import { ReviewModeSelector } from '@/components/study/ReviewModeSelector'
import { SessionOptionsSheet } from '@/components/study/SessionOptionsSheet'
import { SessionCard } from '@/components/study/SessionCard'
import { LearnEnd } from '@/components/study/LearnEnd'
import { useEnteringAnimation } from '@/lib/hooks/useEnteringAnimation'
import { useSwipeGesture } from '@/lib/hooks/useSwipeGesture'
import { useAudioPlayer } from '@/lib/hooks/useAudioPlayer'
import { useUndoStack } from '@/lib/hooks/useUndoStack'

// ─── Types ────────────────────────────────────────────────────────────────────

type LearnEntry = {
  card:         FlashcardWithItem
  exposureDone: boolean
  goodCount:    number   // consecutive goods: 0 or 1; 2 = graduation
}

type LearnContext = {
  learnedToday:          number
  learnTarget:           number
  priorityCollectionIds: string[]
}

type LearnUndoEntry =
  | { type: 'graduate'; cardId: string; prevState: { ease_factor: number; interval_days: number; repetitions: number; due_at: string | null } }
  | { type: 'good1';    cardId: string; insertedAt: number }
  | { type: 'again';    cardId: string; insertedAt: number }
  | { type: 'suspend';  cardId: string; appendedOverflow: FlashcardWithItem | null; appendedAt: number | null }

// ─── Context loader ───────────────────────────────────────────────────────────

async function loadLearnContext(): Promise<LearnContext> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { learnedToday: 0, learnTarget: 10, priorityCollectionIds: [] }

  const today = getStudyDate()
  const [profileRes, statsRes, priorityDecks] = await Promise.all([
    supabase.from('ind_profiles').select('preferences').eq('user_id', user.id).maybeSingle(),
    supabase.from('ind_daily_stats').select('learned_count, learn_target').eq('user_id', user.id).eq('date', today).maybeSingle(),
    listPriorityDecks(user.id),
  ])

  const prefs      = profileRes.data?.preferences as Record<string, unknown> | null
  const prefLearnTarget = typeof prefs?.learn_target === 'number' ? prefs.learn_target : 10

  // Use frozen learn_target from ind_daily_stats when available (set by dashboard on first load).
  // Fall back to live simulation rate, or bare pref cap when no sim is active.
  const frozenLearnTarget = (statsRes.data as Record<string, unknown> | null)?.learn_target as number | null ?? null
  let learnTarget = frozenLearnTarget ?? prefLearnTarget
  if (frozenLearnTarget === null) {
    const simDecks = priorityDecks.filter(d => d.in_simulation && d.simulation_deadline)
    if (simDecks.length > 0) {
      const deadline = simDecks.reduce(
        (min, d) => (d.simulation_deadline! < min ? d.simulation_deadline! : min),
        simDecks[0].simulation_deadline!,
      )
      const daysLeft = Math.max(1, Math.ceil(
        (new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000,
      ))
      const { count: newCards } = await supabase
        .from('ind_flashcards')
        .select('id, ind_items!inner(collection_id)', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('ind_items.collection_id', simDecks.map(d => d.collection_id))
        .eq('repetitions', 0)
        .is('suspended_at', null)
      const effectiveWindow = Math.max(1, daysLeft - 21)
      learnTarget = Math.max(1, Math.ceil((newCards ?? 0) / effectiveWindow))
    }
  }

  return {
    learnedToday:          (statsRes.data as Record<string, unknown> | null)?.learned_count as number ?? 0,
    learnTarget,
    priorityCollectionIds: priorityDecks.map(d => d.collection_id),
  }
}

// ─── LearnOptionsSheet ───────────────────────────────────────────────────────

function LearnOptionsSheet({
  reviewMode, setReviewMode,
  shuffleTests, setShuffleTests,
  shuffleExposure, setShuffleExposure,
  showAllLangs, setShowAllLangs,
  excludedLangs, setExcludedLangs,
  onReloadNeeded,
  onClose,
}: {
  reviewMode:      string;   setReviewMode:      (v: string) => void
  shuffleTests:    boolean;  setShuffleTests:    (v: boolean) => void
  shuffleExposure: boolean;  setShuffleExposure: (v: boolean) => void
  showAllLangs:    boolean;  setShowAllLangs:    (v: boolean) => void
  excludedLangs:   string[]; setExcludedLangs:   (v: string[]) => void
  onReloadNeeded: () => void
  onClose: () => void
}) {
  return (
    <SessionOptionsSheet onClose={onClose}>
      <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, margin: '0 14px', overflow: 'hidden' }}>
        <ReviewModeSelector value={reviewMode} onChange={setReviewMode} />
        <SessionToggle
          label="Shuffle tests"
          sub="Randomize test phase order"
          on={shuffleTests}
          onToggle={() => { const v = !shuffleTests; setShuffleTests(v); localStorage.setItem('srs_shuffle_tests', String(v)); patchPreferences({ shuffle_tests: v }) }}
        />
        <SessionToggle
          label="Shuffle exposure"
          sub="Randomize exposure phase order"
          on={shuffleExposure}
          onToggle={() => { const v = !shuffleExposure; setShuffleExposure(v); localStorage.setItem('srs_shuffle_exposure', String(v)); patchPreferences({ shuffle_exposure: v }); onReloadNeeded() }}
        />
        <LangFilterSection
          showAllLangs={showAllLangs}    setShowAllLangs={setShowAllLangs}
          excludedLangs={excludedLangs}  setExcludedLangs={setExcludedLangs}
          onReloadNeeded={onReloadNeeded}
        />
      </div>
    </SessionOptionsSheet>
  )
}

// ─── LearnSession ─────────────────────────────────────────────────────────────

function LearnSession({ cards, overflow: initialOverflow, ctx, onExit, onReloadNeeded }: {
  cards:    FlashcardWithItem[]
  overflow: FlashcardWithItem[]
  ctx:      LearnContext
  onExit:   (count: number) => void
  onReloadNeeded: () => void
}) {
  const [queue, setQueue] = useState<LearnEntry[]>(() => {
    const shuffleExp = localStorage.getItem('srs_shuffle_exposure') === 'true'
    const ordered = shuffleExp ? [...cards].sort(() => Math.random() - 0.5) : cards
    return ordered.map(c => ({ card: c, exposureDone: false, goodCount: 0 }))
  })
  const [qIdx,           setQIdx]           = useState(0)
  const [revealed,       setRevealed]       = useState(false)
  const [reviewMode,     setReviewModeRaw]  = useState('forward')
  const [shuffleTests,   setShuffleTestsRaw]   = useState(() => localStorage.getItem('srs_shuffle_tests') !== 'false')
  const [shuffleExposure, setShuffleExposureRaw] = useState(() => localStorage.getItem('srs_shuffle_exposure') === 'true')
  const testShuffledRef = useRef(false)
  const [showOptions,   setShowOptions]   = useState(false)
  const [showAllLangs,  setShowAllLangsRaw]  = useState(true)
  const [excludedLangs, setExcludedLangsRaw] = useState<string[]>([])
  const [overflow,      setOverflow]      = useState<FlashcardWithItem[]>(initialOverflow)
  const [showPriorityToast, setShowPriorityToast] = useState(false)
  const [cardFlags,     setCardFlags]     = useState<Record<string, string | null>>({})
  const [showFlagPicker, setShowFlagPicker] = useState(false)

  async function handleSetFlag(color: string | null) {
    await setFlagColor(card.id, color)
    setCardFlags(prev => ({ ...prev, [card.id]: color }))
    setShowFlagPicker(false)
  }
  const graduatedRef       = useRef(new Set<string>())
  const priorityToastRef   = useRef(false)
  const sessionEndFiredRef = useRef(false)
  const pendingRef         = useRef(false)   // blocks re-entrant actions during async operations
  const pendingEventsRef   = useRef<PendingReviewEvent[]>([])
  const { push: pushUndo, pop: popUndo, count: undoCount } = useUndoStack<LearnUndoEntry>()
  const [drag,       setDrag]       = useState<{ x: number; y: number } | null>(null)
  const [gradingFly, setGradingFly] = useState<{ x: number; y: number; color: string; label: string; opacity?: number } | null>(null)
  const entering = useEnteringAnimation(qIdx)
  const { playAudio, pauseAudio } = useAudioPlayer()
  const onExitRef          = useRef(onExit)
  useEffect(() => { onExitRef.current = onExit })

  useEffect(() => {
    setReviewModeRaw(localStorage.getItem('srs_review_mode') ?? 'forward')
    setShowAllLangsRaw(localStorage.getItem('srs_show_all_langs') !== 'false')
    try { setExcludedLangsRaw(JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]')) } catch {}
  }, [])

  function setReviewMode(v: string)      { setReviewModeRaw(v);    localStorage.setItem('srs_review_mode',    v); patchPreferences({ review_mode: v }) }
  function setShowAllLangs(v: boolean)   { setShowAllLangsRaw(v) }
  function setExcludedLangs(v: string[]) { setExcludedLangsRaw(v) }

  useEffect(() => { pauseAudio(); setShowFlagPicker(false); pendingRef.current = false }, [qIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Shuffle test-phase entries once, when the last exposure entry has been processed
  useEffect(() => {
    if (testShuffledRef.current || !shuffleTests) return
    const entry = queue[qIdx]
    if (!entry?.exposureDone) return
    if (queue.slice(qIdx).some(e => !e.exposureDone)) return
    testShuffledRef.current = true
    setQueue(q => {
      const before = q.slice(0, qIdx)
      const rest   = [...q.slice(qIdx)]
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[rest[i], rest[j]] = [rest[j], rest[i]]
      }
      return [...before, ...rest]
    })
  }, [qIdx, queue, shuffleTests]) // eslint-disable-line react-hooks/exhaustive-deps

  // Session end
  useEffect(() => {
    if (queue.length > 0 && qIdx >= queue.length && !sessionEndFiredRef.current) {
      sessionEndFiredRef.current = true
      flushReviewEvents(pendingEventsRef.current).then(() => {})
      pendingEventsRef.current = []
      onExitRef.current(graduatedRef.current.size)
    }
  }, [qIdx, queue.length])

  // Priority-done toast
  useEffect(() => {
    const e = queue[qIdx]
    if (!e || priorityToastRef.current) return
    if (ctx.priorityCollectionIds.length === 0) return
    if (graduatedRef.current.size === 0) return  // no cards graduated yet → still in first sweep
    const colId = e.card.ind_items?.collection_id
    if (!colId || !ctx.priorityCollectionIds.includes(colId)) {
      priorityToastRef.current = true
      setShowPriorityToast(true)
      setTimeout(() => setShowPriorityToast(false), 3500)
    }
  }, [qIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const entry = queue[qIdx]

  // Keyboard
  useEffect(() => {
    if (!entry) return
    const { exposureDone, goodCount } = entry
    function onKey(e: KeyboardEvent) {
      if (!exposureDone) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); handleExposureOK() }
        else if (e.key === 'ArrowUp')   handleGraduate('easy')
        else if (e.key === 'ArrowDown') handleSuspend()
        return
      }
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true) }
        else if (e.key === 'ArrowUp')   handleGraduate('easy')
        else if (e.key === 'ArrowDown') handleSuspend()
        return
      }
      if (e.key === '1' || e.key === 'ArrowLeft')                        handleAgain()
      else if (e.key === '3' || e.key === 'ArrowRight')                   handleGood(goodCount)
      else if (e.key === '4' || e.key === 'ArrowUp')                      handleGraduate('easy')
      else if (e.key === 'ArrowDown')                                     handleSuspend()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entry, revealed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return null

  const { card, exposureDone, goodCount } = entry
  const lang = cardMeta(card)

  const targetWord  = card.ind_items?.target_word ?? null
  const hasZh       = !!(card.ind_items?.zh)
  const hasAudio    = !!cardAudio(card)
  const effectiveMode = resolveEffectiveMode(reviewMode, targetWord, hasZh, hasAudio)
  const totalInitial   = cards.length
  const graduatedCount = graduatedRef.current.size

  // ── Actions ───────────────────────────────────────────────────────────────

  const FLY = {
    next:  { x:    0, y:  -70, color: T.sage,    label: 'NEXT', opacity: 0 },
    good:  { x:  700, y:  -80, color: T.sage,    label: 'GOOD'  },
    again: { x: -700, y:  -80, color: T.crimson, label: 'AGAIN' },
    easy:  { x:   60, y: -700, color: T.amber,   label: 'EASY'  },
    pause: { x:    0, y:  700, color: T.inkSoft,  label: 'PAUSE' },
  }

  async function handleSuspend() {
    if (pendingRef.current) return
    pendingRef.current = true
    setGradingFly(FLY.pause)
    setDrag(null)
    await Promise.all([
      suspendCard(card.id),
      new Promise<void>(r => setTimeout(r, 350)),
    ])
    setGradingFly(null)
    setRevealed(false)
    // Read overflow and queue from render scope (safe — pendingRef blocks concurrent mutations).
    let appendedOverflow: FlashcardWithItem | null = null
    let appendedAt: number | null = null
    if (overflow.length > 0) {
      const [next, ...rest] = overflow
      appendedOverflow = next
      // Compute insertAt from closure queue — find last exposure entry, insert just after it.
      // Falls back to qIdx+1 when already in test phase (no remaining exposures ahead).
      let insertAt = qIdx + 1
      for (let i = queue.length - 1; i > qIdx; i--) {
        if (!queue[i].exposureDone) { insertAt = i + 1; break }
      }
      appendedAt = insertAt
      setOverflow(rest)
      setQueue(q => [...q.slice(0, insertAt), { card: next, exposureDone: false, goodCount: 0 }, ...q.slice(insertAt)])
    }
    pushUndo({ type: 'suspend', cardId: card.id, appendedOverflow, appendedAt })
    setQIdx(qi => qi + 1)
  }

  function handleExposureOK() {
    if (pendingRef.current) return
    pendingRef.current = true
    setGradingFly(FLY.next)
    setDrag(null)
    setQueue(prev => [...prev, { card, exposureDone: true, goodCount: 0 }])
    setTimeout(() => { setGradingFly(null); setRevealed(false); setQIdx(qi => qi + 1) }, 350)
  }

  async function handleGraduate(type: 'good' | 'easy') {
    if (pendingRef.current) return
    pendingRef.current = true
    setGradingFly(type === 'easy' ? FLY.easy : FLY.good)
    setDrag(null)
    const prevState = { ease_factor: card.ease_factor, interval_days: card.interval_days, repetitions: card.repetitions, due_at: card.due_at }
    try {
      await Promise.all([
        graduateLearnCard(card.id, type),
        new Promise<void>(r => setTimeout(r, 350)),
      ])
    } catch {
      setGradingFly(null)
      pendingRef.current = false
      return
    }
    setGradingFly(null)
    graduatedRef.current.add(card.id)
    pushUndo({ type: 'graduate', cardId: card.id, prevState })
    setRevealed(false)
    setQIdx(qi => qi + 1)
  }

  function handleAgain() {
    if (pendingRef.current) return
    pendingRef.current = true
    setGradingFly(FLY.again)
    setDrag(null)
    pendingEventsRef.current.push({
      flashcard_id: card.id, rating: 'again',
      due_at: card.due_at ?? null, mode: null,
      phase: 'learn', reviewed_at: new Date().toISOString(),
    })
    const insertedAt = queue.length
    setQueue(prev => [...prev, { card, exposureDone: true, goodCount: 0 }])
    pushUndo({ type: 'again', cardId: card.id, insertedAt })
    setTimeout(() => { setGradingFly(null); setRevealed(false); setQIdx(qi => qi + 1) }, 350)
  }

  function handleGood(currentGoodCount: number) {
    if (pendingRef.current) return
    if (currentGoodCount >= 1) {
      handleGraduate('good')  // handleGraduate sets the guard itself
    } else {
      pendingRef.current = true
      setGradingFly(FLY.good)
      setDrag(null)
      const insertedAt = queue.length
      setQueue(prev => [...prev, { card, exposureDone: true, goodCount: 1 }])
      pushUndo({ type: 'good1', cardId: card.id, insertedAt })
      setTimeout(() => { setGradingFly(null); setRevealed(false); setQIdx(qi => qi + 1) }, 350)
    }
  }

  async function handleUndo() {
    if (pendingRef.current) return
    pendingRef.current = true
    const top = popUndo()
    if (!top) { pendingRef.current = false; return }

    if (top.type === 'graduate') {
      await undoGraduateLearnCard(top.cardId, top.prevState)
      graduatedRef.current.delete(top.cardId)
      setRevealed(false)
      setQIdx(qi => qi - 1)
      return
    }

    if (top.type === 'again' || top.type === 'good1') {
      if (top.type === 'again') {
        let idx = -1
        for (let i = pendingEventsRef.current.length - 1; i >= 0; i--) {
          if (pendingEventsRef.current[i].flashcard_id === top.cardId && pendingEventsRef.current[i].rating === 'again') { idx = i; break }
        }
        if (idx !== -1) pendingEventsRef.current.splice(idx, 1)
      }
      setQueue(q => [...q.slice(0, top.insertedAt), ...q.slice(top.insertedAt + 1)])
      setRevealed(false)
      setQIdx(qi => qi - 1)
      return
    }

    if (top.type === 'suspend') {
      await unsuspendCard(top.cardId)
      if (top.appendedOverflow !== null && top.appendedAt !== null) {
        setQueue(q => [...q.slice(0, top.appendedAt!), ...q.slice(top.appendedAt! + 1)])
        setOverflow(prev => [top.appendedOverflow!, ...prev])
      }
      setRevealed(false)
      setQIdx(qi => qi - 1)
    }
  }

  // ── Touch ─────────────────────────────────────────────────────────────────

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture({
    flying:      !!gradingFly,
    setDrag,
    revealed,
    exposureDone,
    onEasy:    () => handleGraduate('easy'),
    onSuspend: handleSuspend,
    onAgain:   handleAgain,
    onGood:    () => handleGood(goodCount),
    onNext:    handleExposureOK,
  })

  const showBack = !exposureDone || (exposureDone && revealed)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: T.cream, display: 'flex', flexDirection: 'column' }}>

      {/* Priority toast */}
      {showPriorityToast && (
        <div style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: T.ink, color: '#fff', fontSize: 12.5, fontWeight: 500, borderRadius: 10, padding: '8px 14px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          Priority decks done · showing other new cards
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 0', flexShrink: 0 }}>
        <button onClick={() => { flushReviewEvents(pendingEventsRef.current).then(() => {}); pendingEventsRef.current = []; onExit(graduatedRef.current.size) }} aria-label="Exit"
          style={{ width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkSoft, flexShrink: 0, cursor: 'pointer' }}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em' }}>
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
      </div>

      {/* Progress bar */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ height: 4, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${(graduatedCount / Math.max(totalInitial, 1)) * 100}%`, height: '100%', background: T.sage, borderRadius: 999, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 5 }}>
          {undoCount > 0 && (
            <button onClick={handleUndo} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, color: T.inkSoft,
            }}>
              <Icon name="rotate-ccw" size={13} strokeWidth={2} color={T.inkSoft} />
              undo
            </button>
          )}
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>
            {graduatedCount} / {totalInitial}
          </span>
        </div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 16px 0' }}>

        {/* ↑ easy hint */}
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
            if (!exposureDone) { handleExposureOK(); return }
            if (!revealed) setRevealed(true)
          }}
          borderColor={!exposureDone ? '#D2D8AE' : T.lineSoft}
          horizontalLabels={
            !exposureDone
              ? { left: null, right: { color: T.sage, label: 'NEXT' } }
              : revealed
                ? { left: { color: T.crimson, label: 'AGAIN' }, right: { color: T.sage, label: 'GOOD' } }
                : null
          }
          showSideHints={exposureDone && revealed}
          cardFlags={cardFlags}
          onSuspend={handleSuspend}
          showFlagPicker={showFlagPicker}
          onFlagToggle={() => setShowFlagPicker(p => !p)}
          onFlagSelect={handleSetFlag}
          backContent={
            showBack
              ? <CardBack card={card} effectiveMode={effectiveMode} />
              : <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>tap to reveal</span>
          }
        />

        {/* ↓ suspend hint */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, opacity: 0.65 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: T.inkFaint }}>
            <Icon name="chev-d" size={13} strokeWidth={2} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>suspend</span>
          </div>
        </div>
      </div>

      {/* Good-count dots (test pass) */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 8, padding: '10px 0 0', opacity: exposureDone ? 1 : 0 }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: 999,
            background: i < goodCount ? T.sage : 'transparent',
            border: `1.5px solid ${i < goodCount ? T.sage : T.line}`,
            transition: 'all .2s',
          }} />
        ))}
      </div>

      {/* Action row */}
      <div style={{ padding: '16px 16px 32px', flexShrink: 0 }}>
        {!exposureDone ? (
          <button onClick={handleExposureOK} style={{
            width: '100%', height: 56, borderRadius: 15, background: T.sage, color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(80,120,30,0.2)',
          }}>
            Got it, next!
          </button>
        ) : revealed ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
            {([
              { id: 'again' as const, label: 'Again', color: T.crimson, sub: '↩' },
              { id: 'good'  as const, label: 'Good',  color: T.sage,   sub: goodCount >= 1 ? '12h' : '+1' },
              { id: 'easy'  as const, label: 'Easy',  color: T.amber,  sub: '4d' },
            ] as const).map(r => (
              <button key={r.id}
                onClick={() => r.id === 'again' ? handleAgain() : r.id === 'easy' ? handleGraduate('easy') : handleGood(goodCount)}
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
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, opacity: 0.75, fontWeight: 500 }}>{r.sub}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Options sheet */}
      {showOptions && (
        <LearnOptionsSheet
          reviewMode={reviewMode}             setReviewMode={setReviewMode}
          shuffleTests={shuffleTests}         setShuffleTests={setShuffleTestsRaw}
          shuffleExposure={shuffleExposure}   setShuffleExposure={setShuffleExposureRaw}
          showAllLangs={showAllLangs}         setShowAllLangs={setShowAllLangs}
          excludedLangs={excludedLangs}       setExcludedLangs={setExcludedLangs}
          onReloadNeeded={onReloadNeeded}
          onClose={() => setShowOptions(false)}
        />
      )}
    </div>
  )
}


// ─── Landing / wrapper ────────────────────────────────────────────────────────

function LearnPage() {
  const router       = useRouter()
  const searchParams  = useSearchParams()
  const autostart     = searchParams.get('start') === '1'
  const collectionId  = searchParams.get('collectionId') ?? undefined

  const nParam = (() => { const v = parseInt(searchParams.get('n') ?? '', 10); return Number.isFinite(v) && v > 0 ? v : null })()

  const [mode,         setMode]         = useState<'landing' | 'learning' | 'done'>('landing')
  const [cards,        setCards]        = useState<FlashcardWithItem[]>([])
  const [overflow,     setOverflow]     = useState<FlashcardWithItem[]>([])
  const [ctx,          setCtx]          = useState<LearnContext>({ learnedToday: 0, learnTarget: 10, priorityCollectionIds: [] })
  const [loading,      setLoading]      = useState(true)
  const [learnedCount, setLearnedCount] = useState(0)
  const [sessionKey,   setSessionKey]   = useState(0)
  const autostartedRef = useRef(false)

  async function reload() {
    const [allCards, context] = await Promise.all([listLearnFlashcards(collectionId ? { collectionId } : {}), loadLearnContext()])
    const excludeLangs: string[] = !collectionId && localStorage.getItem('srs_show_all_langs') === 'false'
      ? (() => { try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] } })()
      : []
    const filtered = excludeLangs.length
      ? allCards.filter(c => !excludeLangs.includes(c.ind_items?.language ?? ''))
      : allCards
    const remaining = Math.max(0, context.learnedToday >= context.learnTarget
      ? context.learnTarget
      : context.learnTarget - context.learnedToday)
    const toLearn = nParam ?? (collectionId ? filtered.length : remaining)
    const sessionCards = filtered.slice(0, toLearn)
    setCards(sessionCards)
    setOverflow(filtered.slice(toLearn))
    setCtx(context)
    setLoading(false)
    if (autostart && !autostartedRef.current && sessionCards.length > 0) {
      autostartedRef.current = true
      setMode('learning')
    }
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSessionExit(count: number) {
    setLearnedCount(count)
    if (count > 0) {
      setMode('done')
    } else if (autostart) {
      router.push('/')
      return
    } else {
      setMode('landing')
    }
    reload()
  }

  async function handleReloadNeeded() {
    await reload()
    setSessionKey(k => k + 1)
  }

  if (mode === 'learning' && cards.length > 0) {
    return <LearnSession key={sessionKey} cards={cards} overflow={overflow} ctx={ctx} onExit={handleSessionExit} onReloadNeeded={handleReloadNeeded} />
  }

  if (mode === 'done') {
    return <LearnEnd
      learnedCount={learnedCount}
      tomorrowTarget={ctx.learnTarget}
      onDone={autostart ? () => router.push('/') : () => setMode('landing')}
    />
  }

  // Landing
  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <Link href={collectionId ? '/study' : '/'} style={{ width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkSoft, textDecoration: 'none' }}>
          <Icon name="arrow-l" size={17} strokeWidth={1.8} />
        </Link>
        <h1 style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1, marginTop: 2 }}>
          Learn
        </h1>
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
            <span style={{ fontSize: 15, color: T.inkSoft }}>{cards.length === 1 ? 'new card' : 'new cards'}</span>
          </div>
          <div style={{ fontSize: 13, color: T.inkMute }}>
            ~{Math.ceil(cards.length * 1.5)} min · exposure then test passes
          </div>
          <button onClick={() => { setSessionKey(k => k + 1); setMode('learning') }} style={{
            height: 56, borderRadius: 15, background: T.sage, color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(80,120,30,0.22)',
          }}>
            <Icon name="play" size={15} color="#fff" /> Begin session
          </button>
        </div>
      ) : (
        <div style={{ padding: '32px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>No new cards</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>Add cards to a collection to start learning.</div>
        </div>
      )}
    </div>
  )
}

export default function LearnPageWithSuspense() {
  return <Suspense><LearnPage /></Suspense>
}
