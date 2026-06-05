'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon, SectionHead } from '@/components/ui'
import type { IconName } from '@/components/ui/Icon'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useLang } from '@/lib/context/LangDialectProvider'
import { listCollections, pinCollection, setIncludeInReview, type CollectionMeta } from '@/lib/db/progress/collections'
import { ensureFlashcards, getDueStats, getExcludeFromReview, listUserLanguages, type DueStats } from '@/lib/db/srs/flashcards'
import { setCapturesIncludeInReview } from '@/lib/db/profile/client'
import { getLangName } from '@/lib/lang/lang-bridge'
import type { CurriculumProgressItem, CurriculumProgressResponse } from '@/app/api/learn/curriculum-progress/route'
import { getStudyStats, type StudyStats, type CollectionStat } from '@/lib/db/srs/stats-client'
import BrowserView from '@/components/study/BrowserView'
import DeckActionSheet, { CAPTURES_DECK_ID } from '@/components/sheets/DeckActionSheet'
import CustomSessionSheet from '@/components/sheets/CustomSessionSheet'

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
  icon: IconName
  iconColor: string
  iconBg: string
  name: string
  sub?: string
  due: number
  href: string
  pinned?: boolean
  onPin?: () => void
  kebab?: boolean
  onKebab?: () => void
  last?: boolean
}

function DeckRow({ icon, iconColor, iconBg, name, sub, due, href, pinned = false, onPin, kebab = false, onKebab, last = false }: DeckRowProps) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
      textDecoration: 'none',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={19} color={iconColor} strokeWidth={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 16, fontWeight: 500, color: T.ink,
          letterSpacing: '-0.015em', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {pinned && <Icon name="pin" size={12} color={T.amber} strokeWidth={2} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
        {sub && (
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkMute, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <DueBadge n={due} />
      {onPin !== undefined && (
        <button
          aria-label={pinned ? 'Unpin' : 'Pin to top'}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onPin() }}
          style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: pinned ? T.amber : T.inkFaint,
          }}
        >
          <Icon name="pin" size={15} strokeWidth={1.8} />
        </button>
      )}
      {kebab && (
        <button
          aria-label="Deck actions"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onKebab?.() }}
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

// ─── Curriculum row ──────────────────────────────────────────────────────────

