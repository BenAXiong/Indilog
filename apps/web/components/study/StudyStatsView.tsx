'use client'

import { T } from '@/lib/tokens'
import { SectionHead } from '@/components/ui'
import type { StudyStats, CollectionStat } from '@/lib/db/srs/stats-client'

function CoverageLine({ stat }: { stat: CollectionStat }) {
  const pct = stat.total > 0 ? stat.known / stat.total : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{stat.name}</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute }}>
          {stat.known}/{stat.total}
        </span>
      </div>
      <div style={{ height: 7, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: pct >= 0.8 ? T.sage : pct >= 0.4 ? T.amber : T.crimson,
          width: `${Math.round(pct * 100)}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, marginTop: 4 }}>
        {Math.round(pct * 100)}% known
      </div>
    </div>
  )
}

function PaceChart({ dailyCounts }: { dailyCounts: Array<{ date: string; count: number }> }) {
  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1)
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <div style={{ display: 'flex', gap: 4, height: 56, alignItems: 'flex-end' }}>
      {dailyCounts.map((d, i) => {
        const barH = d.count > 0 ? Math.max(4, Math.round(d.count / maxCount * 48)) : 2
        const dow = new Date(d.date + 'T12:00:00').getDay()
        const isToday = i === dailyCounts.length - 1
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <div style={{
                width: '100%', borderRadius: '3px 3px 0 0',
                height: barH,
                background: isToday ? T.crimson : d.count > 0 ? '#E5A88E' : T.lineSoft,
                transition: 'height 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: 8.5, fontFamily: '"JetBrains Mono", monospace',
              color: isToday ? T.crimson : T.inkFaint,
              fontWeight: isToday ? 700 : 400,
            }}>{days[dow]}</span>
          </div>
        )
      })}
    </div>
  )
}

export function StudyStatsLoading() {
  return (
    <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[60, 100, 80].map((w, i) => (
        <div key={i} className="animate-iv-shimmer" style={{ height: 14, borderRadius: 6, background: T.lineSoft, width: `${w}%` }} />
      ))}
    </div>
  )
}

export default function StudyStatsView({ stats }: { stats: StudyStats }) {
  return (
    <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Overview 2×2 */}
      <div>
        <SectionHead title="Overview" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total cards', value: stats.totalCards, color: T.crimson },
            { label: 'Due today',   value: stats.dueToday,   color: T.amber   },
            { label: 'Rooted',      value: stats.rooted,     color: '#566234'  },
            { label: 'Blooming',    value: stats.blooming,   color: '#3a601a'  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding: '14px 14px', borderRadius: 14,
              background: T.paperHi, border: `1px solid ${T.lineSoft}`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
            }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 32, fontWeight: 600, color, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage */}
      {(stats.collections.length > 0 || stats.captures.total > 0) && (
        <div>
          <SectionHead title="Coverage" />
          <div style={{
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            borderRadius: 16, padding: '14px 14px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {stats.collections.map(col => (
              <CoverageLine key={col.id} stat={col} />
            ))}
            {stats.captures.total > 0 && (
              <CoverageLine stat={stats.captures} />
            )}
          </div>
        </div>
      )}

      {/* 14-day pace */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionHead title="14-day pace" style={{ marginBottom: 0 }} />
          {stats.avgPerDay > 0 && (
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute }}>
              avg {stats.avgPerDay}/day
            </span>
          )}
        </div>
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          borderRadius: 16, padding: '14px 14px',
        }}>
          <PaceChart dailyCounts={stats.dailyCounts} />
        </div>
      </div>

    </div>
  )
}
