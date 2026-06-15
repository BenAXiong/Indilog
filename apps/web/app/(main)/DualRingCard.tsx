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

// ── Shared centered popup shell ───────────────────────────────────────────────
function CenteredPopup({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(43,34,26,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.paper, borderRadius: 18,
          padding: '22px 20px 20px', maxWidth: 320, width: '100%',
          boxShadow: '0 12px 48px rgba(43,34,26,0.22)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function PopupRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={14} color={T.inkSoft} strokeWidth={1.8} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}

export default function DualRingCard({
  learnedToday, learnTarget, newCount,
  reviewedToday, reviewTarget, dueCount, totalDue,
  tomorrowLearnTarget, tomorrowReviewTarget, simActive,
  simGoalRemaining, reviewMoreN,
}: {
  learnedToday: number;  learnTarget: number;  newCount: number
  reviewedToday: number; reviewTarget: number; dueCount: number; totalDue: number
  tomorrowLearnTarget: number | null
  tomorrowReviewTarget: number | null
  simActive: boolean
  simGoalRemaining: number
  reviewMoreN: number
}) {
  const [showForecast,      setShowForecast]      = useState(false)
  const [showSimInfo,       setShowSimInfo]       = useState(false)
  const [showNoCardsPopup,  setShowNoCardsPopup]  = useState(false)
  const [showSimGoal,       setShowSimGoal]       = useState(false)
  const [simGoalDontShow,   setSimGoalDontShow]   = useState(false)

  useEffect(() => { localStorage.setItem('srs_learn_target',  String(learnTarget))  }, [learnTarget])
  useEffect(() => { localStorage.setItem('srs_review_target', String(reviewTarget)) }, [reviewTarget])
  useEffect(() => { localStorage.setItem('srs_sim_active',    String(simActive))    }, [simActive])

  // Sim goal overlay: clear dismissal whenever goal is not yet met, re-show when it is
  useEffect(() => {
    if (!simActive) return
    if (simGoalRemaining > 0) {
      localStorage.removeItem('srs_sim_goal_dismissed')
    } else {
      if (localStorage.getItem('srs_sim_goal_dismissed') !== '1') {
        setShowSimGoal(true)
      }
    }
  }, [simActive, simGoalRemaining])

  function dismissSimGoal() {
    if (simGoalDontShow) localStorage.setItem('srs_sim_goal_dismissed', '1')
    setShowSimGoal(false)
  }

  const learnPct  = learnTarget  > 0 ? Math.min(learnedToday  / learnTarget,  1) : 0
  const reviewPct = reviewTarget > 0 ? Math.min(reviewedToday / reviewTarget, 1) : 0
  const learnRemaining    = Math.max(0, learnTarget - learnedToday)
  const learnN            = Math.min(newCount, learnRemaining > 15 ? 10 : learnRemaining)
  const learnMoreN        = Math.min(newCount, learnTarget > 15 ? 10 : learnTarget)

  // Learn case 3 sub-states
  const learnNeedCards = newCount === 0 && learnedToday < learnTarget && learnTarget > 0

  // Review case 3 sub-states
  const reviewNeverStarted = reviewedToday === 0 && totalDue === 0

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

      {/* Sim goal counter — absolutely positioned top-right, symmetrical to forecast */}
      {simActive && (
        <>
          <button
            onClick={() => setShowSimInfo(v => !v)}
            style={{ position: 'absolute', top: 8, right: 10, zIndex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
          >
            <Icon name="info" size={13} color={T.inkMute} />
          </button>
          {showSimInfo && (
            <div style={{
              position: 'absolute', top: 30, right: 10, zIndex: 10,
              background: T.paperHi, border: `1px solid ${T.lineSoft}`,
              borderRadius: 10, padding: '10px 14px', minWidth: 180,
              boxShadow: '0 4px 16px rgba(43,34,26,0.12)',
            }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', marginBottom: 8 }}>
                {totalDue} / {simGoalRemaining}
              </div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, lineHeight: 1.6 }}>
                <div><span style={{ color: T.inkSoft }}>x</span> = totalDue</div>
                <div style={{ color: T.inkFaint, marginBottom: 6 }}>all cards currently due, regardless of session size</div>
                <div><span style={{ color: T.inkSoft }}>y</span> = simTotalActive − simRootedCount</div>
                <div style={{ color: T.inkFaint }}>sim-deck cards (priority decks) not yet at Rooted mastery</div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {/* ── Learn half ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <RingWithCount pct={learnPct} color={T.sage} count={learnedToday} target={learnTarget} />
          {learnedToday < learnTarget && newCount > 0 ? (
            <Link href={`/learn?start=1&n=${learnN}`} style={{
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
            <Link href={`/learn?n=${learnMoreN}`} style={{
              width: '100%', height: 44, borderRadius: 12, textDecoration: 'none',
              background: T.amberBg, color: T.amber, border: `1px solid ${T.amberBg}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600,
            }}>
              Learn {learnMoreN} more?
            </Link>
          ) : learnNeedCards ? (
            <button
              onClick={() => setShowNoCardsPopup(true)}
              style={{
                width: '100%', height: 44, borderRadius: 12, cursor: 'pointer',
                background: T.terraBg, border: `1px solid ${T.terraBg}`, color: T.terra,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: 600,
              }}
            >
              <Icon name="plus" size={13} color={T.terra} strokeWidth={2} />
              Add new cards
            </button>
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
              Review {Math.min(totalDue, reviewMoreN)} more?
            </Link>
          ) : reviewNeverStarted ? (
            <div style={{
              width: '100%', height: 44, borderRadius: 12,
              background: T.sageBg, border: `1px solid #D2D8AE`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 11.5, color: T.sageDp, fontWeight: 600 }}>No reviews yet</span>
            </div>
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

      {/* ── "Add new cards" popup ─────────────────────────────────────────────── */}
      {showNoCardsPopup && (
        <CenteredPopup onClose={() => setShowNoCardsPopup(false)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>No new cards available</span>
            <button onClick={() => setShowNoCardsPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
              <Icon name="close" size={16} color={T.inkMute} strokeWidth={2} />
            </button>
          </div>
          {simActive ? (
            <>
              <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
                Your priority decks have no more unscheduled cards. The simulation can&apos;t schedule anything new for today.
              </p>
              <PopupRow icon="capture" text="Capture new words from your reading or listening" />
              <PopupRow icon="card"    text="Add more decks to your priority list" />
              <PopupRow icon="info"    text="Adjust your goal and rerun the simulation to reschedule" />
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
                There are no new cards left to learn today.
              </p>
              <PopupRow icon="capture" text="Capture new words from your reading or listening" />
              <PopupRow icon="card"    text="Add a collection deck to your library" />
            </>
          )}
        </CenteredPopup>
      )}

      {/* ── Sim goal complete overlay ─────────────────────────────────────────── */}
      {showSimGoal && (
        <CenteredPopup onClose={dismissSimGoal}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Priority goal complete</span>
            <button onClick={dismissSimGoal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
              <Icon name="close" size={16} color={T.inkMute} strokeWidth={2} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 18 }}>
            Every card in your priority decks has reached <strong>Rooted</strong> mastery. Your original sim goal is met.
          </p>
          <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 20 }}>
            To keep progressing: set a new goal, expand your priority decks, or continue reviewing to move cards toward Blooming.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={simGoalDontShow}
              onChange={e => setSimGoalDontShow(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12.5, color: T.inkMute }}>Don&apos;t show again</span>
          </label>
          <button
            onClick={dismissSimGoal}
            style={{
              width: '100%', height: 40, borderRadius: 11, cursor: 'pointer',
              background: T.sageBg, border: `1px solid #D2D8AE`, color: T.sageDp,
              fontSize: 13.5, fontWeight: 600,
            }}
          >
            Got it
          </button>
        </CenteredPopup>
      )}
    </Card>
  )
}
