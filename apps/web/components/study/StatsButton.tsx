'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { getStudyStats, type StudyStats } from '@/lib/db/srs/stats-client'
import StudyStatsView, { StudyStatsLoading } from './StudyStatsView'

export default function StatsButton() {
  const [open,    setOpen]    = useState(false)
  const [stats,   setStats]   = useState<StudyStats | null>(null)
  const [loading, setLoading] = useState(false)

  function handleOpen() {
    setOpen(true)
    if (!stats && !loading) {
      setLoading(true)
      getStudyStats().then(s => { setStats(s); setLoading(false) })
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Study stats"
        style={{
          width: 36, height: 36, borderRadius: 999,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Icon name="bar-chart" size={16} strokeWidth={1.8} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(43,34,26,0.35)' }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41,
            background: T.cream, borderRadius: '20px 20px 0 0',
            boxShadow: '0 -4px 32px rgba(43,34,26,0.15)',
            maxHeight: '85vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
            </div>
            {/* Title */}
            <div style={{
              padding: '8px 18px 16px', flexShrink: 0,
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
            }}>
              Stats
            </div>
            {/* Content */}
            <div style={{ paddingBottom: 40 }}>
              {loading || !stats ? <StudyStatsLoading /> : <StudyStatsView stats={stats} />}
            </div>
          </div>
        </>
      )}
    </>
  )
}
