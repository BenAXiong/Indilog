'use client'

import { useState, useEffect } from 'react'
import {
  perfEnabled, setPerfEnabled, getStep, setStep,
  readLog, clearLog, onPerfLog, installClickListener, type PerfSample,
} from '@/lib/perf/flow'

// Floating perf readout, activated with ?perf=1 (deactivated with ?perf=0).
// Shows click→paint timings recorded via PerfMark/flowDone; samples also
// upload to ind_perf_samples. See docs/perf-plan.md for the test protocol.
export default function PerfHUD() {
  const [enabled,  setEnabled]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [samples,  setSamples]  = useState<PerfSample[]>([])
  const [stepTag,  setStepTag]  = useState('S0')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('perf')
    if (q === '1') setPerfEnabled(true)
    if (q === '0') setPerfEnabled(false)
    if (!perfEnabled()) return
    setEnabled(true)
    setStepTag(getStep())
    setSamples(readLog())
    const uninstall = installClickListener()
    const unsub = onPerfLog(() => setSamples(readLog()))
    return () => { uninstall(); unsub() }
  }, [])

  if (!enabled) return null

  const last = samples[samples.length - 1]
  const recent = samples.slice(-20).reverse()

  return (
    <div style={{ position: 'fixed', right: 10, bottom: 118, zIndex: 95, fontFamily: '"JetBrains Mono", monospace' }}>
      {open && (
        <div style={{
          marginBottom: 8, width: 250, maxHeight: 320, overflowY: 'auto',
          background: 'rgba(20,18,14,0.92)', color: '#e8e2d4', borderRadius: 12,
          padding: 10, fontSize: 10.5, boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ opacity: 0.6 }}>step</span>
            <input
              value={stepTag}
              onChange={e => { setStepTag(e.target.value); setStep(e.target.value) }}
              style={{
                width: 44, background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: 'none', borderRadius: 5, padding: '2px 5px', fontSize: 10.5,
                fontFamily: 'inherit',
              }}
            />
            <span style={{ opacity: 0.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {process.env.NEXT_PUBLIC_BUILD_TIME}
            </span>
          </div>
          {recent.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0', borderTop: i ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.flow}</span>
              <span style={{ fontWeight: 700, color: s.ms < 300 ? '#9fd48a' : s.ms < 800 ? '#e8c46a' : '#e88a6a' }}>
                {s.ms}
              </span>
            </div>
          ))}
          {!recent.length && <div style={{ opacity: 0.5 }}>no samples yet — tap around</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <HudBtn label="copy" onClick={() => navigator.clipboard?.writeText(JSON.stringify(samples, null, 1))} />
            <HudBtn label="clear" onClick={() => { clearLog(); setSamples([]) }} />
            <HudBtn label="off" onClick={() => { setPerfEnabled(false); setEnabled(false) }} />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'rgba(20,18,14,0.88)', color: '#e8e2d4',
          fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
          boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
        }}
      >
        {last ? `${last.flow.replace(/^cold:/, '❄')} ${last.ms}ms` : 'perf'}
      </button>
    </div>
  )
}

function HudBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
      background: 'rgba(255,255,255,0.12)', color: '#e8e2d4', fontSize: 10,
      fontFamily: 'inherit',
    }}>{label}</button>
  )
}
