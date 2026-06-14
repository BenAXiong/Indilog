import Link from 'next/link'
import { T } from '@/lib/tokens'
import { LangAvatar, Icon, Wordmark, Card } from '@/components/ui'
import DualRingCard from './DualRingCard'
import { getDashboardStats } from '@/lib/db/progress/stats-server'
import { getActiveLangServer } from '@/lib/db/profile/server'
import GoalWidget from '@/components/widgets/GoalWidget'
import SettingsButton from '@/components/widgets/SettingsSheet'

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


// (DualRingCard extracted to DualRingCard.tsx)

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
      <div data-id="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
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
            <GoalWidget />
          </div>
        )
      })()}

      {/* Two-ring card: Learn + Review */}
      <DualRingCard
        learnedToday={stats.learnedToday}   learnTarget={stats.learnTarget}    newCount={stats.newCount}
        reviewedToday={stats.reviewedToday} reviewTarget={stats.reviewTarget}  dueCount={stats.dueCount}  totalDue={stats.totalDue}
        tomorrowLearnTarget={stats.tomorrowLearnTarget}
        tomorrowReviewTarget={stats.tomorrowReviewTarget}
        simActive={stats.simulationActive}
        simGoalRemaining={stats.simGoalRemaining}
        reviewMoreN={stats.reviewMoreN}
      />

      {/* Heatmap */}
      <Heatmap heatmap={stats.heatmap} monthLabels={stats.monthLabels} />

    </div>
  )
}
