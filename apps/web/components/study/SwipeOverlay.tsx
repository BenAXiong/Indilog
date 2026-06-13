import { type CSSProperties } from 'react'
import { T } from '@/lib/tokens'

type DragState  = { x: number; y: number }
type FlyState   = { x: number; y: number; color: string; label: string; opacity?: number }
type SideLabel  = { color: string; label: string } | null

// ─── computeSwipePhysics ──────────────────────────────────────────────────────

export function computeSwipePhysics(
  drag:       DragState | null,
  gradingFly: FlyState  | null,
  entering:   boolean,
): { transform: string; transition: string; opacity: number } {
  const dx  = drag?.x ?? gradingFly?.x ?? 0
  const dy  = drag?.y ?? gradingFly?.y ?? 0
  const rot = Math.max(-15, Math.min(15, dx * 0.04))

  const transform = (drag || gradingFly)
    ? `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
    : entering ? 'translateY(70px)' : 'translate(0px,0px) rotate(0deg)'

  const transition = drag
    ? 'none'
    : gradingFly
    ? gradingFly.opacity === 0
      ? 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease-out'
      : 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s ease'
    : entering
    ? 'none'
    : 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease-out'

  const opacity = gradingFly ? (gradingFly.opacity ?? 0.5) : entering ? 0 : 1

  return { transform, transition, opacity }
}

export function SwipeOverlay({
  drag,
  gradingFly,
  horizontalLabels,
}: {
  drag:             DragState | null
  gradingFly:       FlyState  | null
  // null = suppress horizontal labels entirely; per-side null = suppress that direction
  horizontalLabels: { left: SideLabel; right: SideLabel } | null
}) {
  if (!drag && !gradingFly) return null

  const dx   = drag?.x ?? gradingFly?.x ?? 0
  const dy   = drag?.y ?? gradingFly?.y ?? 0
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  let color = '', label = ''
  if (gradingFly) {
    color = gradingFly.color
    label = gradingFly.label
  } else if (absX > absY && horizontalLabels) {
    const side = dx > 0 ? horizontalLabels.right : horizontalLabels.left
    if (side) { color = side.color; label = side.label }
  } else if (absY >= absX) {
    color = dy < 0 ? T.amber : T.inkSoft
    label = dy < 0 ? 'EASY' : 'PAUSE'
  }
  if (!color) return null

  const intensity = gradingFly ? 1 : Math.min(Math.max(absX, absY) / 90, 1)
  const isH = absX >= absY
  const stampPos: CSSProperties = isH
    ? (dx > 0
      ? { top: 20, left: 20, transform: 'rotate(-10deg)' }
      : { top: 20, right: 20, transform: 'rotate(10deg)' })
    : (dy < 0
      ? { bottom: 20, left: '50%', transform: 'translateX(-50%)' }
      : { top: 20, left: '50%', transform: 'translateX(-50%)' })

  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 22, pointerEvents: 'none', zIndex: 5,
        background: color, opacity: intensity * 0.22,
      }} />
      {intensity > 0.15 && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 6,
          opacity: Math.min((intensity - 0.15) / 0.35, 1),
          ...stampPos,
        }}>
          <span style={{
            display: 'block', fontFamily: '"JetBrains Mono", monospace',
            fontSize: 18, fontWeight: 800, letterSpacing: '0.1em',
            color, border: `2.5px solid ${color}`, borderRadius: 6, padding: '3px 10px',
          }}>{label}</span>
        </div>
      )}
    </>
  )
}
