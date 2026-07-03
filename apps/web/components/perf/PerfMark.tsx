'use client'

import { useEffect, useRef } from 'react'
import { flowDone } from '@/lib/perf/flow'

// Fires flowDone(flow) when `when` turns true, and again whenever `signal`
// changes while `when` is true. The signal matters when content swaps faster
// than the loading state can commit a false frame (e.g. pack-served lessons):
// without it, back-to-back loads produce no false→true transition to observe.
export default function PerfMark({ flow, when = true, signal, meta }: {
  flow: string
  when?: boolean
  signal?: string
  meta?: Record<string, unknown>
}) {
  const prev = useRef(false)
  const firedSignal = useRef<string | undefined>(undefined)
  const metaRef = useRef(meta)
  metaRef.current = meta
  useEffect(() => {
    const rose = when && !prev.current
    const signalChanged = when && signal !== undefined && signal !== firedSignal.current
    if (rose || signalChanged) {
      flowDone(flow, metaRef.current)
      firedSignal.current = signal
    }
    prev.current = when
  }, [when, flow, signal])
  return null
}
