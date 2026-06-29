'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import GoalSheet from '@/components/sheets/GoalSheet'
import { listPriorityDecks, NOTE_SOURCE_LABELS } from '@/lib/db/srs/priority'
import { getDeckMasteryStats, type DeckMasteryStats } from '@/lib/db/profile/goal'
import { listCollections } from '@/lib/db/progress/collections'
import { createClient } from '@/lib/supabase/client'

const GRADE_COLORS = {
  seed:     T.inkFaint,
  planted:  T.amber,
  rooted:   T.sage,
  blooming: T.sageDp,
}

export default function GoalWidget() {
  const router = useRouter()
  const [sheetOpen,  setSheetOpen]  = useState(false)
  const [deckNames,  setDeckNames]  = useState<string[]>([])
  const [hasMore,    setHasMore]    = useState(false)
  const [grades,     setGrades]     = useState<DeckMasteryStats | null>(null)
  const [simActive,  setSimActive]  = useState(false)
  const [loaded,     setLoaded]     = useState(false)

  // Re-runs whenever loaded is set to false (e.g. after GoalSheet closes).
  // Uses getSession() — reads from cookie without a network round-trip, so no auth race on first load.
  useEffect(() => {
    if (loaded) return
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      const user = session?.user
      if (!user) { setLoaded(true); return }
      const decks = await listPriorityDecks(user.id)
      if (cancelled) return
      if (!decks.length) { setLoaded(true); return }

      const top3 = decks.slice(0, 3)
      const topCollectionDeck = top3.find(d => d.collection_id)

      const [cols, stats] = await Promise.all([
        listCollections(),
        topCollectionDeck ? getDeckMasteryStats(topCollectionDeck.collection_id!) : Promise.resolve(null),
      ])
      if (cancelled) return

      setDeckNames(top3.map(d =>
        d.filter_config
          ? d.filter_config.label
          : d.note_source
            ? (NOTE_SOURCE_LABELS[d.note_source] ?? d.note_source)
            : (cols.find(c => c.id === d.collection_id)?.name ?? '…')
      ))
      setHasMore(decks.length > 3)
      setGrades(stats)
      setSimActive(decks.some(d => d.in_simulation))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = deckNames.length > 0

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
        {/* Row 1: "Goal" label (left) | deck chain up to ~80% (right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flexShrink: 0 }}>
            Goal
          </span>
          {loaded && isActive && (
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
              {deckNames.flatMap((name, i) =>
                i > 0
                  ? [
                      <span key={`a${i}`} style={{ color: T.inkFaint, fontWeight: 400, fontSize: 11, margin: '0 3px' }}>→</span>,
                      <span key={`n${i}`} style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{name}</span>,
                    ]
                  : [<span key={`n${i}`} style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{name}</span>]
              )}
              {hasMore && <span style={{ color: T.inkFaint, fontWeight: 400, fontSize: 11, marginLeft: 4 }}>···</span>}
            </div>
          )}
        </div>

        {!loaded ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: 6 }}>
            <div style={{ width: 80, height: 10, borderRadius: 5, background: T.lineSoft }} />
          </div>
        ) : isActive ? (
          <>
            {/* Row 2: maturity % counters (left) | goal type pill (right) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {grades && grades.total > 0
                  ? (['seed', 'planted', 'rooted', 'blooming'] as const).map((g, i) => (
                    <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {i > 0 && <span style={{ color: T.inkFaint }}>·</span>}
                      <span style={{ color: GRADE_COLORS[g], fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
                        {Math.round(grades[g] / grades.total * 100)}%
                      </span>
                    </span>
                  ))
                  : <span style={{ color: T.inkFaint, fontSize: 10 }}>…</span>
                }
              </div>
              <span style={{
                padding: '2px 7px', borderRadius: 999, flexShrink: 0,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                background: simActive ? T.crimsonBg : T.sageBg,
                color: simActive ? T.crimson : '#566234',
              }}>
                {simActive ? 'Sim' : 'Manual'}
              </span>
            </div>

            {/* Row 3: progress bar */}
            <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, marginTop: 8, overflow: 'hidden', display: 'flex' }}>
              {grades && grades.total > 0 && (['blooming', 'rooted', 'planted', 'seed'] as const).map(g => (
                <div key={g} style={{
                  height: '100%',
                  width: `${grades[g] / grades.total * 100}%`,
                  background: GRADE_COLORS[g],
                  transition: 'width 0.4s ease',
                }} />
              ))}
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

      <GoalSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setLoaded(false); router.refresh() }} />
    </>
  )
}
