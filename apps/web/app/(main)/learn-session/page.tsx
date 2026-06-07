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
  listLearnFlashcards, graduateLearnCard, suspendCard, setFlagColor, listUserLanguages, cardMeta, cardAudio,
  type FlashcardWithItem,
} from '@/lib/db/srs/flashcards'
import { FLAG_COLORS, flagColorHex } from '@/lib/db/srs/flags'
import { computeMasteryGrade } from '@/lib/db/srs/schedule'
import { patchPreferences } from '@/lib/db/profile/preferences'
import { getLangName } from '@/lib/lang/lang-bridge'
import { createClient } from '@/lib/supabase/client'
import { listPriorityDecks } from '@/lib/db/srs/priority'

// ─── Types ────────────────────────────────────────────────────────────────────

type LearnEntry = {
  card:         FlashcardWithItem
  exposureDone: boolean
  goodCount:    number   // consecutive goods: 0 or 1; 2 = graduation
}

type LearnContext = {
  learnedToday:          number
  learnCap:              number
  priorityCollectionIds: string[]
}

// ─── Context loader ───────────────────────────────────────────────────────────

function getStudyDate(): string {
  const resetHour = parseInt(localStorage.getItem('srs_reset_hour') ?? '4')
  const now = new Date()
  if (now.getHours() < resetHour) {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return now.toISOString().slice(0, 10)
}

async function loadLearnContext(): Promise<LearnContext> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { learnedToday: 0, learnCap: 10, priorityCollectionIds: [] }

  const today = getStudyDate()
  const [profileRes, statsRes, priorityDecks] = await Promise.all([
    supabase.from('ind_profiles').select('preferences').eq('user_id', user.id).maybeSingle(),
    supabase.from('ind_daily_stats').select('learned_count').eq('user_id', user.id).eq('date', today).maybeSingle(),
    listPriorityDecks(user.id),
  ])

  const prefs      = profileRes.data?.preferences as Record<string, unknown> | null
  const prefCap    = typeof prefs?.learn_cap === 'number' ? prefs.learn_cap : 10

  // When simulation is active, derive learnCap from target rate (matches dashboard CTA)
  let learnCap = prefCap
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
    learnCap = Math.max(1, Math.ceil((newCards ?? 0) / daysLeft))
  }

  return {
    learnedToday:          (statsRes.data as Record<string, unknown> | null)?.learned_count as number ?? 0,
    learnCap,
    priorityCollectionIds: priorityDecks.map(d => d.collection_id),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── LearnOptionsSheet ───────────────────────────────────────────────────────

function LearnOptionsSheet({
  reviewMode, setReviewMode,
  showAllLangs, setShowAllLangs,
  excludedLangs, setExcludedLangs,
  onReloadNeeded,
  onClose,
}: {
  reviewMode:   string;  setReviewMode:   (v: string) => void
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
    if (v) {
      setExcludedLangs([]); localStorage.setItem('srs_excluded_langs', '[]')
      patchPreferences({ show_all_langs: v, excluded_langs: [] })
    } else {
      patchPreferences({ show_all_langs: v })
    }
    onReloadNeeded()
  }

  function handleToggleLang(code: string) {
    const next = excludedLangs.includes(code)
      ? excludedLangs.filter(l => l !== code)
      : [...excludedLangs, code]
    setExcludedLangs(next)
    localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
    patchPreferences({ excluded_langs: next })
    onReloadNeeded()
  }

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

        {/* Review mode */}
        <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, margin: '0 14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.ink, fontWeight: 500 }}>Review mode</div>
              <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>How cards are presented</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['forward', 'reverse', 'audio', 'sts'] as const).map(m => (
                <button key={m} onClick={() => { setReviewMode(m); localStorage.setItem('srs_review_mode', m); patchPreferences({ review_mode: m }) }} style={{
                  padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: reviewMode === m ? T.crimsonBg : T.paper,
                  border: `1.5px solid ${reviewMode === m ? T.crimson : T.lineSoft}`,
                  color: reviewMode === m ? T.crimson : T.inkMute,
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Show all languages */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: showAllLangs ? 'none' : `1px solid ${T.lineSoft}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>Show all languages</div>
              <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 1 }}>Include all languages in this session</div>
            </div>
            <button onClick={() => handleToggleShowAll(!showAllLangs)} aria-label="Toggle show all languages" style={{
              width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: showAllLangs ? T.sage : T.line, border: 'none', cursor: 'pointer', transition: 'background .15s',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: showAllLangs ? 21 : 3, width: 20, height: 20,
                borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
              }} />
            </button>
          </div>

          {/* Language list */}
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
            </div>
          )}
        </div>
      </div>
    </>
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
  const [queue, setQueue] = useState<LearnEntry[]>(() =>
    cards.map(c => ({ card: c, exposureDone: false, goodCount: 0 }))
  )
  const [qIdx,          setQIdx]          = useState(0)
  const [revealed,      setRevealed]      = useState(false)
  const [reviewMode,    setReviewModeRaw] = useState('forward')
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
  const audioRef           = useRef<HTMLAudioElement | null>(null)
  const swipeStart         = useRef({ x: 0, y: 0 })
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

  useEffect(() => { audioRef.current?.pause(); setShowFlagPicker(false) }, [qIdx])

  // Session end
  useEffect(() => {
    if (queue.length > 0 && qIdx >= queue.length && !sessionEndFiredRef.current) {
      sessionEndFiredRef.current = true
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

  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url); audioRef.current = a
    a.play().catch(() => {})
  }

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
  const effectiveMode =
    reviewMode === 'sts'     && targetWord ? 'sts'
    : reviewMode === 'sts'   && !targetWord ? 'reverse'
    : reviewMode === 'audio' && hasAudio    ? 'audio'
    : reviewMode === 'audio' && !hasAudio   ? 'reverse'
    : reviewMode === 'reverse' && hasZh     ? 'reverse'
    : reviewMode === 'reverse' && !hasZh    ? 'forward'
    : 'forward'
  const isAudio   = effectiveMode === 'audio'
  const isReverse = effectiveMode === 'reverse'
  const isSts     = effectiveMode === 'sts'

  const totalInitial   = cards.length
  const graduatedCount = graduatedRef.current.size

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSuspend() {
    await suspendCard(card.id)
    setRevealed(false)
    // Replace the suspended card with the next overflow card (if any) to keep count stable
    setOverflow(prev => {
      if (!prev.length) return prev
      const [next, ...rest] = prev
      setQueue(q => [...q, { card: next, exposureDone: false, goodCount: 0 }])
      return rest
    })
    setQIdx(qi => qi + 1)
  }

  function handleExposureOK() {
    // Requeue at back for the test pass, then advance — all exposures come before any tests
    setQueue(prev => [...prev, { card, exposureDone: true, goodCount: 0 }])
    setRevealed(false)
    setQIdx(qi => qi + 1)
  }

  async function handleGraduate(type: 'good' | 'easy') {
    await graduateLearnCard(card.id, type)
    graduatedRef.current.add(card.id)
    setRevealed(false)
    setQIdx(qi => qi + 1)
  }

  function handleAgain() {
    setQueue(prev => [...prev, { card, exposureDone: true, goodCount: 0 }])
    setRevealed(false)
    setQIdx(qi => qi + 1)
  }

  function handleGood(currentGoodCount: number) {
    if (currentGoodCount >= 1) {
      handleGraduate('good')
    } else {
      setQueue(prev => [...prev, { card, exposureDone: true, goodCount: 1 }])
      setRevealed(false)
      setQIdx(qi => qi + 1)
    }
  }

  // ── Touch ─────────────────────────────────────────────────────────────────

  function onTouchStart(e: React.TouchEvent) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStart.current.x
    const dy = e.changedTouches[0].clientY - swipeStart.current.y
    const absX = Math.abs(dx), absY = Math.abs(dy)
    const THRESH = 70
    if (!exposureDone) {
      if (absX > absY && absX > THRESH && dx > 0) handleExposureOK()
      else if (absY > absX && absY > THRESH) {
        if (dy < 0) handleGraduate('easy'); else handleSuspend()
      }
      return
    }
    if (!revealed) {
      if (absY > absX && absY > THRESH) {
        if (dy < 0) handleGraduate('easy'); else handleSuspend()
      }
      return
    }
    if (absX > absY && absX > THRESH) {
      if (dx < 0) handleAgain(); else handleGood(goodCount)
    } else if (absY > absX && absY > THRESH) {
      if (dy < 0) handleGraduate('easy'); else handleSuspend()
    }
  }

  // ── Front / back render ───────────────────────────────────────────────────

  function renderFront() {
    if (isAudio) {
      return (
        <button onClick={e => { e.stopPropagation(); playAudio(cardAudio(card)!) }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 999, background: T.crimson, border: 'none', cursor: 'pointer', color: '#fff', boxShadow: '0 2px 14px rgba(180,40,30,0.22)' }}>
          <Icon name="speaker" size={26} strokeWidth={1.6} />
        </button>
      )
    }
    if (isSts) {
      return (
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.5 }}>
          {renderHighlighted(card.ind_items?.ab ?? '', targetWord ?? '')}
        </div>
      )
    }
    if (isReverse) {
      return (
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
          {card.ind_items?.zh ?? '—'}
        </div>
      )
    }
    return (
      <>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.22 }}>
          {card.ind_items?.ab}
        </div>
        {cardAudio(card) && (
          <button onClick={e => { e.stopPropagation(); playAudio(cardAudio(card)!) }}
            style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.lineSoft}`, cursor: 'pointer', color: T.inkSoft }}>
            <Icon name="speaker" size={14} strokeWidth={1.8} />
          </button>
        )}
      </>
    )
  }

  function renderBack() {
    if (isAudio) {
      return (
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.inkSoft, letterSpacing: '-0.01em' }}>
          {card.ind_items?.ab}
        </div>
      )
    }
    if (isReverse) {
      return (
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
          {card.ind_items?.ab}
        </div>
      )
    }
    return (
      <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
        {card.ind_items?.zh ?? '—'}
      </div>
    )
  }

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
        <button onClick={() => onExit(graduatedRef.current.size)} aria-label="Exit"
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
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

        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => {
            if (showFlagPicker) { setShowFlagPicker(false); return }
            if (!exposureDone) { handleExposureOK(); return }
            if (!revealed) setRevealed(true)
          }}
          style={{
            position: 'relative', background: T.paperHi, borderRadius: 22,
            border: `1px solid ${!exposureDone ? '#D2D8AE' : T.lineSoft}`,
            padding: '26px 22px', minHeight: 280,
            display: 'flex', flexDirection: 'column', cursor: 'pointer',
            touchAction: 'none',
            boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
          }}
        >
          {/* Top-left: grade badge */}
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
              <div style={{ position: 'absolute', top: 14, left: 12 }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: gs.color, background: gs.bg, border: `1px solid ${gs.border}`,
                  padding: '2px 7px', borderRadius: 5,
                }}>{grade}</span>
              </div>
            )
          })()}

          {/* Bottom-left: flag button + picker */}
          {(() => {
            const currentFlag    = card.id in cardFlags ? cardFlags[card.id] : (card.flag_color ?? null)
            const currentFlagHex = flagColorHex(currentFlag)
            return (
              <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 5, alignItems: 'center' }}
                onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowFlagPicker(p => !p)} aria-label="Set flag" style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: currentFlagHex ?? T.inkFaint,
                }}>
                  <Icon name={currentFlag ? 'flagF' : 'flag'} size={15} strokeWidth={1.8} />
                </button>
                {showFlagPicker && (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
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
            )
          })()}

          {/* Top-right: suspend */}
          <div style={{ position: 'absolute', top: 10, right: 12 }} onClick={e => e.stopPropagation()}>
            <button onClick={handleSuspend} aria-label="Suspend card" style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkFaint,
            }}>
              <Icon name="pause" size={15} strokeWidth={1.8} />
            </button>
          </div>

          {/* Swipe hints — after reveal on test pass */}
          {exposureDone && revealed && (
            <>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.crimson, opacity: 0.65 }}>
                <Icon name="arrow-l" size={17} strokeWidth={2} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>again</span>
              </div>
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.sage, opacity: 0.5 }}>
                <Icon name="arrow-r" size={17} strokeWidth={2} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl' }}>good</span>
              </div>
            </>
          )}

          {/* Front */}
          <div style={{ flex: showBack ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
            {renderFront()}
          </div>

          {/* Back or tap-to-reveal */}
          {showBack ? (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 1, background: T.lineSoft }} />
              <div style={{ textAlign: 'center' }}>{renderBack()}</div>
            </div>
          ) : (
            <div style={{ marginTop: 'auto', paddingTop: 22, textAlign: 'center' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                tap to reveal
              </span>
            </div>
          )}
        </div>

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
            <Icon name="check" size={17} strokeWidth={2.5} color="#fff" /> OK, got it
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
          reviewMode={reviewMode}       setReviewMode={setReviewMode}
          showAllLangs={showAllLangs}   setShowAllLangs={setShowAllLangs}
          excludedLangs={excludedLangs} setExcludedLangs={setExcludedLangs}
          onReloadNeeded={onReloadNeeded}
          onClose={() => setShowOptions(false)}
        />
      )}
    </div>
  )
}

