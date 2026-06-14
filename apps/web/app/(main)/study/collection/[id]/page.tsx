'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import {
  listCollections, listCollectionCards,
  renameCollection, deleteCollection,
  type CollectionCard,
} from '@/lib/db/progress/collections'
import { ensureFlashcards } from '@/lib/db/srs/flashcards'

type LessonGroup = { lesson: number; cards: CollectionCard[] }
type LevelGroup  = { level: number; lessons: LessonGroup[] }

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 999, flexShrink: 0,
  background: 'transparent', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: T.inkSoft,
}

export default function CollectionPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()

  const [name,       setName]       = useState('')
  const [levels,     setLevels]     = useState<LevelGroup[]>([])
  const [open,       setOpen]       = useState<Set<string>>(new Set())
  const [renaming,   setRenaming]   = useState(false)
  const [nameEdit,   setNameEdit]   = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [queueing, setQueueing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([listCollections(), listCollectionCards(id)]).then(([cols, cards]) => {
      const col = cols.find(c => c.id === id)
      if (col) { setName(col.name); setNameEdit(col.name) }

      const map = new Map<number, Map<number, CollectionCard[]>>()
      for (const card of cards) {
        if (!map.has(card.level)) map.set(card.level, new Map())
        const lm = map.get(card.level)!
        if (!lm.has(card.lesson)) lm.set(card.lesson, [])
        lm.get(card.lesson)!.push(card)
      }
      setLevels(
        Array.from(map.entries())
          .sort(([a], [b]) => a - b)
          .map(([level, lm]) => ({
            level,
            lessons: Array.from(lm.entries())
              .sort(([a], [b]) => a - b)
              .map(([lesson, cards]) => ({ lesson, cards })),
          }))
      )
    })
  }, [id])

  useEffect(() => { if (renaming) inputRef.current?.focus() }, [renaming])

  function toggle(key: string) {
    setOpen(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function commitRename() {
    const trimmed = nameEdit.trim()
    if (!trimmed || trimmed === name) { setRenaming(false); setNameEdit(name); return }
    await renameCollection(id, trimmed)
    setName(trimmed)
    setRenaming(false)
  }

  async function handleDelete() {
    await deleteCollection(id)
    router.push('/study')
  }

  async function handleStartReview() {
    setQueueing(true)
    await ensureFlashcards()
    setQueueing(false)
    router.push('/review')
  }

  const totalCards   = levels.reduce((s, lv) => s + lv.lessons.reduce((ss, ls) => ss + ls.cards.length, 0), 0)
  const totalLessons = levels.reduce((s, lv) => s + lv.lessons.length, 0)

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
        <Link href="/study" style={{
          ...iconBtn, background: T.paperHi, border: `1px solid ${T.line}`,
          textDecoration: 'none', color: T.inkSoft,
        }}>
          <Icon name="arrow-l" size={16} strokeWidth={2} />
        </Link>

        {/* Title / rename input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <input
              ref={inputRef}
              value={nameEdit}
              onChange={e => setNameEdit(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(false); setNameEdit(name) } }}
              style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
                border: 'none', borderBottom: `2px solid ${T.crimson}`, background: 'transparent',
                outline: 'none', width: '100%', padding: '0 0 2px',
              }}
            />
          ) : (
            <h1 style={{
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em',
              margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {name || '…'}
            </h1>
          )}
          {totalCards > 0 && (
            <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>
              {totalCards} cards · {totalLessons} lessons
            </div>
          )}
        </div>

        {/* Rename */}
        <button onClick={() => { setRenaming(true); setNameEdit(name) }} style={iconBtn} title="Rename">
          <Icon name="pen" size={16} strokeWidth={1.8} />
        </button>

        {/* Delete */}
        {!confirmDel ? (
          <button onClick={() => setConfirmDel(true)} style={iconBtn} title="Delete collection">
            <Icon name="trash" size={16} strokeWidth={1.8} color={T.crimson} />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={handleDelete}
              style={{ ...iconBtn, background: T.crimsonBg, color: T.crimson, border: `1px solid ${T.crimson}` }}
              title="Confirm delete"
            >
              <Icon name="check" size={15} strokeWidth={2.4} color={T.crimson} />
            </button>
            <button onClick={() => setConfirmDel(false)} style={iconBtn} title="Cancel">
              <Icon name="x" size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Start reviewing */}
      <button
        onClick={handleStartReview}
        disabled={queueing}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          height: 46, borderRadius: 14, fontSize: 15, fontWeight: 600,
          background: queueing ? T.lineSoft : T.crimson,
          color: queueing ? T.inkFaint : '#fff',
          border: 'none', cursor: queueing ? 'default' : 'pointer',
        }}
      >
        <Icon name="review" size={18} strokeWidth={1.8} color={queueing ? T.inkFaint : '#fff'} />
        {queueing ? 'Preparing…' : 'Study this collection'}
      </button>

      {/* Level / lesson groups */}
      {levels.map(lv => (
        <div key={lv.level}>
          {levels.length > 1 && (
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: T.inkMute, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace', marginBottom: 6,
            }}>
              Level {lv.level}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lv.lessons.map(ls => {
              const key   = `${lv.level}-${ls.lesson}`
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
                        {ls.cards[0]?.lesson_title ?? `Lesson ${ls.lesson}`}
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
