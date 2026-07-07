import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { cardAudio, type FlashcardWithItem } from '@/lib/db/srs/flashcards'

export type CardMode = 'forward' | 'reverse' | 'audio' | 'sts'

// ─── resolveEffectiveMode ─────────────────────────────────────────────────────

export function resolveEffectiveMode(
  reviewMode: string,
  targetWord: string | null,
  hasZh:      boolean,
  hasAudio:   boolean,
): CardMode {
  if (reviewMode === 'sts'   && targetWord) return 'sts'
  if (reviewMode === 'audio' && hasAudio)   return 'audio'
  // fallbacks chain: sts/audio degrade to reverse, which itself needs zh —
  // otherwise a zh-less card would show '—' as the prompt
  if ((reviewMode === 'sts' || reviewMode === 'audio' || reviewMode === 'reverse') && hasZh) return 'reverse'
  return 'forward'
}

// ─── renderHighlighted ────────────────────────────────────────────────────────

export function renderHighlighted(sentence: string, target: string) {
  if (!target || !sentence) return sentence
  const idx = sentence.toLowerCase().indexOf(target.toLowerCase())
  if (idx === -1) return sentence
  return (
    <>
      {sentence.slice(0, idx)}
      <mark style={{ background: 'rgba(213,155,64,0.18)', color: T.amber, borderRadius: 3, padding: '0 2px', fontStyle: 'normal' }}>
        {sentence.slice(idx, idx + target.length)}
      </mark>
      {sentence.slice(idx + target.length)}
    </>
  )
}

// ─── CardFront ────────────────────────────────────────────────────────────────

export function CardFront({
  card,
  effectiveMode,
  targetWord,
  playAudio,
}: {
  card:         FlashcardWithItem
  effectiveMode: CardMode
  targetWord:   string | null
  playAudio:    (url: string) => void
}) {
  if (effectiveMode === 'audio') {
    return (
      <button
        onClick={e => { e.stopPropagation(); playAudio(cardAudio(card)!) }}
        aria-label="Play audio"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 64, height: 64, borderRadius: 999,
          background: T.crimson, border: 'none', cursor: 'pointer', color: '#fff',
          boxShadow: '0 2px 14px rgba(180,40,30,0.22)',
        }}
      >
        <Icon name="speaker" size={26} strokeWidth={1.6} />
      </button>
    )
  }
  if (effectiveMode === 'sts') {
    return (
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.5 }}>
        {renderHighlighted(card.ind_items?.ab ?? '', targetWord ?? '')}
      </div>
    )
  }
  if (effectiveMode === 'reverse') {
    return (
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
        {card.ind_items?.zh ?? '—'}
      </div>
    )
  }
  // forward
  return (
    <>
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.22 }}>
        {card.ind_items?.ab}
      </div>
      {cardAudio(card) && (
        <button
          onClick={e => { e.stopPropagation(); playAudio(cardAudio(card)!) }}
          aria-label="Play audio"
          style={{
            marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 999, flexShrink: 0,
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            cursor: 'pointer', color: T.inkSoft,
          }}
        >
          <Icon name="speaker" size={14} strokeWidth={1.8} />
        </button>
      )}
    </>
  )
}

// ─── CardBack ─────────────────────────────────────────────────────────────────

export function CardBack({
  card,
  effectiveMode,
}: {
  card:          FlashcardWithItem
  effectiveMode: CardMode
}) {
  if (effectiveMode === 'audio') {
    return (
      <>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 400, color: T.inkSoft, letterSpacing: '-0.01em', marginBottom: 6 }}>
          {card.ind_items?.ab}
        </div>
        <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          {card.ind_items?.zh ?? '—'}
        </div>
      </>
    )
  }
  if (effectiveMode === 'reverse') {
    return (
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 26, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
        {card.ind_items?.ab}
      </div>
    )
  }
  // forward + sts → zh
  return (
    <div style={{ fontSize: 19, fontWeight: 500, color: T.ink, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
      {card.ind_items?.zh ?? '—'}
    </div>
  )
}