// ─── LearnEnd ─────────────────────────────────────────────────────────────────

function LearnEnd({ learnedCount, onDone }: {
  learnedCount: number
  onDone: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: T.cream, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onDone} style={{ width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkSoft, cursor: 'pointer' }}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 88, fontWeight: 600, color: T.ink, letterSpacing: '-0.04em', lineHeight: 0.9 }}>
          {learnedCount}
        </div>
        <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 8, fontWeight: 500 }}>
          {learnedCount === 1 ? 'card learned' : 'cards learned'}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.inkMute, lineHeight: 1.6, maxWidth: 260 }}>
          {learnedCount > 0
            ? 'These will appear in your review queue soon.'
            : 'Exit whenever you\'re ready.'}
        </div>
      </div>
      <div style={{ padding: '0 16px 40px' }}>
        <button onClick={onDone} style={{
          width: '100%', height: 52, borderRadius: 14, background: T.sage, color: '#fff',
          border: `1px solid ${T.sage}`, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 12px rgba(80,120,30,0.2)',
        }}>Done</button>
      </div>
    </div>
  )
}

// ─── Landing / wrapper ────────────────────────────────────────────────────────

function LearnPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const autostart    = searchParams.get('start') === '1'

  const [mode,         setMode]         = useState<'landing' | 'learning' | 'done'>('landing')
  const [cards,        setCards]        = useState<FlashcardWithItem[]>([])
  const [overflow,     setOverflow]     = useState<FlashcardWithItem[]>([])
  const [ctx,          setCtx]          = useState<LearnContext>({ learnedToday: 0, learnCap: 10, priorityCollectionIds: [] })
  const [loading,      setLoading]      = useState(true)
  const [learnedCount, setLearnedCount] = useState(0)
  const [sessionKey,   setSessionKey]   = useState(0)
  const autostartedRef = useRef(false)

  async function reload() {
    const [allCards, context] = await Promise.all([listLearnFlashcards(), loadLearnContext()])
    const excludeLangs: string[] = localStorage.getItem('srs_show_all_langs') === 'false'
      ? (() => { try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] } })()
      : []
    const filtered = excludeLangs.length
      ? allCards.filter(c => !excludeLangs.includes(c.ind_items?.language ?? ''))
      : allCards
    const toLearn = Math.max(0, context.learnCap - context.learnedToday)
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

  const capReached  = ctx.learnedToday >= ctx.learnCap

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
      onDone={autostart ? () => router.push('/') : () => setMode('landing')}
    />
  }

  // Landing
  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <Link href="/" style={{ width: 36, height: 36, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkSoft, textDecoration: 'none' }}>
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
          {capReached ? (
            <>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>Daily cap reached</div>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>
                You&apos;ve learned {ctx.learnedToday} new cards today. Come back tomorrow!
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>No new cards</div>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>Add cards to a collection to start learning.</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function LearnPageWithSuspense() {
  return <Suspense><LearnPage /></Suspense>
}
