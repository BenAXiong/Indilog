'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { listCollections, type CollectionMeta } from '@/lib/db/progress/collections'
import { saveGoalData, clearGoal, getDeckGoalStats, type GoalData } from '@/lib/db/profile/goal'

type Props = {
  open:         boolean
  onClose:      () => void
  initialGoal:  GoalData
  onSaved:      (goal: GoalData) => void
}

export default function GoalSheet({ open, onClose, initialGoal, onSaved }: Props) {
  const [collections, setCollections] = useState<CollectionMeta[]>([])
  const [collectionId, setCollectionId] = useState(initialGoal.goal_collection_id ?? '')
  const [dailyGoal, setDailyGoal]       = useState(String(initialGoal.daily_goal))
  const [dueDate, setDueDate]           = useState(initialGoal.goal_due_date ?? '')
  const [deckStats, setDeckStats]       = useState<{ total: number; mastered: number } | null>(null)
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    if (!open) return
    listCollections().then(setCollections)
  }, [open])

  useEffect(() => {
    if (!collectionId) { setDeckStats(null); return }
    getDeckGoalStats(collectionId).then(setDeckStats)
  }, [collectionId])

  if (!open) return null

  const daily = parseInt(dailyGoal) || 0
  const remaining = deckStats ? Math.max(0, deckStats.total - deckStats.mastered) : null

  let hint = ''
  if (remaining !== null && daily > 0) {
    const days = Math.ceil(remaining / daily)
    const eta = new Date()
    eta.setDate(eta.getDate() + days)
    const etaStr = eta.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    hint = `${remaining} cards left · ~${days} days at ${daily}/day (by ${etaStr})`
  }

  async function handleSave() {
    setSaving(true)
    const patch: GoalData = {
      daily_goal:         parseInt(dailyGoal) || 20,
      goal_collection_id: collectionId || null,
      goal_due_date:      dueDate || null,
    }
    await saveGoalData(patch)
    onSaved(patch)
    setSaving(false)
    onClose()
  }

  async function handleClear() {
    await clearGoal()
    onSaved({ daily_goal: parseInt(dailyGoal) || 20, goal_collection_id: null, goal_due_date: null })
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(30,18,10,0.35)', zIndex: 70,
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: T.paper, borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`, zIndex: 71,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 0',
        }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink }}>
            Learning Goal
          </span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 999,
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.inkMute,
          }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ height: 1, background: T.lineSoft, margin: '10px 18px 0' }} />

        <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Deck picker */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600, color: T.inkMute,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: '"JetBrains Mono", monospace', marginBottom: 6,
            }}>Target deck</label>
            <div style={{ position: 'relative' }}>
              <select
                value={collectionId}
                onChange={e => setCollectionId(e.target.value)}
                style={{
                  display: 'block', width: '100%', padding: '11px 36px 11px 12px',
                  borderRadius: 10, background: T.paperHi, border: `1px solid ${T.line}`,
                  fontSize: 15, color: collectionId ? T.ink : T.inkMute,
                  fontFamily: 'inherit', cursor: 'pointer',
                  appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                <option value="">— None —</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: T.inkMute,
              }}>
                <Icon name="chev-d" size={14} strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Daily goal */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600, color: T.inkMute,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: '"JetBrains Mono", monospace', marginBottom: 6,
            }}>Daily goal</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number" min="1" max="500"
                value={dailyGoal}
                onChange={e => setDailyGoal(e.target.value)}
                style={{
                  width: 80, padding: '11px 0', borderRadius: 10,
                  background: T.paperHi, border: `1px solid ${T.line}`,
                  fontSize: 20, fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 600, color: T.ink, textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 14, color: T.inkSoft }}>cards / day</span>
            </div>
          </div>

          {/* Target date (optional) */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600, color: T.inkMute,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: '"JetBrains Mono", monospace', marginBottom: 6,
            }}>
              Target date&nbsp;
              <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>
                (optional)
              </span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={{
                display: 'block', width: '100%', padding: '11px 12px',
                borderRadius: 10, background: T.paperHi, border: `1px solid ${T.line}`,
                fontSize: 15, color: dueDate ? T.ink : T.inkFaint,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Hint */}
          {hint && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: T.amberBg, border: `1px solid #EBD49A`,
              fontSize: 13, color: T.inkSoft, lineHeight: 1.45,
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {hint}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving} style={{
              height: 52, borderRadius: 13, border: 'none',
              background: T.crimson, color: '#fff',
              fontSize: 16, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2)',
            }}>
              {saving ? 'Saving…' : 'Save goal'}
            </button>
            {initialGoal.goal_collection_id && (
              <button onClick={handleClear} style={{
                height: 44, borderRadius: 13,
                border: `1px solid ${T.lineSoft}`, background: T.paperHi,
                color: T.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>
                Clear goal
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
