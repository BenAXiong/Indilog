'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon, SectionHead } from '@/components/ui'
import type { IconName } from '@/components/ui/Icon'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useLang } from '@/lib/context/LangDialectProvider'
import { listCollections, type CollectionMeta } from '@/lib/db/progress/collections'
import { getDueStats, type DueStats } from '@/lib/db/srs/flashcards'
import { getStudyStats, type StudyStats, type CollectionStat } from '@/lib/db/srs/stats-client'

// ─── Due badge ───────────────────────────────────────────────────────────────

function DueBadge({ n }: { n: number }) {
  if (n > 0) return (
    <span style={{
      minWidth: 26, height: 22, padding: '0 7px', borderRadius: 999,
      background: T.crimson, color: '#fff', fontSize: 11.5, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.01em',
      boxShadow: '0 1px 2px rgba(120,30,15,0.25)', flexShrink: 0,
    }}>{n}</span>
  )
  return (
    <span style={{
      minWidth: 26, height: 22, padding: '0 7px', borderRadius: 999,
      background: 'transparent', color: T.inkFaint, fontSize: 11.5, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"JetBrains Mono", monospace', border: `1px solid ${T.lineSoft}`,
      flexShrink: 0,
    }}>0</span>
  )
}

// ─── Deck row ────────────────────────────────────────────────────────────────

type DeckRowProps = {
  dot?: string
  name: string
  sub?: string
  due: number
  href: string
  kebab?: boolean
  last?: boolean
}

function DeckRow({ dot = T.inkFaint, name, sub, due, href, kebab = false, last = false }: DeckRowProps) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
      textDecoration: 'none',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 16, fontWeight: 500, color: T.ink,
          letterSpacing: '-0.015em', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</div>
        {sub && (
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <DueBadge n={due} />
      {kebab && (
        <button
          aria-label="Deck actions"
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
          style={{
            width: 30, height: 30, borderRadius: 8, color: T.inkMute,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <Icon name="more-v" size={17} strokeWidth={2} />
        </button>
      )}
    </Link>
  )
}

// ─── Empty subtab placeholder ────────────────────────────────────────────────

function EmptyTab({ icon, title, line1, line2 }: { icon: IconName; title: string; line1: string; line2: string }) {
  return (
    <div style={{ padding: '48px 30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{
        width: 96, height: 96, borderRadius: 22, marginBottom: 22,
        background: `repeating-linear-gradient(45deg, ${T.lineSoft}, ${T.lineSoft} 6px, ${T.paper} 6px, ${T.paper} 12px)`,
        border: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 999, background: T.paperHi,
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={24} strokeWidth={1.6} color={T.inkMute} />
        </div>
      </div>
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: '-0.02em' }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 8, lineHeight: 1.45 }}>
        {line1}<br />{line2}
      </div>
      <div style={{
        marginTop: 18, fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase',
        letterSpacing: '0.1em', padding: '6px 12px', borderRadius: 999,
        background: T.paper, border: `1px solid ${T.lineSoft}`,
        fontFamily: '"JetBrains Mono", monospace',
      }}>coming soon</div>
    </div>
  )
}

// ─── Stats subtab ─────────────────────────────────────────────────────────────

function CoverageLine({ stat }: { stat: CollectionStat }) {
  const pct = stat.total > 0 ? stat.known / stat.total : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{stat.name}</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute }}>
          {stat.known}/{stat.total}
        </span>
      </div>
      <div style={{ height: 7, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: pct >= 0.8 ? T.sage : pct >= 0.4 ? T.amber : T.crimson,
          width: `${Math.round(pct * 100)}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, marginTop: 4,
      }}>
        {Math.round(pct * 100)}% known
      </div>
    </div>
  )
}

function PaceChart({ dailyCounts }: { dailyCounts: Array<{ date: string; count: number }> }) {
  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1)
  const days     = ['S','M','T','W','T','F','S']

  return (
    <div style={{ display: 'flex', gap: 4, height: 56, alignItems: 'flex-end' }}>
      {dailyCounts.map((d, i) => {
        const barH   = d.count > 0 ? Math.max(4, Math.round(d.count / maxCount * 48)) : 2
        const dow    = new Date(d.date + 'T12:00:00').getDay()
        const isToday = i === dailyCounts.length - 1
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <div style={{
                width: '100%', borderRadius: '3px 3px 0 0',
                height: barH,
                background: isToday
                  ? T.crimson
                  : d.count > 0 ? '#E5A88E' : T.lineSoft,
                transition: 'height 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: 8.5, fontFamily: '"JetBrains Mono", monospace',
              color: isToday ? T.crimson : T.inkFaint,
              fontWeight: isToday ? 700 : 400,
            }}>{days[dow]}</span>
          </div>
        )
      })}
    </div>
  )
}

function StudyStatsView({ stats }: { stats: StudyStats }) {
  return (
    <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Overview 2×2 */}
      <div>
        <SectionHead title="Overview" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total cards',  value: stats.totalCards, color: T.crimson },
            { label: 'Due today',    value: stats.dueToday,   color: T.amber   },
            { label: 'Known',        value: stats.known,      color: T.sage    },
            { label: 'Mastered',     value: stats.mastered,   color: T.sageDp  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding: '14px 14px', borderRadius: 14,
              background: T.paperHi, border: `1px solid ${T.lineSoft}`,
              boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
            }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 32, fontWeight: 600, color, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage */}
      {(stats.collections.length > 0 || stats.captures.total > 0) && (
        <div>
          <SectionHead title="Coverage" />
          <div style={{
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            borderRadius: 16, padding: '14px 14px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {stats.collections.map(col => (
              <CoverageLine key={col.id} stat={col} />
            ))}
            {stats.captures.total > 0 && (
              <CoverageLine stat={stats.captures} />
            )}
          </div>
        </div>
      )}

      {/* 14-day pace */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionHead title="14-day pace" style={{ marginBottom: 0 }} />
          {stats.avgPerDay > 0 && (
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute }}>
              avg {stats.avgPerDay}/day
            </span>
          )}
        </div>
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`,
          borderRadius: 16, padding: '14px 14px',
        }}>
          <PaceChart dailyCounts={stats.dailyCounts} />
        </div>
      </div>

    </div>
  )
}

