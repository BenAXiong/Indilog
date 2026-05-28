'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import { listCollections, listCollectionCards, type CollectionCard } from '@/lib/db/progress/collections'

type LessonGroup = { lesson: number; cards: CollectionCard[] }
type LevelGroup  = { level: number; lessons: LessonGroup[] }

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const [name,   setName]   = useState('')
  const [levels, setLevels] = useState<LevelGroup[]>([])
  const [open,   setOpen]   = useState<Set<string>>(new Set(['1-1']))

  useEffect(() => {
    Promise.all([
      listCollections(),
      listCollectionCards(id),
    ]).then(([cols, cards]) => {
      const col = cols.find(c => c.id === id)
      if (col) setName(col.name)

      // Group by level → lesson
      const map = new Map<number, Map<number, CollectionCard[]>>()
      for (const card of cards) {
        if (!map.has(card.level)) map.set(card.level, new Map())
        const lm = map.get(card.level)!
        if (!lm.has(card.lesson)) lm.set(card.lesson, [])
        lm.get(card.lesson)!.push(card)
      }
      const grouped: LevelGroup[] = Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([level, lm]) => ({
          level,
          lessons: Array.from(lm.entries())
            .sort(([a], [b]) => a - b)
            .map(([lesson, cards]) => ({ lesson, cards })),
        }))
      setLevels(grouped)
    })
  }, [id])

  function toggle(key: string) {
    setOpen(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const totalCards = levels.reduce((s, lv) => s + lv.lessons.reduce((ss, ls) => ss + ls.cards.length, 0), 0)

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <Link href="/learn" style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, textDecoration: 'none',
        }}>
          <Icon name="arrow-l" size={16} strokeWidth={2} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 22, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.02em', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name || '…'}
          </h1>
          {totalCards > 0 && (
            <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>
              {totalCards} cards · {levels.reduce((s, lv) => s + lv.lessons.length, 0)} lessons
            </div>
          )}
        </div>
      </div>

      {/* Level / lesson groups */}
      {levels.map(lv => (
        <div key={lv.level}>
          {levels.length > 1 && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkMute, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace', marginBottom: 6 }}>
              Level {lv.level}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lv.lessons.map(ls => {
              const key = `${lv.level}-${ls.lesson}`
              const isOpen = open.has(key)
              return (
                <div key={ls.lesson} style={{
                  background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => toggle(key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '11px 14px', background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="chevron" size={13} strokeWidth={2.2} color={T.inkFaint}
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                        Lesson {ls.lesson}
                      </span>
                    </span>
                    <span style={{ fontSize: 11.5, color: T.inkFaint, fontFamily: '"JetBrains Mono", monospace' }}>
                      {ls.cards.length} cards
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${T.lineSoft}`, padding: '8px 0' }}>
                      {ls.cards.map((card, i) => (
                        <div key={card.id} style={{
                          display: 'flex', gap: 12, padding: '5px 14px',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                        }}>
                          <span style={{ fontSize: 13, color: T.ink, minWidth: 120, flexShrink: 0 }}>{card.ab}</span>
                          <span style={{ fontSize: 13, color: T.inkSoft }}>{card.zh ?? ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
