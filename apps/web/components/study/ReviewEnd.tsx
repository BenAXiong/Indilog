'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { patchPreferences } from '@/lib/db/profile/preferences'
import { createClient } from '@/lib/supabase/client'
import type { FlashcardWithItem, Rating } from '@/lib/db/srs/flashcards'
import { getSessionUser } from '@/lib/supabase/session'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SessionReturning = { total: number; newCards: number; plantedOrAbove: number }

async function countSessionReturning(cardIds: string[]): Promise<SessionReturning> {
  if (!cardIds.length) return { total: 0, newCards: 0, plantedOrAbove: 0 }
  const supabase = createClient()
  const user = await getSessionUser()
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
  const newCards       = newRes.count      ?? 0
  const plantedOrAbove = plantedRes.count  ?? 0
  return { total: newCards + plantedOrAbove, newCards, plantedOrAbove }
}

async function countDueTomorrow(): Promise<number> {
  const supabase = createClient()
  const user = await getSessionUser()
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

const CONFETTI_COLORS = ['#C14B2C', '#EDAB32', '#7A9F3C', '#B06030', '#F5D060']

const GRADE_DOT_COLOR: Record<Rating, string> = {
  again: T.crimson,
  hard:  T.terra,
  good:  T.sage,
  easy:  T.amber,
}

// ─── ReviewEnd ────────────────────────────────────────────────────────────────

export function ReviewEnd({
  sessionCount,
  goalMet,
  streak,
  reviewedCards,
  gradeHistory,
  reviewMoreN: reviewMoreNProp,
  onReviewMore,
  onDone,
}: {
  sessionCount:  number
  goalMet:       boolean
  streak:        number
  reviewedCards: FlashcardWithItem[]
  gradeHistory:  Map<string, Rating[]>
  reviewMoreN:   number
  onReviewMore:  (n: number) => void
  onDone:        () => void
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
