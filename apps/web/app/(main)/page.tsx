import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Stat, SectionHead, LangAvatar, Icon, Wordmark, Card } from '@/components/ui'
import { getDashboardStats } from '@/lib/db/progress/stats-server'
import { getActiveLangServer } from '@/lib/db/profile/server'
import GoalWidget from '@/components/widgets/GoalWidget'
import SettingsButton from '@/components/widgets/SettingsSheet'
import { getLanguage } from '@/lib/languages'

const INTENSITY = [T.lineSoft, '#F1D8C6', '#E5A88E', '#C66848', T.crimsonDp]

// ─── Streak + goal row ───────────────────────────────────────────────────────

function StreakCard({ streak, chain, todayActive }: { streak: number; chain: boolean[]; todayActive: boolean }) {
  // Override today's slot (index 6) with the new Learn+Review logic
  const displayChain = [...chain.slice(0, 6), todayActive]
  return (
    <div style={{
      flex: 1, padding: '13px 14px', borderRadius: 16,
      background: `linear-gradient(150deg, ${T.crimson}, ${T.crimsonDp})`,
      color: '#fff', overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px rgba(120,30,15,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="flame" size={17} color="#fff" strokeWidth={1.9} />
        <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {streak}
        </span>
        <span style={{ fontSize: 12, opacity: 0.85 }}>days</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 11 }}>
        {displayChain.map((active, i) => (
          <span key={i} style={{
            flex: 1, height: 5, borderRadius: 999,
            background: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.28)',
          }} />
        ))}
      </div>
      <div style={{ fontSize: 10.5, opacity: 0.78, marginTop: 7, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.02em' }}>
        last 7 days
      </div>
    </div>
  )
}


// ─── Two-ring card + CTAs ────────────────────────────────────────────────────

function DualRingCard({
  learnedToday, learnTarget, newCount,
  reviewedToday, reviewTarget, dueCount, totalDue,
}: {
  learnedToday: number;  learnTarget: number;  newCount: number
  reviewedToday: number; reviewTarget: number; dueCount: number; totalDue: number
}) {
  const R = 38, C = 2 * Math.PI * R
  const learnPct  = learnTarget  > 0 ? Math.min(learnedToday  / learnTarget,  1) : 0
  const reviewPct = reviewTarget > 0 ? Math.min(reviewedToday / reviewTarget, 1) : 0
  const learnN = Math.min(newCount, Math.max(0, learnTarget - learnedToday))

  function Ring({ pct, color }: { pct: number; color: string }) {
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
          <slot />
        </div>
      </div>
    )
  }

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

  return (
    <Card raised pad={16}>
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
              Learn more?
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

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function Heatmap({ heatmap, monthLabels }: { heatmap: number[][]; monthLabels: (string | null)[] }) {
  const weeks = heatmap.length
  const activeDays = heatmap.flat().filter(v => v > 0).length

  return (
    <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.025em' }}>
            {activeDays}
          </span>
          <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 5 }}>review days</span>
        </div>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          16 weeks
        </span>
      </div>

      {/* Month labels */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 5, paddingLeft: 0 }}>
        {monthLabels.map((label, wi) => (
          <div key={wi} style={{
            width: 14, fontSize: 9.5, color: T.inkMute,
            fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em',
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            {label ?? ''}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', gap: 3 }}>
        {heatmap.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((lvl, di) => {
              const isToday = wi === weeks - 1 && di === 6
              return (
                <div key={di} style={{
                  width: 14, height: 14, borderRadius: 3.5,
                  background: INTENSITY[lvl],
                  border: lvl === 0 ? `1px solid ${T.line}` : 'none',
                  boxShadow: isToday ? `0 0 0 1.5px ${T.crimson}` : 'none',
                }} />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 4, marginTop: 12, fontSize: 10, color: T.inkMute,
        fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em',
      }}>
        <span>less</span>
        {INTENSITY.map((c, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c, border: i === 0 ? `1px solid ${T.line}` : 'none' }} />
        ))}
        <span>more</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { lang, dialectLabel } = await getActiveLangServer()
  const stats = await getDashboardStats(lang.code)

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <Wordmark size={22} />
        <SettingsButton />
      </div>

      {/* Language card */}
      <Card raised pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LangAvatar letter={lang.letter} color={lang.color} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.inkMute, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Studying
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 19, fontWeight: 600, color: T.ink }}>
              {lang.name}
            </span>
            {dialectLabel && <span style={{ fontSize: 12, color: T.inkSoft }}>· {dialectLabel}</span>}
          </div>
        </div>
        <SettingsButton variant="change" />
      </Card>

      {/* Streak + goal row */}
      {(() => {
        // Streak: today counts if both targets met (simulation) or any progress (manual)
        const todayActive = stats.simulationActive
          ? stats.learnedToday >= stats.learnTarget && stats.reviewedToday >= stats.reviewTarget
          : stats.learnedToday > 0 || stats.reviewedToday > 0
        return (
          <div style={{ display: 'flex', gap: 10 }}>
            <StreakCard streak={stats.streak} chain={stats.chain} todayActive={todayActive} />
            <GoalWidget initialGoal={{
              daily_goal:         stats.dailyGoal,
              goal_collection_id: stats.goalCollectionId,
              goal_due_date:      stats.goalDueDate,
            }} />
          </div>
        )
      })()}

      {/* Two-ring card: Learn + Review */}
      <DualRingCard
        learnedToday={stats.learnedToday}   learnTarget={stats.learnTarget}    newCount={stats.newCount}
        reviewedToday={stats.reviewedToday} reviewTarget={stats.reviewTarget}  dueCount={stats.dueCount}  totalDue={stats.totalDue}
      />

      {/* Heatmap */}
      <div>
        <SectionHead title="Review history" />
        <Heatmap heatmap={stats.heatmap} monthLabels={stats.monthLabels} />
      </div>

      {/* Quick stats */}
      <div>
        <SectionHead title="Overview" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat value={stats.mastered}    label="Rooted"        icon="check"   accent={T.sage}   />
          <Stat value={stats.active}      label="Active cards"  icon="card"    accent={T.crimson} />
          <Stat value={stats.thisWeek}    label="This week"     icon="review"  accent={T.terra}  />
          <Stat value={stats.dueTomorrow} label="Due tomorrow"  icon="layers"  accent={T.amber}  />
        </div>
      </div>

      {/* Recent captures — collapsible, closed by default */}
      <details>
        <summary style={{
          listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: '2px 0 10px', userSelect: 'none',
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent captures
          </span>
          <Icon name="chev-d" size={12} color={T.inkFaint} style={{ transition: 'transform .15s' }} />
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.recentItems.length === 0 ? (
            <div style={{
              padding: '24px 16px', textAlign: 'center',
              background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
            }}>
              <div style={{ fontSize: 13, color: T.inkSoft }}>Nothing captured yet.</div>
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>Tap Capture to start your notebook.</div>
            </div>
          ) : stats.recentItems.map((item) => {
            const tc = item.type === 'word'
              ? { color: T.crimson, bg: T.crimsonBg, border: '#EFCAB8' }
              : item.type === 'sentence'
              ? { color: T.sage, bg: T.sageBg, border: '#D2D8AE' }
              : { color: T.amber, bg: T.amberBg, border: '#EBD49A' }
            const when = new Date(item.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', background: T.paperHi,
                border: `1px solid ${T.lineSoft}`, borderRadius: 14,
                boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 500, color: T.ink,
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{item.ab}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, display: 'block', marginTop: 2 }}>
                    {getLanguage(item.language)?.name ?? item.language}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 999,
                    background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontSize: 10.5, fontWeight: 500,
                  }}>{item.type}</span>
                  <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace' }}>{when}</span>
                </div>
              </div>
            )
          })}
        </div>
      </details>

    </div>
  )
}