function StatsLoading() {
  return (
    <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[60, 100, 80].map((w, i) => (
        <div key={i} className="animate-iv-shimmer" style={{ height: 14, borderRadius: 6, background: T.lineSoft, width: `${w}%` }} />
      ))}
    </div>
  )
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CURRICULUM = [
  { id: 'lessons',  name: 'Lessons',  sub: 'Step-by-step',   href: '/learn/lessons'   },
  { id: 'patterns', name: 'Patterns', sub: 'Grammar shapes',  href: '/learn/patterns'  },
  { id: 'essays',   name: 'Essays',   sub: 'Long reads',      href: '/learn/essays'    },
  { id: 'dialogs',  name: 'Dialogs',  sub: 'Two-speaker',     href: '/learn/dialogues' },
]

const SUBTABS = [
  { id: 'decks'   as const, label: 'Decks'   },
  { id: 'browser' as const, label: 'Browser' },
  { id: 'stats'   as const, label: 'Stats'   },
]

const btnStyle: CSSProperties = {
  width: 36, height: 36, borderRadius: 999,
  background: T.paperHi, border: `1px solid ${T.line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: T.inkSoft, flexShrink: 0, textDecoration: 'none',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudyPage() {
  const { lang, dialectLabel } = useLang()
  const [activeTab, setActiveTab] = useState<'decks' | 'browser' | 'stats'>('decks')
  const [collections, setCollections]     = useState<CollectionMeta[]>([])
  const [due, setDue]                     = useState<DueStats>({ total: 0, captures: 0, byCollection: {} })
  const [loading, setLoading]             = useState(true)
  const [studyStats, setStudyStats]       = useState<StudyStats | null>(null)
  const [statsLoading, setStatsLoading]   = useState(false)

  useEffect(() => {
    if (!lang.code) return
    Promise.all([listCollections(lang.code), getDueStats()])
      .then(([cols, stats]) => {
        setCollections(cols)
        setDue(stats)
        setLoading(false)
      })
  }, [lang.code])

  useEffect(() => {
    if (activeTab !== 'stats' || studyStats || statsLoading) return
    setStatsLoading(true)
    getStudyStats().then(s => { setStudyStats(s); setStatsLoading(false) })
  }, [activeTab, studyStats, statsLoading])

  return (
    <div style={{ paddingBottom: 110, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '4px 18px 0' }}>
        <ScreenHeader
          title="Study"
          langName={lang.name}
          langDialect={dialectLabel}
          right={
            <Link href="/learn/new" style={btnStyle} aria-label="Import collection">
              <Icon name="plus" size={17} strokeWidth={2} />
            </Link>
          }
        />
      </div>

      {/* Subtab bar */}
      <div style={{
        display: 'flex', gap: 22, padding: '16px 18px 0',
        borderBottom: `1px solid ${T.lineSoft}`, marginBottom: 20,
      }}>
        {SUBTABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              position: 'relative', paddingBottom: 11, background: 'none', border: 'none',
              fontSize: 15, fontWeight: active ? 700 : 500,
              color: active ? T.ink : T.inkMute, cursor: 'pointer', letterSpacing: '-0.01em',
            }}>
              {tab.label}
              {active && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: -1,
                  height: 2.5, background: T.crimson, borderRadius: 2,
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Decks ── */}
      {activeTab === 'decks' && (
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Review all CTA */}
          <Link href="/review" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            height: 54, borderRadius: 15, textDecoration: 'none',
            background: due.total > 0 ? T.crimson : T.lineSoft,
            color: due.total > 0 ? '#fff' : T.inkFaint,
            boxShadow: due.total > 0
              ? '0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 4px rgba(120,30,15,0.2), 0 8px 18px rgba(120,30,15,0.18)'
              : 'none',
          }}>
            <Icon name="play" size={14} color={due.total > 0 ? '#fff' : T.inkFaint} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {due.total > 0 ? 'Review all' : 'All caught up'}
            </span>
            {due.total > 0 && (
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, opacity: 0.85, marginLeft: 2 }}>
                {due.total} due
              </span>
            )}
          </Link>

          {/* Curriculum */}
          <div>
            <SectionHead title="Curriculum" />
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              {CURRICULUM.map((deck, i) => (
                <DeckRow
                  key={deck.id}
                  dot={T.crimson}
                  name={deck.name}
                  sub={deck.sub}
                  due={0}
                  href={deck.href}
                  last={i === CURRICULUM.length - 1}
                />
              ))}
            </div>
          </div>

          {/* My Collections */}
          <div>
            <SectionHead title="My collections" />
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '16px 14px' }}>
                  <div className="animate-iv-shimmer" style={{ height: 14, borderRadius: 6, background: T.lineSoft, width: '60%' }} />
                </div>
              ) : (
                collections.map((col, i) => (
                  <DeckRow
                    key={col.id}
                    dot={T.amber}
                    name={col.name}
                    sub={`${col.card_count} cards`}
                    due={due.byCollection[col.id] ?? 0}
                    href={`/learn/collection/${col.id}`}
                    kebab
                    last={i === collections.length - 1}
                  />
                ))
              )}
              <Link href="/learn/new" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 14px',
                borderTop: !loading && collections.length > 0 ? `1px solid ${T.lineSoft}` : 'none',
                color: T.inkSoft, textDecoration: 'none',
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 999,
                  border: `1.5px dashed ${T.inkFaint}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="plus" size={12} color={T.inkMute} strokeWidth={2.2} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Import new collection</span>
              </Link>
            </div>
          </div>

          {/* Captures */}
          <div>
            <SectionHead title="Captures" />
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              <DeckRow
                dot={T.sage}
                name="Captures & lookups"
                sub="words saved while reading"
                due={due.captures}
                href="/review"
                last
              />
            </div>
          </div>

        </div>
      )}

      {/* ── Browser ── */}
      {activeTab === 'browser' && (
        <EmptyTab icon="search" title="Browser" line1="Search and browse every card" line2="across all your decks." />
      )}

      {/* ── Stats ── */}
      {activeTab === 'stats' && (
        statsLoading || !studyStats
          ? <StatsLoading />
          : <StudyStatsView stats={studyStats} />
      )}

    </div>
  )
}
