'use client'

import { useState, useEffect } from 'react'

export function useEnteringAnimation(qIdx: number): boolean {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    setEntering(true)
    let cancelled = false
    requestAnimationFrame(() => { requestAnimationFrame(() => { if (!cancelled) setEntering(false) }) })
    return () => { cancelled = true }
  }, [qIdx])
  return entering
}
