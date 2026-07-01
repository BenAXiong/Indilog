'use client'

import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { FlagPicker } from '@/components/study/FlagPicker'
import { SwipeOverlay, computeSwipePhysics } from '@/components/study/SwipeOverlay'
import { CardFront, type CardMode } from '@/components/study/CardContent'
import type { FlashcardWithItem } from '@/lib/db/srs/flashcards'
import type { TouchEvent, ReactNode } from 'react'

type SideLabel = { color: string; label: string } | null

type SessionCardProps = {
  card:          FlashcardWithItem
  effectiveMode: CardMode
  targetWord:    string | null
  playAudio:     (url: string) => void
  // swipe physics
  drag:       { x: number; y: number } | null
  gradingFly: { x: number; y: number; color: string; label: string; opacity?: number } | null
  entering:   boolean
  onTouchStart: (e: TouchEvent) => void
  onTouchMove:  (e: TouchEvent) => void
  onTouchEnd:   (e: TouchEvent) => void
  onClick:      () => void
  cursor?:      string
  // SwipeOverlay
  horizontalLabels: { left: SideLabel; right: SideLabel } | null
  // ← again / → good side arrows inside the card (shown after reveal)
  showSideHints: boolean
  // flag + suspend
  cardFlags:     Record<string, string | null>
  onSuspend:     () => void
  showFlagPicker: boolean
  onFlagToggle:  () => void
  onFlagSelect:  (color: string | null) => void
  // back content slot — caller renders CardBack or placeholder
  backContent:   ReactNode
  borderColor?:  string
}

export function SessionCard({
  card, effectiveMode, targetWord, playAudio,
  drag, gradingFly, entering,
  onTouchStart, onTouchMove, onTouchEnd, onClick, cursor = 'pointer',
  horizontalLabels, showSideHints,
  cardFlags, onSuspend, showFlagPicker, onFlagToggle, onFlagSelect,
  backContent, borderColor = T.lineSoft,
}: SessionCardProps) {
  const { transform, transition, opacity } = computeSwipePhysics(drag, gradingFly, entering)
  const currentFlag = card.id in cardFlags ? cardFlags[card.id] : (card.flag_color ?? null)

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      style={{
        position: 'relative', background: T.paperHi, borderRadius: 22,
        border: `1px solid ${borderColor}`,
        padding: '26px 22px', minHeight: 280,
        display: 'flex', flexDirection: 'column', cursor,
        touchAction: 'none',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(80,40,20,0.05), 0 16px 36px rgba(80,40,20,0.1)',
        transform, transition, opacity,
        willChange: 'transform',
      }}
    >
      <SwipeOverlay drag={drag} gradingFly={gradingFly} horizontalLabels={horizontalLabels} />

      <FlagPicker
        currentFlag={currentFlag}
        showPicker={showFlagPicker}
        onToggle={onFlagToggle}
        onSelect={onFlagSelect}
      />

      {/* Top-left: suspend */}
      <div style={{ position: 'absolute', top: 10, left: 12 }} onClick={e => e.stopPropagation()}>
        <button onClick={onSuspend} aria-label="Suspend card" style={{
          width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkFaint,
        }}>
          <Icon name="pause" size={15} strokeWidth={1.8} />
        </button>
      </div>

      {/* Side hints — shown after reveal */}
      {showSideHints && (
        <>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.crimson, opacity: 0.65 }}>
            <Icon name="arrow-l" size={17} strokeWidth={2} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>again</span>
          </div>
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: T.sage, opacity: 0.65 }}>
            <Icon name="arrow-r" size={17} strokeWidth={2} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', writingMode: 'vertical-rl' }}>good</span>
          </div>
        </>
      )}

      {/* Front — anchored above divider */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', padding: '0 24px 16px' }}>
        <CardFront card={card} effectiveMode={effectiveMode} targetWord={targetWord} playAudio={playAudio} />
      </div>

      {/* Divider — always at vertical center */}
      <div style={{ height: 1, background: T.lineSoft, flexShrink: 0 }} />

      {/* Back content slot */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center', paddingTop: 16 }}>
        {backContent}
      </div>
    </div>
  )
}
