'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import GoalSheet from '@/components/sheets/GoalSheet'
import { getDeckGoalStats, type GoalData } from '@/lib/db/profile/goal'
import { listCollections } from '@/lib/db/progress/collections'

type Props = {
  initialGoal: GoalData
}

export default function GoalWidget({ initialGoal }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [goal, setGoal]           = useState<GoalData>(initialGoal)
  const [deckName, setDeckName]   = useState<string | null>(null)
  const [deckStats, setDeckStats] = useState<{ total: number; mastered: number } | null>(null)

  useEffect(() => {
    if (!goal.goal_collection_id) { setDeckName(null); setDeckStats(null); return }
    Promise.all([
      listCollections().then(cols => cols.find(c => c.id === goal.goal_collection_id)?.name ?? null),
      getDeckGoalStats(goal.goal_collection_id),
    ]).then(([name, stats]) => {
      setDeckName(name)
      setDeckStats(stats)
    })
  }, [goal.goal_collection_id])

  const isActive = !!goal.goal_collection_id

  let daysLeft: number | null = null
  if (goal.goal_due_date) {
    const ms = new Date(goal.goal_due_date).getTime() - Date.now()
    daysLeft = Math.max(0, Math.ceil(ms / 86400000))
  }

  const masteredPct = deckStats && deckStats.total > 0 ? deckStats.mastered / deckStats.total : 0

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        style={{
          flex: 1, padding: '13px 14px', borderRadius: 16, cursor: 'pointer',
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
          display: 'flex', flexDirection: 'column', textAlign: 'left',
        }}
      >
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute,
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          Goal
        </div>

        {isActive ? (
          <>
            <div style={{ flex: 1, marginTop: 5, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: T.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {deckName ?? '…'}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                {daysLeft !== null ? `${daysLeft} days left` : `${goal.daily_goal} cards/day`}
              </div>
            </div>
            <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999, background: T.amber,
                width: `${Math.round(masteredPct * 100)}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkMute, marginTop: 4,
            }}>
              {Math.round(masteredPct * 100)}% known
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Icon name="plus" size={14} color={T.inkFaint} strokeWidth={2} />
              <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>Set a goal</span>
            </div>
            <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, marginTop: 10 }} />
          </>
        )}
      </button>

      <GoalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialGoal={goal}
        onSaved={newGoal => setGoal(newGoal)}
      />
    </>
  )
}
