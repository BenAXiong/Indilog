'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import {
  GRMPTS_LEVEL_NAMES, LESSON_DIFFICULTIES, ESSAY_GROUP_LABELS, ESSAY_GROUP_START,
} from '@/lib/lang/dialects'

type Source = 'twelve' | 'grmpts' | 'essay' | 'dialogue' | 'con_practice'

type TwelveGeo = {
  levels: string[]
  classes: number[]
  titles: Record<string, Record<string, string>>
}
type GrmptsGeo = {
  levels: string[]
  counts: Record<string, Record<string, number>>
  labels: Record<string, string>
}
type EssayGeo = {
  items: Array<{ index: number; title_zh: string; available: boolean }>
}

type Props = {
  open: boolean
  onClose: () => void
  sourceName: string
  completions: Set<string>
} & (
  | {
      source: 'twelve'
      glid: string
      currentLevel: string
      currentLesson: string
      onSelect: (level: string, lesson: string) => void
    }
  | {
      source: 'grmpts'
      glid: string
      currentLevel: string
      currentPattern: string
      onSelect: (level: string, pattern: string) => void
    }
  | {
      source: 'essay' | 'dialogue' | 'con_practice'
      dialect: string
      currentTitleZh: string
      onSelect: (titleZh: string) => void
    }
)

const SOURCE_LABELS: Record<Source, string> = {
  twelve: 'Lessons', grmpts: 'Patterns', essay: 'Essays', dialogue: 'Dialogs', con_practice: 'Conversations',
}

const numSort = (a: string, b: string) => Number.parseInt(a.slice(1)) - Number.parseInt(b.slice(1))

