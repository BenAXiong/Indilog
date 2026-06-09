'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon, Card } from '@/components/ui'

const R = 38, C = 2 * Math.PI * R

function RingWithCount({ pct, color, count, target }: { pct: number; color: string; count: number; target: number }) {
  return (
    <div style={{ position: 'relative', width: 84, height: 84 }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={R} fill="none" stroke={T.lineSoft} strokeWidth="9" />
        <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {count}
        </span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, color: T.inkMute, marginTop: 1 }}>
          / {target}
        </span>
      </div>
    </div>
  )
}

export default function DualRingCard({
  learnedToday, learnTarget, newCount,
  reviewedToday, reviewTarget, dueCount, totalDue,
  tomorrowLearnTarget, tomorrowReviewTarget,
}: {
  learnedToday: number;  learnTarget: number;  newCount: number
  reviewedToday: number; reviewTarget: number; dueCount: number; totalDue: number
  tomorrowLearnTarget: number | null
  tomorrowReviewTarget: number | null
}) {
  const [showForecast, setShowForecast] = useState(false)

  useEffect(() => { localStorage.setItem('srs_review_target', String(reviewTarget)) }, [reviewTarget])

  const learnPct  = learnTarget  > 0 ? Math.min(learnedToday  / learnTarget,  1) : 0
  const reviewPct = reviewTarget > 0 ? Math.min(reviewedToday / reviewTarget, 1) : 0
  const learnN     = Math.min(newCount, Math.max(0, learnTarget - learnedToday))
  const learnMoreN = Math.min(newCount, learnTarget)

  return (
    <Card raised pad={16} style={{ position: 'relative' }}>
      {/* Forecast icon — absolutely positioned top-left, no layout impact */}
      {(tomorrowLearnTarget !== null || tomorrowReviewTarget !== null) && (
        <>
          <button
            onClick={() => setShowForecast(v => !v)}
            style={{ position: 'absolute', top: 8, left: 10, zIndex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
          >
            <Icon name="info" size={13} color={T.inkMute} />
          </button>
          {showForecast && (
            <div style={{
              position: 'absolute', top: 30, left: 10, zIndex: 10,
              background: T.paperHi, border: `1px solid ${T.lineSoft}`,
              borderRadius: 10, padding: '10px 14px', minWidth: 160,
              boxShadow: '0 4px 16px rgba(43,34,26,0.12)',
            }}>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMute, marginBottom: 7 }}>
                Tomorrow&apos;s forecast
              </div>
              {tomorrowLearnTarget !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: T.inkSoft }}>Learn</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.sage }}>{tomorrowLearnTarget} new</span>
                </div>
              )}
              {tomorrowReviewTarget !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ fontSize: 12.5, color: T.inkSoft }}>Review</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.crimson }}>~{tomorrowReviewTarget} due</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {/* ── Learn half ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Learn
          </div>
          <RingWithCount pct={learnPct} color={T.sage} count={learnedToday} target={learnTarget} />
          {learnedToday < learnTarget && newCount > 0 ? (
            <Link href="/learn-session?start=1" style={{
              width: '100%', height: 44, borderRadius: 12, textDecoration: 'none',
              background: T.sage, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 13.5, fontWeight: 600,
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 3px 10px rgba(80,120,30,0.22)',
            }}>
              <Icon name="play" size={12} color="#fff" />
              Learn {learnN}
            </Link>
          ) : learnedToday >= learnTarget && newCount > 0 ? (
            <Link href="/learn-session" style={{
              width: '100%', height: 44, borderRadius: 12, textDecoration: 'none',
              background: T.amberBg, color: T.amber, border: `1px solid ${T.amberBg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600,
            }}>
              Learn {learnMoreN} more?
            </Link>
          ) : (
            <div style={{
              width: '100%', height: 44, borderRadius: 12,
              background: T.sageBg, border: `1px solid #D2D8AE`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 11.5, color: T.sageDp, fontWeight: 600 }}>No new cards</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: T.lineSoft, alignSelf: 'stretch' }} />

        {/* ── Review half ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Review
          </div>
          <RingWithCount pct={reviewPct} color={T.crimson} count={reviewedToday} target={reviewTarget} />
          {dueCount > 0 && reviewedToday < reviewTarget ? (
            <Link href="/review?start=1" style={{
              width: '100%', height: 44, borderRadius: 12, textDecoration: 'none',
              background: T.crimson, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 13.5, fontWeight: 600,
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 3px 10px rgba(120,30,15,0.22)',
            }}>
              <Icon name="play" size={12} color="#fff" />
              Review {dueCount}
            </Link>
          ) : reviewedToday >= reviewTarget && totalDue > 0 ? (
            <Link href="/review?start=1&more=1" style={{
              width: '100%', height: 44, borderRadius: 12, textDecoration: 'none',
              background: T.amberBg, color: T.amber, border: `1px solid ${T.amberBg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600,
            }}>
              Review more
            </Link>
          ) : (
            <div style={{
              width: '100%', height: 44, borderRadius: 12,
              background: T.sageBg, border: `1px solid #D2D8AE`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon name="check" size={14} color={T.sageDp} strokeWidth={2.2} />
              <span style={{ fontSize: 11.5, color: T.sageDp, fontWeight: 600 }}>All caught up!</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
