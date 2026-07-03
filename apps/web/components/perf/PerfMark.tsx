'use client'

import { useEffect, useRef } from 'react'
import { flowDone } from '@/lib/perf/flow'

// Fires flowDone(flow) on each false→true transition of `when`
// (re-fires after `when` cycles back through false, e.g. next-lesson loads).
export default function PerfMark({ flow, when = true, meta }: {
  flow: string
  when?: boolean
  meta?: Record<string, unknown>
}) {
  const prev = useRef(false)
  const metaRef = useRef(meta)
  metaRef.current = meta
  useEffect(() => {
    if (when && !prev.current) flowDone(flow, metaRef.current)
    prev.current = when
  }, [when, flow])
  return null
}
