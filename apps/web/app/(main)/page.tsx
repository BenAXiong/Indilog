import { T } from '@/lib/tokens'
import { LangAvatar, Icon, Wordmark, Card } from '@/components/ui'
import DualRingCard from './DualRingCard'
import { getDashboardStats } from '@/lib/db/progress/stats-server'
import { getActiveLangServer } from '@/lib/db/profile/server'
import GoalWidget from '@/components/widgets/GoalWidget'
import SettingsButton from '@/components/widgets/SettingsSheet'
import StatsButton from '@/components/study/StatsButton'
import Heatmap from '@/components/widgets/Heatmap'
import PerfMark from '@/components/perf/PerfMark'

function StreakCard({ streak }: { streak: number }) {
  return (
    <div style={{
      flexShrink: 0, padding: '4px 14px 0px 14px', borderRadius: 16,
      background: `linear-gradient(150deg, ${T.crimson}, ${T.crimsonDp})`,
      color: '#fff', overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px rgba(120,30,15,0.2)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <Icon name="flame" size={62} color="#fff" strokeWidth={1.7}  style={{ marginLeft: -8, marginRight: -2 }}/>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginLeft: 0 }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {streak}
          </span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>days</span>
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
      {/* server component — mark fires when the streamed RSC payload mounts */}
      <PerfMark flow="home" />

      {/* Header */}
      <div data-id="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <Wordmark size={22} />
        <div style={{ display: 'flex', gap: 8 }}>
          <StatsButton />
          <SettingsButton />
        </div>
      </div>

      {/* Language + Streak row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Card raised pad={14} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
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
        <StreakCard streak={stats.streak} />
      </div>

      {/* Goal — full width */}
      <GoalWidget />

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
      <Heatmap heatmap={stats.heatmap} heatmapCounts={stats.heatmapCounts} daysStudied={stats.daysStudied} dailyAverage={stats.dailyAverage} />

    </div>
  )
}
