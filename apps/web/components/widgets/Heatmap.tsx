'use client'

import { useState, useRef, useEffect } from 'react'
import { T } from '@/lib/tokens'

const INTENSITY = [
  '#F5EFE9',  // 0 – near-white
  '#F8DECE',  // 1 – ≥1
  '#F2C4A8',  // 2 – ≥5
  '#E5A88E',  // 3 – ≥10
  '#D4825E',  // 4 – ≥20
  '#C66848',  // 5 – ≥40
  '#B05030',  // 6 – ≥60
  '#943418',  // 7 – ≥80
  '#782008',  // 8 – ≥100
  '#580C02',  // 9 – ≥200
]

function cellDate(wi: number, di: number): Date {
  const daysAgo = 139 - (wi * 7 + di)
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d
}

function yymmdd(d: Date): string {
  return String(d.getFullYear()).slice(2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
}

type TooltipState = { x: number; y: number; cw: number; wi: number; di: number }

export default function Heatmap({ heatmap, heatmapCounts, daysStudied, dailyAverage }: Readonly<{
  heatmap: number[][]
  heatmapCounts: { r: number; l: number }[][]
  daysStudied: number
  dailyAverage: number
}>) {
  const weeks = heatmap.length
  const containerRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TooltipState | null>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTip(null)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleCell(e: React.MouseEvent<HTMLButtonElement>, wi: number, di: number) {
    if (tip?.wi === wi && tip?.di === di) { setTip(null); return }
    const cell = e.currentTarget.getBoundingClientRect()
    const cont = containerRef.current?.getBoundingClientRect()
    if (!cont) return
    setTip({
      x: cell.left - cont.left + cell.width / 2,
      y: cell.top  - cont.top,
      cw: cont.width,
      wi, di,
    })
  }

  const tipDate = tip ? cellDate(tip.wi, tip.di) : null
  const tipData = tip ? (heatmapCounts[tip.wi]?.[tip.di] ?? { r: 0, l: 0 }) : null

  const statStyle = { fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.025em' } as const
  const labelStyle = { fontSize: 12, color: T.inkSoft, marginLeft: 4 } as const

  return (
    <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <span style={statStyle}>{dailyAverage}</span>
          <span style={labelStyle}>avg reps / day</span>
        </div>
        <div>
          <span style={statStyle}>{daysStudied}</span>
          <span style={labelStyle}>days studied</span>
        </div>
      </div>

      <div ref={containerRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {heatmap.map((week, wi) => {
              const weekKey = 139 - wi * 7
              return (
                <div key={weekKey} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {week.map((lvl, di) => {
                    const dayKey     = 139 - (wi * 7 + di)
                    const isToday    = wi === weeks - 1 && di === 6
                    const isSelected = tip?.wi === wi && tip?.di === di
                    let border: string
                    if (isSelected)  border = `1.5px solid ${T.ink}`
                    else if (lvl === 0) border = `1px solid ${T.line}`
                    else             border = 'none'
                    return (
                      <button
                        key={dayKey}
                        onClick={e => handleCell(e, wi, di)}
                        style={{
                          width: 14, height: 14, borderRadius: 3.5,
                          background: INTENSITY[lvl],
                          border,
                          boxShadow: isToday ? `0 0 0 1.5px ${T.crimson}` : 'none',
                          cursor: 'pointer', padding: 0, flexShrink: 0,
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {tip && tipDate && tipData && (
          <div style={{
            position: 'absolute',
            top: tip.y - 90,
            left: Math.max(60, Math.min(tip.cw - 60, tip.x)),
            transform: 'translateX(-50%)',
            background: T.ink,
            color: '#fff',
            borderRadius: 8,
            padding: '7px 10px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            lineHeight: 1.7,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{yymmdd(tipDate)}</div>
            <div>Total: {tipData.r + tipData.l}</div>
            <div>Learned: {tipData.l}</div>
            <div>Reviewed: {tipData.r}</div>
          </div>
        )}
      </div>
    </div>
  )
}