function CurriculumRow({ icon, name, href, meta, langName, last }: {
  icon: IconName; name: string; href: string
  meta: CurriculumProgressItem | null; langName: string; last?: boolean
}) {
  const pct = meta && meta.total > 0 ? Math.round(meta.completed / meta.total * 100) : 0
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
      textDecoration: 'none',
    }}>
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: '#F9E8E6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={19} color={T.crimson} strokeWidth={1.6} />
      </div>

      {/* Name + Next */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 16, fontWeight: 500, color: T.ink,
          letterSpacing: '-0.015em', lineHeight: 1.15,
        }}>{name}</div>
        {meta ? (
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10.5, color: T.inkMute, marginTop: 2,
          }}>
            {meta.total > 0
              ? (meta.nextLabel ? `Next: ${meta.nextLabel}` : 'All done ✓')
              : '—'}
          </div>
        ) : (
          <div className="animate-iv-shimmer" style={{
            height: 9, width: 110, borderRadius: 4, background: T.lineSoft, marginTop: 4,
          }} />
        )}
      </div>

      {/* Bar — 1/3 card width, centered */}
      <div style={{ flex: '0 0 33%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ width: '100%', height: 3, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999, transition: 'width 0.4s ease',
            width: `${pct}%`,
            background: pct >= 80 ? T.sage : pct >= 40 ? T.amber : T.crimson,
          }} />
        </div>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: T.inkFaint }}>
          {meta ? (meta.total > 0 ? `${meta.completed}/${meta.total}` : '—') : '…'}
        </span>
      </div>

      {/* Lang pill */}
      <span style={{
        fontSize: 9.5, fontFamily: '"JetBrains Mono", monospace',
        padding: '2px 7px', borderRadius: 999, flexShrink: 0,
        background: '#F9E8E6', color: T.crimson,
        fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>{langName}</span>

      <Icon name="chevron" size={15} color={T.inkFaint} strokeWidth={2} />
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

const CURRICULUM: { id: string; name: string; icon: IconName; href: string }[] = [
  { id: 'lessons',  name: 'Lessons',  icon: 'learn',  href: '/learn/lessons'   },
  { id: 'patterns', name: 'Patterns', icon: 'layers', href: '/learn/patterns'  },
  { id: 'essays',         name: 'Essays',         icon: 'pen',    href: '/learn/essays'         },
  { id: 'dialogues',      name: 'Dialogues',      icon: 'wave',   href: '/learn/dialogues'      },
  { id: 'conversations',  name: 'Conversations',  icon: 'mic',    href: '/learn/conversations'  },
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
  const { lang, dialect, dialectLabel } = useLang()
  const [activeTab, setActiveTab] = useState<'decks' | 'browser' | 'stats'>('decks')
  const [collections, setCollections]     = useState<CollectionMeta[]>([])
  const [due, setDue]                     = useState<DueStats>({ total: 0, captures: 0, byCollection: {} })
  const [loading, setLoading]             = useState(true)
  const [studyStats, setStudyStats]       = useState<StudyStats | null>(null)
  const [statsLoading, setStatsLoading]   = useState(false)
  const [actionDeck,        setActionDeck]        = useState<CollectionMeta | null>(null)
  const [capturesIncluded,  setCapturesIncluded]  = useState(true)
  const [settingsOpen, setSettingsOpen]     = useState(false)
  const [customOpen,   setCustomOpen]       = useState(false)
  const [showAllLangs, setShowAllLangs]     = useState<boolean>(() =>
    typeof window === 'undefined' ? true : localStorage.getItem('srs_show_all_langs') !== 'false'
  )
  const [excludedLangs, setExcludedLangs]   = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] }
  })
  const [availLangs, setAvailLangs]         = useState<string[] | null>(null)
  const [curriculumMeta, setCurriculumMeta] = useState<CurriculumProgressResponse | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = { curriculum: false, captures: false, collections: false }
    if (typeof window === 'undefined') return base
    return {
      curriculum:  localStorage.getItem('study_collapse_curriculum')  === 'true',
      captures:    localStorage.getItem('study_collapse_captures')    === 'true',
      collections: localStorage.getItem('study_collapse_collections') === 'true',
    }
  })

  useEffect(() => {
    if (!lang.code) return
    setCurriculumMeta(null)
    const excludeLangs = showAllLangs ? [] : excludedLangs
    Promise.all([
      listCollections(lang.code),
      getExcludeFromReview(),
      ensureFlashcards(),
    ]).then(async ([cols, exclude]) => {
      setCapturesIncluded(!exclude.captures)
      const stats = await getDueStats({
        excludeLangs,
        excludeCollections: exclude.collections,
        excludeCaptures:    exclude.captures,
      })
      setCollections(cols)
      setDue(stats)
      setLoading(false)
    })
    const enc = dialect ? encodeURIComponent(dialect) : ''
    fetch(`/api/learn/curriculum-progress?lang=${lang.code}&dialect=${enc}`)
      .then(r => r.json())
      .then(setCurriculumMeta)
      .catch(() => {})
  }, [lang.code, dialect, dialectLabel])

  useEffect(() => {
    if (activeTab !== 'stats' || studyStats || statsLoading) return
    setStatsLoading(true)
    getStudyStats().then(s => { setStudyStats(s); setStatsLoading(false) })
  }, [activeTab, studyStats, statsLoading])

  function handleRenamed(id: string, newName: string) {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c))
  }

  function handleDeleted(id: string) {
    setCollections(prev => prev.filter(c => c.id !== id))
    setDue(prev => {
      const collDue = prev.byCollection[id] ?? 0
      const { [id]: _, ...rest } = prev.byCollection
      return { total: prev.total - collDue, captures: prev.captures, byCollection: rest }
    })
  }

  async function refreshDue(overrideExcludedLangs?: string[]) {
    const excludeLangs = showAllLangs ? [] : (overrideExcludedLangs ?? excludedLangs)
    const excludeCollections = collections.filter(c => !c.include_in_review).map(c => c.id)
    const stats = await getDueStats({ excludeLangs, excludeCollections, excludeCaptures: !capturesIncluded })
    setDue(stats)
  }

  async function handleReset() { await refreshDue() }

  async function handleIncludeToggled(id: string, include: boolean) {
    const excludeLangs = showAllLangs ? [] : excludedLangs
    if (id === CAPTURES_DECK_ID) {
      setCapturesIncluded(include)
      const excludeCollections = collections.filter(c => !c.include_in_review).map(c => c.id)
      const stats = await getDueStats({ excludeLangs, excludeCollections, excludeCaptures: !include })
      setDue(stats)
    } else {
      const updatedCols = collections.map(c => c.id === id ? { ...c, include_in_review: include } : c)
      setCollections(updatedCols)
      const excludeCollections = updatedCols.filter(c => !c.include_in_review).map(c => c.id)
      const stats = await getDueStats({ excludeLangs, excludeCollections, excludeCaptures: !capturesIncluded })
      setDue(stats)
    }
  }

  function handlePinned(id: string, pinned: boolean) {
    setCollections(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, pinned } : c)
      return [...updated.filter(c => c.pinned), ...updated.filter(c => !c.pinned)]
    })
  }

  async function handlePinInline(id: string, pinned: boolean) {
    handlePinned(id, pinned)  // optimistic
    await pinCollection(id, pinned)
  }

  function toggleSection(key: string) {
    setCollapsed(prev => {
      const next = !prev[key]
      localStorage.setItem(`study_collapse_${key}`, String(next))
      return { ...prev, [key]: next }
    })
  }

  // Lazy-load language list when settings sheet opens with filter active
  useEffect(() => {
    if (settingsOpen && !showAllLangs && availLangs === null) {
      listUserLanguages().then(setAvailLangs)
    }
  }, [settingsOpen, showAllLangs, availLangs])

  function handleToggleShowAll(v: boolean) {
    setShowAllLangs(v)
    localStorage.setItem('srs_show_all_langs', String(v))
    if (v) {
      setExcludedLangs([])
      localStorage.setItem('srs_excluded_langs', '[]')
      refreshDue([])
    }
  }

  function handleToggleLang(lang: string) {
    const nowExcluded = !excludedLangs.includes(lang)
    const next = nowExcluded
      ? [...excludedLangs, lang]
      : excludedLangs.filter(l => l !== lang)
    setExcludedLangs(next)
    localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
    refreshDue(next)
  }

  return (
    <div style={{ paddingBottom: 110, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '4px 18px 0' }}>
        <ScreenHeader
          title="Study"
          langName={lang.name}
          langDialect={dialectLabel}
          right={
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Study settings"
              style={{ ...btnStyle, cursor: 'pointer' }}
            >
              <Icon name="settings" size={17} strokeWidth={1.6} />
            </button>
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

          {/* Review all CTA + Custom session button — disabled pending rework */}
          <div style={{ display: 'none' }}>
            <Link href="/review" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
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
            <button onClick={() => setCustomOpen(true)} aria-label="Custom session" style={{
              width: 54, height: 54, borderRadius: 15, flexShrink: 0,
              background: T.paperHi, border: `1px solid ${T.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: T.inkSoft,
            }}>
              <Icon name="filter" size={18} strokeWidth={1.8} />
            </button>
          </div>

          {/* Curriculum */}
          <div>
            <button onClick={() => toggleSection('curriculum')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 4px', marginBottom: 10, background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
              <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 500, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, textAlign: 'left' }}>Curriculum</span>
              <Icon name="chev-d" size={12} color={T.inkFaint} style={{ transform: collapsed.curriculum ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {!collapsed.curriculum && (
              <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
                {CURRICULUM.map((deck, i) => (
                  <CurriculumRow
                    key={deck.id}
                    icon={deck.icon}
                    name={deck.name}
                    href={deck.href}
                    meta={curriculumMeta?.[deck.id as keyof typeof curriculumMeta] ?? null}
                    langName={lang.name}
                    last={i === CURRICULUM.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Captures */}
          <div>
            <button onClick={() => toggleSection('captures')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 4px', marginBottom: 10, background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
              <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 500, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, textAlign: 'left' }}>Captured</span>
              <Icon name="chev-d" size={12} color={T.inkFaint} style={{ transform: collapsed.captures ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {!collapsed.captures && (
              <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
                <DeckRow
                  icon="bookmark"
                  iconColor={T.sage}
                  iconBg={T.sageBg}
                  name="Captured"
                  sub="words saved while reading"
                  due={due.captures}
                  href="/review"
                  kebab
                  onKebab={() => setActionDeck({
                    id: CAPTURES_DECK_ID, name: 'Captured',
                    language: '', created_at: '', card_count: 0, pinned: false,
                    include_in_review: capturesIncluded,
                  })}
                  last
                />
              </div>
            )}
          </div>

          {/* My Collections */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
              <button onClick={() => toggleSection('collections')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 500, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>My collections</span>
                <Icon name="chev-d" size={12} color={T.inkFaint} style={{ transform: collapsed.collections ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <Link href="/learn/new" aria-label="Import collection" style={{
                width: 22, height: 22, borderRadius: 999,
                border: `1.5px solid ${T.lineSoft}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.inkMute, textDecoration: 'none', flexShrink: 0,
              }}>
                <Icon name="plus" size={12} strokeWidth={2.2} />
              </Link>
            </div>
            {!collapsed.collections && (
              <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ padding: '16px 14px' }}>
                    <div className="animate-iv-shimmer" style={{ height: 14, borderRadius: 6, background: T.lineSoft, width: '60%' }} />
                  </div>
                ) : (
                  collections.map((col, i) => (
                    <DeckRow
                      key={col.id}
                      icon="archive"
                      iconColor={T.amber}
                      iconBg={T.amberBg}
                      name={col.name}
                      sub={`${col.card_count} cards`}
                      due={due.byCollection[col.id] ?? 0}
                      href={`/learn/collection/${col.id}`}
                      pinned={col.pinned}
                      onPin={() => handlePinInline(col.id, !col.pinned)}
                      kebab
                      onKebab={() => setActionDeck(col)}
                      last={i === collections.length - 1}
                    />
                  ))
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Browser ── */}
      {activeTab === 'browser' && <BrowserView />}

      {/* ── Stats ── */}
      {activeTab === 'stats' && (
        statsLoading || !studyStats
          ? <StatsLoading />
          : <StudyStatsView stats={studyStats} />
      )}

      {settingsOpen && (
        <>
          <div
            onClick={() => setSettingsOpen(false)}
            onKeyDown={e => { if (e.key === 'Escape') setSettingsOpen(false) }}
            role="button" tabIndex={-1} aria-label="Close"
            style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,10,0.35)', zIndex: 70 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: T.paper, borderRadius: '20px 20px 0 0',
            border: `1px solid ${T.line}`, zIndex: 71,
            boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 0' }}>
              <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink }}>
                Study settings
              </span>
              <button onClick={() => setSettingsOpen(false)} style={{
                width: 28, height: 28, borderRadius: 999,
                background: T.paperHi, border: `1px solid ${T.lineSoft}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: T.inkMute,
              }}>
                <Icon name="x" size={14} strokeWidth={2} />
              </button>
            </div>
            <div style={{ height: 1, background: T.lineSoft, margin: '10px 18px 0' }} />
            <div style={{ padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => handleToggleShowAll(!showAllLangs)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: T.ink }}>Show all languages</div>
                  <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>
                    Include all languages in Review all
                  </div>
                </div>
                <div style={{
                  width: 44, height: 26, borderRadius: 999, flexShrink: 0, marginLeft: 16,
                  background: showAllLangs ? T.crimson : T.lineSoft,
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: showAllLangs ? 21 : 3,
                    width: 20, height: 20, borderRadius: 999, background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </button>

              {!showAllLangs && (
                <div style={{ paddingTop: 4 }}>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
                  }}>Languages</div>
                  {availLangs === null ? (
                    <div style={{ fontSize: 13, color: T.inkMute, padding: '4px 0' }}>Loading…</div>
                  ) : availLangs.map(code => {
                    const included = !excludedLangs.includes(code)
                    return (
                      <button key={code} onClick={() => handleToggleLang(code)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '9px 0', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          background: included ? T.crimson : 'transparent',
                          border: `1.5px solid ${included ? T.crimson : T.line}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {included && <Icon name="check" size={11} color="#fff" strokeWidth={2.5} />}
                        </div>
                        <span style={{ fontSize: 14, color: T.ink }}>{getLangName(code)}</span>
                      </button>
                    )
                  })}
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
                    Excluded languages still accumulate due cards.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <CustomSessionSheet open={customOpen} onClose={() => setCustomOpen(false)} />

      {actionDeck && (
        <DeckActionSheet
          deck={actionDeck}
          onClose={() => setActionDeck(null)}
          onRenamed={handleRenamed}
          onDeleted={handleDeleted}
          onReset={handleReset}
          onIncludeToggled={handleIncludeToggled}
        />
      )}

    </div>
  )
}
