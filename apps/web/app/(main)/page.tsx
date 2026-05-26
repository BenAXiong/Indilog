import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Card, Stat, SectionHead, LangAvatar, Icon, Wordmark } from '@/components/ui'
import { ACTIVE_LANG } from '@/lib/mock-data'
import { getDashboardStats } from '@/lib/db/stats-server'

// Deterministic heatmap — same algorithm as design handoff
function buildHeatmap(weeks: number) {
  let seed = 9
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const data: number[][] = []
  for (let w = 0; w < weeks; w++) {
    const week: number[] = []
    const recency = w / (weeks - 1)
    for (let d = 0; d < 7; d++) {
      const r = rand()
      let level = 0
      if (r < 0.55 + recency * 0.25) level = 1
      if (r < 0.38 + recency * 0.30) level = 2
      if (r < 0.20 + recency * 0.25) level = 3
      if (r < 0.08 + recency * 0.15) level = 4
      week.push(level)
    }
    data.push(week)
  }
  // Force today empty (drives streak prompt)
  data[weeks - 1][6] = 0
  // Force previous 16 days active for the streak narrative
  let back = 16
  outer: for (let w = weeks - 1; w >= 0 && back >= 0; w--) {
    for (let d = 6; d >= 0 && back >= 0; d--) {
      if (w === weeks - 1 && d === 6) continue
      if (data[w][d] === 0) data[w][d] = 1
      back--
    }
  }
  return data
}

const INTENSITY = [T.lineSoft, '#F1D8C6', '#E5A88E', '#C66848', T.crimsonDp]

function ActivityHeatmap() {
  const weeks = 18
  const data = buildHeatmap(weeks)
  const activeDays = data.flat().filter(v => v > 0).length
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May']

  return (
    <div style={{
      background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16,
      padding: '14px 14px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: '-0.025em' }}>
            {activeDays}
          </span>
          <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 6 }}>active days</span>
        </div>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          of {weeks * 7}
        </span>
      </div>

      {/* Month markers */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 6, height: 12 }}>
        {data.map((_, wi) => {
          const label = wi % 4 === 1 ? months[Math.floor(wi / 4)] : null
          return (
            <div key={wi} style={{
              width: 13, fontSize: 9.5, color: T.inkMute,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {label}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', gap: 3 }}>
        {data.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((lvl, di) => {
              const isToday = wi === weeks - 1 && di === 6
              return (
                <div key={di} style={{
                  width: 13, height: 13, borderRadius: 3,
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12, fontSize: 10.5, color: T.inkMute,
        fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'transparent', border: `1.5px solid ${T.crimson}`, display: 'inline-block' }} />
          today
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>less</span>
          {INTENSITY.map((c, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: 2.5, background: c,
              border: i === 0 ? `1px solid ${T.line}` : 'none',
            }} />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const lang = ACTIVE_LANG
  const stats = await getDashboardStats()

  return (
    <div style={{ padding: '4px 18px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <Wordmark size={22} />
        <Link href="/settings" aria-label="Settings" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft,
        }}>
          <Icon name="settings" size={17} strokeWidth={1.6} />
        </Link>
      </div>

      {/* Active language card */}
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
            {lang.dialect && (
              <span style={{ fontSize: 12, color: T.inkSoft }}>· {lang.dialect}</span>
            )}
          </div>
        </div>
        <Link href="/settings" style={{
          fontSize: 12, color: T.inkSoft, padding: '6px 10px', borderRadius: 8,
          background: T.paper, border: `1px solid ${T.lineSoft}`, fontWeight: 500,
          textDecoration: 'none',
        }}>
          Change
        </Link>
      </Card>

      {/* Streak banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 16,
        background: `linear-gradient(135deg, ${T.crimson}, ${T.crimsonDp})`,
        color: '#fff', position: 'relative', overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 22px rgba(120,30,15,0.22)',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -10, opacity: 0.18 }}>
          <Icon name="flame" size={120} strokeWidth={1} color="#fff" />
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="share" size={20} color="#fff" strokeWidth={1.9} />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>
              {stats.streak}
            </span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>day streak</span>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 1 }}>
            Capture today to keep it going
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <SectionHead title="Overview" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat value={stats.capturedTotal} label="Captures"  icon="capture" accent={T.crimson} />
          <Stat value={stats.reviewedToday} label="Reviewed"  icon="card"    accent={T.sage} />
          <Stat value={stats.dueCount}      label="Due today" icon="review"  accent={T.amber} />
          <Stat value={stats.capturedToday} label="Today"     icon="learn"   accent={T.terra} />
        </div>
      </div>

      {/* Activity heatmap */}
      <div>
        <SectionHead title="Activity" action="Last 18 weeks" />
        <ActivityHeatmap />
      </div>

      {/* Recent captures */}
      <div>
        <SectionHead title="Recent captures" />
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
            const typeColor  = item.type === 'word' ? T.crimson : item.type === 'sentence' ? T.sage : T.amber
            const typeBg     = item.type === 'word' ? T.crimsonBg : item.type === 'sentence' ? T.sageBg : T.amberBg
            const typeBorder = item.type === 'word' ? '#EFCAB8' : item.type === 'sentence' ? '#D2D8AE' : '#EBD49A'
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
                    fontFamily: 'Newsreader, Georgia, serif',
                    fontSize: 15, fontWeight: 500, color: T.ink,
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.text}
                  </span>
                  <span style={{ fontSize: 12, color: T.inkSoft, display: 'block', marginTop: 2 }}>
                    {item.language}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 7px', borderRadius: 999,
                    background: typeBg, color: typeColor,
                    border: `1px solid ${typeBorder}`,
                    fontSize: 10.5, fontWeight: 500,
                  }}>
                    {item.type}
                  </span>
                  <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace' }}>
                    {when}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
