'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Chip, Icon, Button } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { ACTIVE_LANG, REVIEW_CARDS, DIALOGUES } from '@/lib/mock-data'

type ReviewKind = 'comp' | 'expr' | 'dialogue'

// ─── Review Session ───────────────────────────────────────────
function ReviewSession({ kind, onExit }: { kind: ReviewKind; onExit: () => void }) {
  const lang = ACTIVE_LANG
  const [revealed, setRevealed] = useState(false)
  const [cardIdx, setCardIdx] = useState(0)
  const [flipping, setFlipping] = useState(false)

  const card = REVIEW_CARDS[cardIdx % REVIEW_CARDS.length]
  const total = kind === 'comp' ? 8 : kind === 'expr' ? 4 : 10
  const kindLabel = kind === 'comp' ? 'Comprehension' : kind === 'expr' ? 'Expression' : 'Dialogue drill'
  const kindTone  = kind === 'comp' ? T.crimson : kind === 'expr' ? T.sageDp : T.terra

  const ratings = [
    { id: 'again', label: 'Again', sub: '<10m', color: T.crimson },
    { id: 'hard',  label: 'Hard',  sub: '1d',   color: T.terra },
    { id: 'good',  label: 'Good',  sub: '3d',   color: T.sage },
    { id: 'easy',  label: 'Easy',  sub: '7d',   color: T.amber },
  ]

  const handleRate = () => {
    setFlipping(true)
    setTimeout(() => {
      setRevealed(false)
      setCardIdx(i => i + 1)
      setFlipping(false)
    }, 300)
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <button onClick={onExit} aria-label="Back to review" style={{
          width: 36, height: 36, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="arrow-l" size={17} strokeWidth={1.8} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: kindTone,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            {kindLabel}
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>
            {lang.name}{lang.dialect ? ` · ${lang.dialect}` : ''}
          </div>
        </div>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute,
          textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
        }}>
          {(cardIdx % REVIEW_CARDS.length) + 1} / {total}
        </span>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: i < cardIdx ? T.sage : i === cardIdx ? kindTone : T.lineSoft,
            transition: 'background .3s',
          }} />
        ))}
      </div>

      {/* Flashcard */}
      <div
        className={flipping ? 'animate-iv-flip' : ''}
        style={{
          background: T.paperHi, borderRadius: 22, padding: '24px 20px',
          border: `1px solid ${T.lineSoft}`, minHeight: 240,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 6px rgba(80,40,20,0.05), 0 12px 28px rgba(80,40,20,0.08)',
        }}
      >
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {card.pos}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
          <div>
            <div style={{
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: 38, fontWeight: 500, color: T.ink,
              letterSpacing: '-0.025em', lineHeight: 1.1,
            }}>
              {kind === 'expr' && !revealed
                ? <span style={{ fontStyle: 'italic', color: T.inkSoft }}>{card.back}</span>
                : card.front
              }
            </div>
            <button style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px 6px 8px', borderRadius: 999, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft, fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
            }}>
              <Icon name="speaker" size={13} strokeWidth={1.8} />
              Hear it
            </button>
          </div>

          {revealed ? (
            <div className="animate-iv-rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 1, background: T.lineSoft }} />
              <div style={{ fontSize: 17, fontWeight: 500, color: T.ink, lineHeight: 1.3 }}>
                {kind === 'expr' ? card.front : card.back}
              </div>
              <div style={{
                padding: '10px 12px', background: T.paper, borderRadius: 10,
                borderLeft: `2.5px solid ${kindTone}`,
              }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 14, fontStyle: 'italic', color: T.ink, lineHeight: 1.35 }}>
                  {card.ex}
                </div>
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
          {ratings.map((r) => (
            <button
              key={r.id} onClick={handleRate}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '10px 4px', borderRadius: 12,
                background: T.paperHi, border: `1.5px solid ${r.color}`,
                color: r.color, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = r.color; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.paperHi; (e.currentTarget as HTMLButtonElement).style.color = r.color }}
            >
              <span style={{ fontSize: 12.5 }}>{r.label}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, opacity: 0.7, fontWeight: 500 }}>
                {r.sub}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Review Landing ───────────────────────────────────────────
export default function ReviewPage() {
  const lang = ACTIVE_LANG
  const [mode, setMode] = useState<'landing' | 'reviewing'>('landing')
  const [reviewKind, setReviewKind] = useState<ReviewKind>('comp')

  if (mode === 'reviewing') {
    return <ReviewSession kind={reviewKind} onExit={() => setMode('landing')} />
  }

  const startOptions = [
    {
      id: 'comp' as ReviewKind, label: 'Comprehension', sub: 'See the meaning — say the sentence',
      due: 8, icon: 'dict' as const, tone: T.crimson, bg: T.crimsonBg, border: '#EFCAB8',
    },
    {
      id: 'expr' as ReviewKind, label: 'Expression', sub: 'Hear the sentence — guess the sentence',
      due: 4, icon: 'mic' as const, tone: T.sageDp, bg: T.sageBg, border: '#D2D8AE',
    },
  ]

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ScreenHeader title="Review" langName={lang.name} langDialect={lang.dialect} />

      {/* Due today card */}
      <Card raised pad={16}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            Due today
          </span>
          <Chip size="sm" tone="amber" icon="flame">8 / 20 done</Chip>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 8 }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 38, fontWeight: 600, color: T.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
            12
          </span>
          <span style={{ fontSize: 14, color: T.inkSoft }}>cards · ~6 min</span>
        </div>
        <div style={{ height: 6, background: T.lineSoft, borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
          <div style={{
            width: '40%', height: '100%',
            background: `linear-gradient(90deg, ${T.amber}, ${T.terra}, ${T.crimson})`,
            borderRadius: 999,
          }} />
        </div>
      </Card>

      {/* Start review */}
      <div>
        <SectionHead title="Start review" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {startOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setReviewKind(opt.id); setMode('reviewing') }}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '16px 14px 14px', borderRadius: 16,
                background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                textAlign: 'left', position: 'relative', overflow: 'hidden',
                boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04), 0 4px 12px rgba(80,40,20,0.05)',
                cursor: 'pointer', transition: 'transform .12s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: opt.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: opt.tone, marginBottom: 8, border: `1px solid ${opt.border}`,
              }}>
                <Icon name={opt.icon} size={17} strokeWidth={1.8} />
              </div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 17, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.3 }}>{opt.sub}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                  color: opt.tone, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
                }}>
                  {opt.due} due
                </span>
                <div style={{
                  width: 26, height: 26, borderRadius: 999, background: opt.tone,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="play" size={10} color="#fff" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dialogue drill */}
      <div>
        <SectionHead title="Dialogue drill" action="See all" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DIALOGUES.map((d) => (
            <button
              key={d.id}
              onClick={() => { setReviewKind('dialogue'); setMode('reviewing') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 14px', borderRadius: 14,
                background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                textAlign: 'left', width: '100%', cursor: 'pointer',
                boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(80,40,20,0.03)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: d.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: d.color, flexShrink: 0,
              }}>
                <Icon name="speaker" size={18} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em' }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{d.sub}</div>
              </div>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute,
                textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
              }}>
                {d.phrases} phrases
              </span>
              <Icon name="chevron" size={14} color={T.inkFaint} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
