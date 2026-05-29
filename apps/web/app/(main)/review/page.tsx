'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Icon, Button } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useLang } from '@/lib/context/LangDialectProvider'
import {
  ensureFlashcards, listDueFlashcards, rateCard, cardMeta,
  type FlashcardWithItem, type Rating,
} from '@/lib/db/srs/flashcards'
import { listItems, type Item } from '@/lib/db/notebook/items'

const RATINGS: { id: Rating; label: string; sub: string; color: string }[] = [
  { id: 'again', label: 'Again', sub: '<10m', color: T.crimson },
  { id: 'hard',  label: 'Hard',  sub: '1d',   color: T.terra },
  { id: 'good',  label: 'Good',  sub: '3d',   color: T.sage },
  { id: 'easy',  label: 'Easy',  sub: '7d',   color: T.amber },
]

// ─── Review Session ───────────────────────────────────────────
function ReviewSession({
  cards,
  onExit,
}: {
  cards: FlashcardWithItem[]
  onExit: (reviewed: number) => void
}) {
  const [cardIdx, setCardIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  const card = cards[cardIdx]
  const total = cards.length

  const handleRate = async (rating: Rating) => {
    await rateCard(card.id, rating, {
      ease_factor:   card.ease_factor,
      interval_days: card.interval_days,
      repetitions:   card.repetitions,
    })
    setFlipping(true)
    setTimeout(() => {
      const next = cardIdx + 1
      setReviewed(r => r + 1)
      setFlipping(false)
      setRevealed(false)
      if (next >= total) {
        onExit(reviewed + 1)
      } else {
        setCardIdx(next)
      }
    }, 300)
  }

  const lang = cardMeta(card)

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <button onClick={() => onExit(reviewed)} aria-label="Back" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="arrow-l" size={17} strokeWidth={1.8} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Flashcards
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>
            {lang.language}{lang.dialect ? ` · ${lang.dialect}` : ''}
          </div>
        </div>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {cardIdx + 1} / {total}
        </span>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: i < cardIdx ? T.sage : i === cardIdx ? T.amber : T.lineSoft,
            transition: 'background .3s',
          }} />
        ))}
      </div>

      {/* Flashcard */}
      <div
        className={flipping ? 'animate-iv-flip' : ''}
        style={{
          background: T.paperHi, borderRadius: 22, padding: '28px 22px',
          border: `1px solid ${T.lineSoft}`, minHeight: 240,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 6px rgba(80,40,20,0.05), 0 12px 28px rgba(80,40,20,0.08)',
        }}
      >
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {lang.type}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 36, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            {card.front}
          </div>

          {revealed ? (
            <div className="animate-iv-rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 1, background: T.lineSoft }} />
              <div style={{ fontSize: 16, fontWeight: 500, color: T.ink, lineHeight: 1.4 }}>
                {card.back}
              </div>
            </div>
          ) : (
            <button onClick={() => setRevealed(true)} style={{
              padding: 14, borderRadius: 12,
              background: T.ink, color: T.cream, fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 1px 0 rgba(255,255,255,0.1) inset, 0 4px 12px rgba(40,30,20,0.15)',
              cursor: 'pointer', border: 'none',
            }}>
              <Icon name="play" size={11} color={T.cream} />
              Reveal answer
            </button>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      {revealed && (
        <div className="animate-iv-rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {RATINGS.map(r => (
            <button
              key={r.id}
              onClick={() => handleRate(r.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '10px 4px', borderRadius: 12,
                background: T.paperHi, border: `1.5px solid ${r.color}`,
                color: r.color, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = r.color; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.paperHi; (e.currentTarget as HTMLButtonElement).style.color = r.color }}
            >
              <span style={{ fontSize: 12.5 }}>{r.label}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, opacity: 0.7, fontWeight: 500 }}>{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Review Landing ───────────────────────────────────────────
export default function ReviewPage() {
  const { lang, dialectLabel } = useLang()
  const [mode, setMode] = useState<'landing' | 'reviewing' | 'done'>('landing')
  const [dueCards, setDueCards] = useState<FlashcardWithItem[]>([])
  const [savedItems, setSavedItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [lastReviewed, setLastReviewed] = useState(0)

  async function loadData() {
    await ensureFlashcards()
    const [cards, items] = await Promise.all([
      listDueFlashcards(),
      listItems({ limit: 10 }),
    ])
    setDueCards(cards)
    setSavedItems(items)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function handleSessionExit(reviewed: number) {
    setLastReviewed(reviewed)
    setMode(reviewed > 0 ? 'done' : 'landing')
    loadData()
  }

  if (mode === 'reviewing' && dueCards.length > 0) {
    return <ReviewSession cards={dueCards} onExit={handleSessionExit} />
  }

  const typeColor = (t: string) => {
    if (t === 'word')     return { color: T.crimson, bg: T.crimsonBg, border: '#EFCAB8' }
    if (t === 'sentence') return { color: T.sage,    bg: T.sageBg,    border: '#D2D8AE' }
    return                       { color: T.amber,   bg: T.amberBg,   border: '#EBD49A' }
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ScreenHeader title="Review" langName={lang.name} langDialect={dialectLabel} />

      {/* Done banner */}
      {mode === 'done' && (
        <div className="animate-iv-rise" style={{
          padding: '16px 18px', borderRadius: 16,
          background: `linear-gradient(135deg, ${T.sage}, ${T.sageDp})`,
          color: '#fff', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 600 }}>
              {lastReviewed} card{lastReviewed !== 1 ? 's' : ''} reviewed
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {dueCards.length > 0 ? `${dueCards.length} more due` : 'All caught up for now'}
            </div>
          </div>
        </div>
      )}

      {/* Due today card */}
      <Card raised pad={16}>
        {loading ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-iv-shimmer" style={{ width: 120, height: 16, borderRadius: 8, background: T.lineSoft }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Due now
              </span>
              {dueCards.length > 0 && (
                <span style={{ fontSize: 11.5, color: T.amber, fontWeight: 500 }}>
                  ~{Math.ceil(dueCards.length * 0.5)} min
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 8 }}>
              <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 38, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {dueCards.length}
              </span>
              <span style={{ fontSize: 14, color: T.inkSoft }}>
                {dueCards.length === 1 ? 'card' : 'cards'}
              </span>
            </div>

            {dueCards.length > 0 ? (
              <Button
                variant="primary" size="lg" icon="play"
                style={{ width: '100%', marginTop: 14 }}
                onClick={() => setMode('reviewing')}
              >
                Start review
              </Button>
            ) : (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: T.paper, border: `1px solid ${T.lineSoft}` }}>
                <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>All caught up!</div>
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 3 }}>
                  Capture more items to generate new cards.
                </div>
                <Link href="/capture" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12.5, color: T.crimson, fontWeight: 600, textDecoration: 'none' }}>
                  <Icon name="capture" size={13} color={T.crimson} strokeWidth={2} />
                  Go to Capture
                </Link>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Saved items */}
      {savedItems.length > 0 && (
        <div>
          <SectionHead title="Your notebook" action={`${savedItems.length} shown`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedItems.map(item => {
              const tc = typeColor(item.type)
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', background: T.paperHi,
                  border: `1px solid ${T.lineSoft}`, borderRadius: 12,
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
                    <span style={{ fontSize: 11.5, color: T.inkSoft, display: 'block', marginTop: 2 }}>
                      {item.language}{item.dialect ? ` · ${item.dialect}` : ''}
                    </span>
                  </div>
                  <span style={{
                    padding: '2px 7px', borderRadius: 999,
                    background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                    fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                  }}>
                    {item.type}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty notebook state */}
      {!loading && savedItems.length === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14 }}>
          <div style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>Nothing in your notebook yet.</div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>Captured items become flashcards automatically.</div>
          <Link href="/capture" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 12.5, color: T.crimson, fontWeight: 600, textDecoration: 'none' }}>
            <Icon name="capture" size={13} color={T.crimson} strokeWidth={2} />
            Start capturing
          </Link>
        </div>
      )}
    </div>
  )
}
