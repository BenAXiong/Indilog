'use client'

import { useRef } from 'react'
import type { TouchEvent } from 'react'

const THRESH = 70

type SwipeActions = {
  onEasy:    () => void
  onSuspend: () => void
  onAgain?:  () => void
  onGood?:   () => void
  onNext?:   () => void   // learn: right-swipe during pre-expose phase
  onReveal?: () => void   // review: tiny-movement tap when not revealed
}

export function useSwipeGesture({
  flying, setDrag, revealed, exposureDone,
  onEasy, onSuspend, onAgain, onGood, onNext, onReveal,
}: SwipeActions & {
  flying:        boolean
  setDrag:       (v: { x: number; y: number } | null) => void
  revealed:      boolean
  exposureDone?: boolean  // undefined = review mode (no exposure phase)
}) {
  const swipeStart = useRef({ x: 0, y: 0 })

  function onTouchStart(e: TouchEvent) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function onTouchMove(e: TouchEvent) {
    if (flying) return
    const dx = e.touches[0].clientX - swipeStart.current.x
    const dy = e.touches[0].clientY - swipeStart.current.y
    setDrag({ x: dx, y: dy })
  }

  function onTouchEnd(e: TouchEvent) {
    const dx   = e.changedTouches[0].clientX - swipeStart.current.x
    const dy   = e.changedTouches[0].clientY - swipeStart.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    setDrag(null)

    if (exposureDone === undefined) {
      // Review mode
      if (!revealed) {
        if (absX < 10 && absY < 10) { onReveal?.(); return }
        if (absY > absX && absY > THRESH) {
          if (dy < 0) onEasy(); else onSuspend()
        }
        return
      }
      if (absX > absY && absX > THRESH) { if (dx < 0) onAgain?.(); else onGood?.() }
      else if (absY > absX && absY > THRESH) { if (dy < 0) onEasy(); else onSuspend() }
      return
    }

    // Learn mode
    if (!exposureDone) {
      if (absX > absY && absX > THRESH && dx > 0) onNext?.()
      else if (absY > absX && absY > THRESH) {
        if (dy < 0) onEasy(); else onSuspend()
      }
      return
    }
    if (!revealed) {
      if (absY > absX && absY > THRESH) {
        if (dy < 0) onEasy(); else onSuspend()
      }
      return
    }
    if (absX > absY && absX > THRESH) { if (dx < 0) onAgain?.(); else onGood?.() }
    else if (absY > absX && absY > THRESH) { if (dy < 0) onEasy(); else onSuspend() }
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
