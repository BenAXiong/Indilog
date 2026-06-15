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

function StreakCard({ streak }: { streak: number }) {
  return (
    <div style={{
      flex: 1, padding: '13px 14px', borderRadius: 16,
      background: `linear-gradient(150deg, ${T.crimson}, ${T.crimsonDp})`,
      color: '#fff', overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px rgba(120,30,15,0.2)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="flame" size={28} color="#fff" strokeWidth={1.7} />
        <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {streak}
        </span>
        <span style={{ fontSize: 13, opacity: 0.85 }}>days</span>
      </div>
    </div>
  )
}


// (DualRingCard extracted to DualRingCard.tsx)

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function Heatmap({ heatmap, daysStudied, dailyAverage }: {
  heatmap: number[][]
  daysStudied: number
  dailyAverage: number
}) {
  const weeks = heatmap.length

  const statStyle = { fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.025em' } as const
  const labelStyle = { fontSize: 12, color: T.inkSoft, marginLeft: 4 } as const

  return (
    <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <span style={statStyle}>{dailyAverage}</span>
          <span style={labelStyle}>avg reps / day</span>
        </div>
        <div>
          <span style={statStyle}>{daysStudied}</span>
          <span style={labelStyle}>days studied</span>
        </div>
      </div>

      {/* Grid, centered */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
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
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { lang, dialectLabel } = await getActiveLangServer()
  const stats = await getDashboardStats(lang.code)

  return (
    <div style={{ padding: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>

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
      <div style={{ display: 'flex', gap: 10 }}>
        <StreakCard streak={stats.streak} />
        <GoalWidget />
      </div>

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
      <Heatmap heatmap={stats.heatmap} daysStudied={stats.daysStudied} dailyAverage={stats.dailyAverage} />

    </div>
  )
}