export default function ContentSheet(props: Props) {
  const { open, onClose, completions } = props

  const [twelveGeo, setTwelveGeo] = useState<TwelveGeo | null>(null)
  const [grmptsGeo, setGrmptsGeo] = useState<GrmptsGeo | null>(null)
  const [essayGeo,  setEssayGeo]  = useState<EssayGeo  | null>(null)

  const [activeLevel, setActiveLevel] = useState(
    props.source === 'twelve' ? props.currentLevel :
    props.source === 'grmpts' ? props.currentLevel : '0',
  )
  const [activeGroup, setActiveGroup] = useState(0)

  useEffect(() => {
    if (!open) return
    if (props.source === 'twelve' && !twelveGeo) {
      fetch('/api/learn/geometry?source=twelve')
        .then(r => r.json()).then(setTwelveGeo).catch(() => {})
    }
    if (props.source === 'grmpts' && !grmptsGeo) {
      fetch(`/api/learn/geometry?source=grmpts&glid=${props.glid}`)
        .then(r => r.json()).then(setGrmptsGeo).catch(() => {})
    }
    if ((props.source === 'essay' || props.source === 'dialogue' || props.source === 'con_practice') && !essayGeo) {
      const d = (props as { source: 'essay' | 'dialogue' | 'con_practice'; dialect: string }).dialect
      fetch(`/api/learn/geometry?source=${props.source}&dialect=${encodeURIComponent(d)}`)
        .then(r => r.json()).then(setEssayGeo).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, props.source])

  if (!open) return null

  const name = SOURCE_LABELS[props.source] || props.source

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(30,18,10,0.35)', zIndex: 70,
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '77dvh', background: T.paper,
        borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`,
        zIndex: 71, display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 0',
        }}>
          <span style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 18, fontWeight: 500, color: T.ink,
          }}>{name}</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 999,
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.inkMute,
          }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={{ height: 1, background: T.lineSoft, margin: '10px 18px 0' }} />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {props.source === 'twelve' && (
            <TwelveContent
              geo={twelveGeo}
              currentLevel={props.currentLevel}
              currentLesson={props.currentLesson}
              activeLevel={activeLevel}
              setActiveLevel={setActiveLevel}
              completions={completions}
              onSelect={(l, s) => { props.onSelect(l, s); onClose() }}
            />
          )}
          {props.source === 'grmpts' && (
            <GrmptsContent
              geo={grmptsGeo}
              currentLevel={props.currentLevel}
              currentPattern={props.currentPattern}
              activeLevel={activeLevel}
              setActiveLevel={setActiveLevel}
              completions={completions}
              onSelect={(l, p) => { props.onSelect(l, p); onClose() }}
            />
          )}
          {(props.source === 'essay' || props.source === 'dialogue' || props.source === 'con_practice') && (
            <EssayContent
              source={props.source}
              geo={essayGeo}
              currentTitleZh={props.currentTitleZh}
              activeGroup={activeGroup}
              setActiveGroup={setActiveGroup}
              completions={completions}
              onSelect={titleZh => { props.onSelect(titleZh); onClose() }}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ── Lessons ───────────────────────────────────────────────────────────────────
function TwelveContent(p: {
  geo: TwelveGeo | null
  currentLevel: string; currentLesson: string
  activeLevel: string; setActiveLevel: (l: string) => void
  completions: Set<string>
  onSelect: (level: string, lesson: string) => void
}) {
  if (!p.geo) return <div style={loadingStyle}>Loading…</div>

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* 12-col grid: difficulty labels (span 3) + stage buttons (1 each) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)',
        columnGap: 4, padding: '10px 18px 0', flexShrink: 0,
      }}>
        {/* Row 1 — difficulty labels, each spanning 3 stage columns */}
        {LESSON_DIFFICULTIES.map(d => (
          <div key={d.name} style={{
            gridColumn: 'span 3', textAlign: 'center',
            fontSize: 10, fontWeight: 700, color: T.inkMute,
            fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em',
            padding: '3px 4px 5px', borderRadius: 6,
            border: `1px solid ${T.lineSoft}`,
          }}>
            {d.name}
          </div>
        ))}
        {/* Row 2 — stage buttons, 1 per column */}
        {p.geo.levels.map(lv => {
          const active = p.activeLevel === lv
          return (
            <button key={lv} onClick={() => p.setActiveLevel(lv)} style={{
              height: 28, borderRadius: 5, padding: 0,
              background: active ? T.crimson : T.paperHi,
              border: `1px solid ${active ? T.crimsonDp : T.line}`,
              color: active ? '#fff' : T.inkSoft,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {lv}
            </button>
          )
        })}
      </div>

      <div style={{ height: 1, background: T.lineSoft, margin: '8px 18px 0', flexShrink: 0 }} />

      {/* Lesson grid — 2 columns of 5 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {p.geo.classes.map(cls => {
            const key       = `Level ${p.activeLevel} Lesson ${cls}`
            const done      = p.completions.has(key)
            const isCurrent = p.activeLevel === p.currentLevel && String(cls) === p.currentLesson
            const titleZh   = p.geo!.titles[p.activeLevel]?.[String(cls)] ?? ''
            return (
              <button
                key={cls}
                onClick={() => p.onSelect(p.activeLevel, String(cls))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 10px', borderRadius: 10,
                  background: isCurrent ? T.crimsonBg : T.paperHi,
                  border: `1.5px solid ${isCurrent ? T.crimson : T.lineSoft}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  position: 'relative', textAlign: 'left',
                }}
              >
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 26, fontWeight: 700, lineHeight: 1, flexShrink: 0,
                  color: isCurrent ? T.crimson : done ? T.inkFaint : T.ink,
                }}>
                  {cls}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: 13, lineHeight: 1.3, display: 'block',
                    color: T.inkFaint, minHeight: '1.2em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {/* aboriginal title — blank until scraped */}
                  </span>
                  <span style={{
                    fontSize: 13, lineHeight: 1.3, display: 'block',
                    color: isCurrent ? T.crimson : done ? T.inkFaint : T.inkSoft,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {titleZh}
                  </span>
                </div>
                {done && !isCurrent && (
                  <div style={{ position: 'absolute', top: 5, right: 7 }}>
                    <Icon name="check" size={10} strokeWidth={2.5} color={T.inkFaint} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Patterns ──────────────────────────────────────────────────────────────────
function GrmptsContent(p: {
  geo: GrmptsGeo | null
  currentLevel: string; currentPattern: string
  activeLevel: string; setActiveLevel: (l: string) => void
  completions: Set<string>
  onSelect: (level: string, pattern: string) => void
}) {
  if (!p.geo) return <div style={loadingStyle}>Loading…</div>

  const patternsAtLevel = Object.keys(p.geo.counts[p.activeLevel] ?? {}).sort(numSort)

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0' }}>
        {p.geo.levels.map(lv => (
          <button key={lv} onClick={() => p.setActiveLevel(lv)} style={tabStyle(p.activeLevel === lv)}>
            {GRMPTS_LEVEL_NAMES[lv] ?? lv}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {patternsAtLevel.map(pt => {
          const isCurrent = p.activeLevel === p.currentLevel && pt === p.currentPattern
          const done      = p.completions.has(`${p.activeLevel}::${pt}`)
          const label     = p.geo!.labels[pt] ?? pt
          const typeNum   = Number.parseInt(pt.slice(1))
          return (
            <button key={pt} onClick={() => p.onSelect(p.activeLevel, pt)} style={listItemStyle(isCurrent, done)}>
              <span style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 11, width: 22, flexShrink: 0, textAlign: 'right',
                color: isCurrent ? T.crimson : done ? T.inkFaint : T.inkMute,
              }}>{typeNum}</span>
              <span style={{ fontSize: 14, flex: 1, textAlign: 'left', color: isCurrent ? T.crimson : done ? T.inkFaint : T.ink }}>
                {label}
              </span>
              {done && <Icon name="check" size={13} strokeWidth={2.5} color={T.inkFaint} style={{ marginLeft: 'auto' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const CP_GROUP_LABELS = ['1–10', '11–20', '21–30']
const CP_GROUP_START  = [0, 10, 20]

// ── Essays / Dialogs / Conversations ─────────────────────────────────────────
function EssayContent(p: {
  source: 'essay' | 'dialogue' | 'con_practice'
  geo: EssayGeo | null
  currentTitleZh: string
  activeGroup: number; setActiveGroup: (g: number) => void
  completions: Set<string>
  onSelect: (titleZh: string) => void
}) {
  if (!p.geo) return <div style={loadingStyle}>Loading…</div>

  const groupLabels = p.source === 'con_practice' ? CP_GROUP_LABELS : ESSAY_GROUP_LABELS
  const groupStarts = p.source === 'con_practice' ? CP_GROUP_START  : ESSAY_GROUP_START
  const groupStart  = groupStarts[p.activeGroup]
  const groupEnd    = groupStarts[p.activeGroup + 1] ?? Infinity
  const itemsInGroup = p.geo.items.filter(i => i.index >= groupStart && i.index < groupEnd)

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0' }}>
        {groupLabels.map((lbl, i) => (
          <button key={lbl} onClick={() => p.setActiveGroup(i)} style={tabStyle(p.activeGroup === i)}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {itemsInGroup.map(item => {
          const isCurrent = item.title_zh === p.currentTitleZh
          const done      = p.completions.has(item.title_zh)
          return (
            <button
              key={item.index}
              onClick={item.available ? () => p.onSelect(item.title_zh) : undefined}
              disabled={!item.available}
              style={listItemStyle(isCurrent, done, !item.available)}
            >
              <span style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 11, width: 22, flexShrink: 0,
                textAlign: 'right', color: isCurrent ? T.crimson : done ? T.sage : T.inkFaint,
              }}>{item.index + 1}</span>
              <span style={{
                fontSize: 14, flex: 1, textAlign: 'left',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: !item.available ? T.inkFaint : isCurrent ? T.crimson : done ? T.inkSoft : T.ink,
              }}>{item.title_zh}</span>
              {done && (
                <Icon name="check" size={13} strokeWidth={2}
                  color={T.sage} style={{ flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const tabStyle = (active: boolean): React.CSSProperties => ({
  height: 32, minWidth: 36, padding: '0 12px', borderRadius: 8, flexShrink: 0,
  background: active ? T.crimson : T.paperHi,
  border: `1px solid ${active ? T.crimsonDp : T.line}`,
  color: active ? '#fff' : T.inkSoft,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
})

const listItemStyle = (current: boolean, done: boolean, disabled = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10,
  background: current ? T.crimsonBg : 'transparent',
  border: `1px solid ${current ? '#EFCAB8' : 'transparent'}`,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
  fontFamily: 'inherit', textAlign: 'left',
})

const loadingStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flex: 1, fontSize: 13, color: T.inkFaint, padding: 32,
}
