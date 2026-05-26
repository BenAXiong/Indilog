'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import Icon from '@/components/ui/Icon'
import { GRMPTS_LEVEL_NAMES } from '@/lib/learn/dialects'

type Source = 'twelve' | 'grmpts' | 'essay' | 'dialogue'

// ── Geometry response shapes ──────────────────────────────────────────────────
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

// ── Props (discriminated by source) ──────────────────────────────────────────
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
      source: 'essay' | 'dialogue'
      dialect: string
      currentTitleZh: string
      onSelect: (titleZh: string) => void
    }
)

const SOURCE_LABELS: Record<Source, string> = {
  twelve: 'Lessons', grmpts: 'Patterns', essay: 'Essays', dialogue: 'Dialogs',
}

export default function ContentSheet(props: Props) {
  const { open, onClose, completions } = props

  const [twelveGeo, setTwelveGeo]   = useState<TwelveGeo | null>(null)
  const [grmptsGeo, setGrmptsGeo]   = useState<GrmptsGeo | null>(null)
  const [essayGeo,  setEssayGeo]    = useState<EssayGeo  | null>(null)
  const [activeLevel, setActiveLevel] = useState(
    props.source === 'twelve' ? props.currentLevel :
    props.source === 'grmpts' ? props.currentLevel : '0',
  )

  // Fetch geometry when sheet opens
  useEffect(() => {
    if (!open) return
    if (props.source === 'twelve' && !twelveGeo) {
      fetch('/api/geometry?source=twelve')
        .then(r => r.json()).then(setTwelveGeo).catch(() => {})
    }
    if (props.source === 'grmpts' && !grmptsGeo) {
      fetch(`/api/geometry?source=grmpts&glid=${props.glid}`)
        .then(r => r.json()).then(setGrmptsGeo).catch(() => {})
    }
    if ((props.source === 'essay' || props.source === 'dialogue') && !essayGeo) {
      const d = (props as { source: 'essay' | 'dialogue'; dialect: string }).dialect
      fetch(`/api/geometry?source=${props.source}&dialect=${encodeURIComponent(d)}`)
        .then(r => r.json()).then(setEssayGeo).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, props.source])

  if (!open) return null

  const name = SOURCE_LABELS[props.source] || props.source

  // Group tabs for essays/dialogues
  const GROUP_LABELS = ['Intro', 'Intermediate', 'Advanced']
  const groupStart = [0, 20, 40]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(30,18,10,0.35)', zIndex: 70,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '62dvh', background: T.paper,
        borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`,
        zIndex: 71, display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
        </div>

        {/* Sheet header */}
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

        {/* Per-source content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* LESSONS */}
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

          {/* PATTERNS */}
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

          {/* ESSAYS / DIALOGS */}
          {(props.source === 'essay' || props.source === 'dialogue') && (
            <EssayContent
              geo={essayGeo}
              currentTitleZh={props.currentTitleZh}
              activeGroup={Number(activeLevel)}
              setActiveGroup={g => setActiveLevel(String(g))}
              completions={completions}
              groupLabels={GROUP_LABELS}
              groupStart={groupStart}
              onSelect={titleZh => { props.onSelect(titleZh); onClose() }}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ── Twelve (Lessons) ──────────────────────────────────────────────────────────
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
      {/* Level row */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0', overflowX: 'auto' }}>
        {p.geo.levels.map(lv => (
          <button key={lv} onClick={() => p.setActiveLevel(lv)} style={tabStyle(p.activeLevel === lv)}>
            {lv}
          </button>
        ))}
      </div>

      {/* Lesson grid — 5 columns */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {p.geo.classes.map(cls => {
            const key  = `Level ${p.activeLevel} Lesson ${cls}`
            const done = p.completions.has(key)
            const isCurrent = p.activeLevel === p.currentLevel && String(cls) === p.currentLesson
            const title = p.geo!.titles[p.activeLevel]?.[String(cls)] ?? ''
            return (
              <button
                key={cls}
                title={title}
                onClick={() => p.onSelect(p.activeLevel, String(cls))}
                style={lessonCellStyle(isCurrent, done)}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: isCurrent ? T.crimson : done ? T.inkFaint : T.ink }}>
                  {cls}
                </span>
                {title && (
                  <span style={{
                    fontSize: 9, color: isCurrent ? T.crimson : done ? T.inkFaint : T.inkSoft,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    width: '100%', textAlign: 'center', display: 'block',
                  }}>
                    {title.length > 6 ? title.slice(0, 6) + '…' : title}
                  </span>
                )}
                {done && !isCurrent && (
                  <div style={{ position: 'absolute', top: 3, right: 4 }}>
                    <Icon name="check" size={9} strokeWidth={3} color={T.inkFaint} />
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

// ── Grmpts (Patterns) ─────────────────────────────────────────────────────────
function GrmptsContent(p: {
  geo: GrmptsGeo | null
  currentLevel: string; currentPattern: string
  activeLevel: string; setActiveLevel: (l: string) => void
  completions: Set<string>
  onSelect: (level: string, pattern: string) => void
}) {
  if (!p.geo) return <div style={loadingStyle}>Loading…</div>

  const patternsAtLevel = Object.keys(p.geo.counts[p.activeLevel] ?? {}).sort()

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Level row */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0' }}>
        {p.geo.levels.map(lv => (
          <button key={lv} onClick={() => p.setActiveLevel(lv)} style={tabStyle(p.activeLevel === lv)}>
            {GRMPTS_LEVEL_NAMES[lv] ?? lv}
          </button>
        ))}
      </div>

      {/* Pattern list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {patternsAtLevel.map(pt => {
          const isCurrent = p.activeLevel === p.currentLevel && pt === p.currentPattern
          const done = p.completions.has(`${p.activeLevel}::${pt}`)
          const label = p.geo!.labels[pt] ?? pt
          return (
            <button key={pt} onClick={() => p.onSelect(p.activeLevel, pt)} style={listItemStyle(isCurrent, done)}>
              <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: isCurrent ? T.crimson : done ? T.inkFaint : T.inkMute, marginRight: 8 }}>{pt}</span>
              <span style={{ fontSize: 14, color: isCurrent ? T.crimson : done ? T.inkFaint : T.ink }}>{label}</span>
              {done && <Icon name="check" size={13} strokeWidth={2.5} color={T.inkFaint} style={{ marginLeft: 'auto' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Essay / Dialogue ──────────────────────────────────────────────────────────
function EssayContent(p: {
  geo: EssayGeo | null
  currentTitleZh: string
  activeGroup: number; setActiveGroup: (g: number) => void
  completions: Set<string>
  groupLabels: string[]
  groupStart: number[]
  onSelect: (titleZh: string) => void
}) {
  if (!p.geo) return <div style={loadingStyle}>Loading…</div>

  const itemsInGroup = p.geo.items.filter(item =>
    item.index >= p.groupStart[p.activeGroup] &&
    item.index < (p.groupStart[p.activeGroup + 1] ?? Infinity),
  )

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Group tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0' }}>
        {p.groupLabels.map((lbl, i) => (
          <button key={lbl} onClick={() => p.setActiveGroup(i)} style={tabStyle(p.activeGroup === i)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {itemsInGroup.map(item => {
          const isCurrent = item.title_zh === p.currentTitleZh
          const done = p.completions.has(item.title_zh)
          return (
            <button
              key={item.index}
              onClick={item.available ? () => p.onSelect(item.title_zh) : undefined}
              disabled={!item.available}
              style={listItemStyle(isCurrent, done, !item.available)}
            >
              <Icon name={done ? 'check' : 'note'} size={13} strokeWidth={2}
                color={done ? T.sage : isCurrent ? T.crimson : T.inkFaint}
                style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 14, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: !item.available ? T.inkFaint : isCurrent ? T.crimson : done ? T.inkSoft : T.ink,
              }}>{item.title_zh}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const tabStyle = (active: boolean): React.CSSProperties => ({
  height: 32, minWidth: 36, padding: '0 12px', borderRadius: 8, flexShrink: 0,
  background: active ? T.crimson : T.paperHi,
  border: `1px solid ${active ? T.crimsonDp : T.line}`,
  color: active ? '#fff' : T.inkSoft,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
})

const lessonCellStyle = (current: boolean, done: boolean): React.CSSProperties => ({
  position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 2, padding: '8px 4px', borderRadius: 10,
  background: current ? T.crimsonBg : done ? T.paperHi : T.paperHi,
  border: `1.5px solid ${current ? T.crimson : done ? T.lineSoft : T.lineSoft}`,
  cursor: 'pointer', fontFamily: 'inherit', minHeight: 52,
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
