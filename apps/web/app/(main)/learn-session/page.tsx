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
  listLearnFlashcards, graduateLearnCard, suspendCard, cardMeta, cardAudio,
  type FlashcardWithItem,
} from '@/lib/db/srs/flashcards'
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

  const prefs = profileRes.data?.preferences as Record<string, unknown> | null
  const learnCap = typeof prefs?.learn_cap === 'number' ? prefs.learn_cap : 10

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

// ─── LearnSession ─────────────────────────────────────────────────────────────

function LearnSession({ cards, ctx, onExit }: {
  cards: FlashcardWithItem[]
  ctx:   LearnContext
  onExit: (count: number) => void
}) {
  const [queue, setQueue] = useState<LearnEntry[]>(() =>
    cards.map(c => ({ card: c, exposureDone: false, goodCount: 0 }))
  )
  const [qIdx,     setQIdx]    = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewMode, setReviewMode] = useState('forward')
  const [showPriorityToast, setShowPriorityToast] = useState(false)
  const graduatedRef       = useRef(new Set<string>())
  const priorityToastRef   = useRef(false)
  const sessionEndFiredRef = useRef(false)
  const audioRef           = useRef<HTMLAudioElement | null>(null)
  const swipeStart         = useRef({ x: 0, y: 0 })
  const onExitRef          = useRef(onExit)
  useEffect(() => { onExitRef.current = onExit })

  useEffect(() => {
    setReviewMode(localStorage.getItem('srs_review_mode') ?? 'forward')
  }, [])

  useEffect(() => { audioRef.current?.pause() }, [qIdx])

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
        else if (e.key === 'ArrowDown') handleSuspend()
        return
      }
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true) }
        else if (e.key === 'ArrowUp') handleGraduate('easy')
        return
      }
      if (e.key === '1' || e.key === 'ArrowLeft')                       handleAgain()
      else if (e.key === '3' || e.key === 'ArrowRight')                  handleGood(goodCount)
      else if (e.key === '4' || e.key === 'ArrowUp')                     handleGraduate('easy')
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
    setQIdx(qi => qi + 1)
  }

  function handleExposureOK() {
    setQueue(prev => prev.map((e, i) => i === qIdx ? { ...e, exposureDone: true } : e))
    setRevealed(false)
    // Don't advance qIdx — card stays, now shows as test pass
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
      else if (absY > absX && absY > THRESH && dy > 0) handleSuspend()
      return
    }
    if (!revealed) {
      if (absY > absX && absY > THRESH && dy < 0) handleGraduate('easy')
      return
    }
    if (absX > absY && absX > THRESH) {
      if (dx < 0) handleAgain(); else handleGood(goodCount)
    } else if (absY > absX && absY > THRESH && dy < 0) {
      handleGraduate('easy')
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
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          Learn
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ height: 4, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${(graduatedCount / Math.max(totalInitial, 1)) * 100}%`, height: '100%', background: T.sage, borderRadius: 999, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {!exposureDone ? 'exposure' : 'test'}
          </span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>
            {graduatedCount} / {totalInitial}
          </span>
        </div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 16px 0' }}>

        {/* ↑ easy hint — test pass only */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8, opacity: exposureDone ? 0.42 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: T.amber }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>easy</span>
            <Icon name="chevron" size={13} strokeWidth={2} style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>

        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => {
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
          {/* Phase label */}
          <div style={{ position: 'absolute', top: 14, right: 16 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: !exposureDone ? T.sage : T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {!exposureDone ? 'new' : lang.type}
            </span>
          </div>

          {/* Swipe hints — after reveal on test pass */}
          {exposureDone && revealed && (
            <>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.crimson, opacity: 0.45 }}>
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

        {/* ↓ suspend hint — exposure pass only */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, opacity: exposureDone ? 0 : 0.38 }}>
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSuspend} style={{
              width: 56, height: 56, borderRadius: 15, flexShrink: 0,
              background: T.paperHi, color: T.inkFaint,
              border: `1px solid ${T.lineSoft}`, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="pause" size={18} strokeWidth={1.8} />
            </button>
            <button onClick={handleExposureOK} style={{
              flex: 1, height: 56, borderRadius: 15, background: T.sage, color: '#fff',
              border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 14px rgba(80,120,30,0.2)',
            }}>
              <Icon name="check" size={17} strokeWidth={2.5} color="#fff" /> OK, got it
            </button>
          </div>
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
  const [ctx,          setCtx]          = useState<LearnContext>({ learnedToday: 0, learnCap: 10, priorityCollectionIds: [] })
  const [loading,      setLoading]      = useState(true)
  const [learnedCount, setLearnedCount] = useState(0)
  const [sessionKey,   setSessionKey]   = useState(0)
  const autostartedRef = useRef(false)

  async function reload() {
    const [allCards, context] = await Promise.all([listLearnFlashcards(), loadLearnContext()])
    const toLearn = Math.max(0, context.learnCap - context.learnedToday)
    const sessionCards = allCards.slice(0, toLearn)
    setCards(sessionCards)
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

  if (mode === 'learning' && cards.length > 0) {
    return <LearnSession key={sessionKey} cards={cards} ctx={ctx} onExit={handleSessionExit} />
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
