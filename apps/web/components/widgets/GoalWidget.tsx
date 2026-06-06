'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import GoalSheet from '@/components/sheets/GoalSheet'
import { listPriorityDecks } from '@/lib/db/srs/priority'
import { getDeckRootedStats } from '@/lib/db/profile/goal'
import { listCollections } from '@/lib/db/progress/collections'
import { createClient } from '@/lib/supabase/client'

export default function GoalWidget() {
  const [sheetOpen,  setSheetOpen]  = useState(false)
  const [deckName,   setDeckName]   = useState<string | null>(null)
  const [rootedPct,  setRootedPct]  = useState<number | null>(null)
  const [simActive,  setSimActive]  = useState(false)
  const [loaded,     setLoaded]     = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoaded(true); return }
      const decks = await listPriorityDecks(user.id)
      if (!decks.length) { setLoaded(true); return }
      const top = decks[0]
      const [cols, stats] = await Promise.all([
        listCollections(),
        getDeckRootedStats(top.collection_id),
      ])
      const col = cols.find(c => c.id === top.collection_id)
      setDeckName(col?.name ?? null)
      setRootedPct(stats.total > 0 ? stats.rooted / stats.total : 0)
      setSimActive(decks.some(d => d.in_simulation))
      setLoaded(true)
    })
  }, [])

  const isActive = deckName !== null

  return (
    <>
      <div
        onClick={() => setSheetOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSheetOpen(true) }}
        style={{
          flex: 1, padding: '13px 14px', borderRadius: 16, cursor: 'pointer',
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
          display: 'flex', flexDirection: 'column', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Goal
          </span>
          {loaded && isActive && (
            <span style={{
              padding: '2px 7px', borderRadius: 999,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              background: simActive ? T.crimsonBg : T.sageBg,
              color: simActive ? T.crimson : '#566234',
            }}>
              {simActive ? 'Simulated' : 'Manual'}
            </span>
          )}
        </div>

        {!loaded ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: 6 }}>
            <div style={{ width: 80, height: 10, borderRadius: 5, background: T.lineSoft }} />
          </div>
        ) : isActive ? (
          <>
            <div style={{ flex: 1, marginTop: 5, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deckName}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                {rootedPct !== null ? `${Math.round(rootedPct * 100)}% rooted` : '…'}
              </div>
            </div>
            <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999, background: '#7B8C46',
                width: `${Math.round((rootedPct ?? 0) * 100)}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Icon name="plus" size={14} color={T.inkFaint} strokeWidth={2} />
              <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>Set priority decks</span>
            </div>
            <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, marginTop: 10 }} />
          </>
        )}
      </div>

      <GoalSheet open={sheetOpen} onClose={() => { setSheetOpen(false); /* re-load on close */ setLoaded(false) }} />
    </>
  )
}
