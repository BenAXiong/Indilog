'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import type { IconName } from '@/components/ui/Icon'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useLang } from '@/lib/context/LangDialectProvider'
import { listCollections, pinCollection, setIncludeInReview, type CollectionMeta } from '@/lib/db/progress/collections'
import { ensureFlashcards, getDueStats, getExcludeFromReview, type DueStats } from '@/lib/db/srs/flashcards'
import { setCapturesIncludeInReview } from '@/lib/db/profile/client'
import { createClient } from '@/lib/supabase/client'
import type { CurriculumProgressItem, CurriculumProgressResponse } from '@/app/api/learn/curriculum-progress/route'
import BrowserView from '@/components/study/BrowserView'
import DeckActionSheet, { CAPTURES_DECK_ID } from '@/components/sheets/DeckActionSheet'
import PerfMark from '@/components/perf/PerfMark'

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
  due?: number
  href: string
  pinned?: boolean
  onPin?: () => void
  kebab?: boolean
  onKebab?: () => void
  last?: boolean
}

function DeckRow({ icon, iconColor, iconBg, name, sub, due, href, pinned = false, onPin, kebab = false, onKebab, last = false  }: DeckRowProps) {
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
      {due !== undefined && <DueBadge n={due} />}
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

// ─── Curriculum section (collapsible) ───────────────────────────────────────

function progressFill(pct: number) {
  if (pct >= 80) return 'rgba(74,112,51,0.09)'
  if (pct >= 40) return 'rgba(196,143,52,0.09)'
  return 'rgba(180,40,40,0.07)'
}

function CurriculumSection({ icon, name, href, meta, last, open, onToggle }: {
  icon: IconName; name: string; href: string
  meta: CurriculumProgressItem | null; last?: boolean
  open: boolean; onToggle: () => void
}) {
  const pct    = meta && meta.total > 0 ? Math.round(meta.completed / meta.total * 100) : 0
  const levels = meta?.levels ?? []
  const hasLevels = levels.length > 0

  return (
    <>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 14px',
        borderBottom: `1px solid ${T.lineSoft}`,
        background: pct > 0
          ? `linear-gradient(to right, ${progressFill(pct)} ${pct}%, transparent ${pct}%)`
          : 'transparent',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: '#F9E8E6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={19} color={T.crimson} strokeWidth={1.6} />
        </div>

        <button
          onClick={hasLevels ? onToggle : undefined}
          style={{
            flex: '1 1 0', minWidth: 0, background: 'none', border: 'none',
            cursor: hasLevels ? 'pointer' : 'default', padding: 0, textAlign: 'left',
          }}
        >
          <div style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 16, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.015em', lineHeight: 1.15,
          }}>{name}</div>
          {meta && meta.total > 0 && (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute, marginTop: 3 }}>
              {meta.completed}/{meta.total}
            </div>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Link href={href} style={{
            width: 30, height: 30, borderRadius: 999,
            background: T.crimson,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
            boxShadow: '0 1px 6px rgba(120,30,15,0.22)',
          }}>
            <Icon name="play" size={12} color="#fff" />
          </Link>
        </div>
      </div>

      {/* Sub-level rows */}
      {open && levels.map((lv, i) => {
        const lvPct = lv.total > 0 ? Math.round(lv.completed / lv.total * 100) : 0
        const isLastSub = last && i === levels.length - 1
        return (
          <div key={lv.key} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px 10px 62px',
            borderBottom: isLastSub ? 'none' : `1px solid ${T.lineSoft}`,
            background: lvPct > 0
              ? `linear-gradient(to right, ${progressFill(lvPct)} ${lvPct}%, transparent ${lvPct}%)`
              : 'transparent',
          }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <div style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontSize: 14, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em',
              }}>{lv.name}</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, marginTop: 2 }}>
                {lv.completed}/{lv.total}
              </div>
            </div>
            <Link href={href} style={{
              width: 26, height: 26, borderRadius: 999,
              background: T.crimson,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
              boxShadow: '0 1px 4px rgba(120,30,15,0.18)',
            }}>
              <Icon name="play" size={10} color="#fff" />
            </Link>
          </div>
        )
      })}
    </>
  )
}

// ─── Capture section (collapsible) ──────────────────────────────────────────

type CaptureCounts = { captured: { total: number; due: number }; dict: { total: number; due: number } }

function SubCaptureRow({ name, total, due, href, last }: {
  name: string; total: number; due: number; href: string; last?: boolean
}) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px 10px 62px',
      borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
      textDecoration: 'none',
    }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 14, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em' }}>{name}</div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, marginTop: 2 }}>{total} cards</div>
      </div>
      <DueBadge n={due} />
    </Link>
  )
}

function CaptureSection({ counts, open, onToggle, onKebab }: {
  counts: CaptureCounts | null
  open: boolean
  onToggle: () => void
  onKebab: () => void
}) {
  const totalDue   = counts ? counts.captured.due + counts.dict.due : null
  const totalCards = counts ? counts.captured.total + counts.dict.total : null

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: open ? `1px solid ${T.lineSoft}` : 'none' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: T.sageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="capture" size={19} color={T.sage} strokeWidth={1.6} />
        </div>
        <button onClick={onToggle} style={{ flex: '1 1 0', minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.15 }}>Captures</div>
          {totalCards !== null && (
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute, marginTop: 3 }}>{totalCards} cards</div>
          )}
        </button>
        {totalDue !== null && <DueBadge n={totalDue} />}
        <button
          aria-label="Capture settings"
          onClick={e => { e.stopPropagation(); onKebab() }}
          style={{ width: 30, height: 30, borderRadius: 8, color: T.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Icon name="more-v" size={17} strokeWidth={2} />
        </button>
      </div>
      {open && counts && (
        <>
          <SubCaptureRow name="Captured" total={counts.captured.total} due={counts.captured.due} href="/review?noteSource=captured&custom=1" />
          <SubCaptureRow name="Dictionary" total={counts.dict.total} due={counts.dict.due} href="/review?noteSource=dict&custom=1" last />
        </>
      )}
    </>
  )
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CURRICULUM: { id: string; name: string; icon: IconName; href: string }[] = [
  { id: 'lessons',  name: 'Lessons',  icon: 'learn',  href: '/study/lessons'   },
  { id: 'patterns', name: 'Patterns', icon: 'layers', href: '/study/patterns'  },
  { id: 'essays',         name: 'Essays',         icon: 'pen',    href: '/study/essays'         },
  { id: 'dialogues',      name: 'Dialogues',      icon: 'wave',   href: '/study/dialogues'      },
  { id: 'conversations',  name: 'Conversations',  icon: 'mic',    href: '/study/conversations'  },
]

const SUBTABS = [
  { id: 'epark'       as const, label: 'ePark'    },
  { id: 'collections' as const, label: 'Decks'    },
  { id: 'captures'    as const, label: 'Captures' },
  { id: 'browser'     as const, label: 'Browser'   },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudyPage() {
  return <Suspense><StudyPageInner /></Suspense>
}

function StudyPageInner() {
  const { lang, dialect, dialectLabel } = useLang()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'epark' | 'collections' | 'captures' | 'browser'>(() => {
    const t = searchParams.get('tab')
    return (t === 'collections' || t === 'captures' || t === 'browser') ? t : 'epark'
  })
  const [collections, setCollections]     = useState<CollectionMeta[]>([])
  const [due, setDue]                     = useState<DueStats>({ total: 0, captures: 0, byCollection: {} })
  const [loading, setLoading]             = useState(true)
  const [actionDeck,        setActionDeck]        = useState<CollectionMeta | null>(null)
  const [capturesIncluded,  setCapturesIncluded]  = useState(true)
  const [showAllLangs, setShowAllLangs]     = useState<boolean>(() =>
    typeof window === 'undefined' ? true : localStorage.getItem('srs_show_all_langs') !== 'false'
  )
  const [excludedLangs, setExcludedLangs]   = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] }
  })
  const [curriculumMeta, setCurriculumMeta] = useState<CurriculumProgressResponse | null>(null)
  const [captureSourceCounts, setCaptureSourceCounts] = useState<CaptureCounts | null>(null)
  const [curriculumDue, setCurriculumDue] = useState<number | null>(null)
  const [openDecks, setOpenDecks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const now = new Date().toISOString()
      Promise.all([
        sb.from('ind_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('note_source', 'captured'),
        sb.from('ind_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('note_source', 'dict'),
        sb.from('ind_flashcards').select('id, ind_items!inner(note_source)', { count: 'exact', head: true })
          .eq('user_id', user.id).gt('repetitions', 0).is('suspended_at', null)
          .lte('due_at', now).filter('ind_items.note_source', 'eq', 'captured'),
        sb.from('ind_flashcards').select('id, ind_items!inner(note_source)', { count: 'exact', head: true })
          .eq('user_id', user.id).gt('repetitions', 0).is('suspended_at', null)
          .lte('due_at', now).filter('ind_items.note_source', 'eq', 'dict'),
        sb.from('ind_flashcards').select('id, ind_items!inner(note_source)', { count: 'exact', head: true })
          .eq('user_id', user.id).is('suspended_at', null)
          .filter('ind_items.note_source', 'eq', 'curriculum'),
      ]).then(([captTot, dictTot, captDue, dictDue, currDue]) => {
        setCaptureSourceCounts({
          captured: { total: captTot.count ?? 0, due: captDue.count ?? 0 },
          dict:     { total: dictTot.count ?? 0, due: dictDue.count ?? 0 },
        })
        setCurriculumDue(currDue.count ?? 0)
      })
    })
  }, [])

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

  async function refreshDue() {
    const currentShowAll = localStorage.getItem('srs_show_all_langs') !== 'false'
    const currentExcluded: string[] = (() => { try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] } })()
    const excludeLangs = currentShowAll ? [] : currentExcluded
    const excludeCollections = collections.filter(c => !c.include_in_review).map(c => c.id)
    const stats = await getDueStats({ excludeLangs, excludeCollections, excludeCaptures: !capturesIncluded })
    setDue(stats)
  }

  async function handleReset() { await refreshDue() }

  async function handleIncludeToggled(id: string, include: boolean) {
    const currentShowAll = localStorage.getItem('srs_show_all_langs') !== 'false'
    const currentExcluded: string[] = (() => { try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] } })()
    const excludeLangs = currentShowAll ? [] : currentExcluded
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

  // Sync language filter state when SettingsSheet changes prefs
  useEffect(() => {
    function onPrefsChanged() {
      const v = localStorage.getItem('srs_show_all_langs') !== 'false'
      const excl: string[] = (() => { try { return JSON.parse(localStorage.getItem('srs_excluded_langs') ?? '[]') } catch { return [] } })()
      setShowAllLangs(v)
      setExcludedLangs(excl)
      refreshDue()
    }
    window.addEventListener('srs-prefs-changed', onPrefsChanged)
    return () => window.removeEventListener('srs-prefs-changed', onPrefsChanged)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ paddingBottom: 110, display: 'flex', flexDirection: 'column' }}>
      <PerfMark flow="study-hub" when={!loading} />

      {/* Header */}
      <div style={{ padding: '4px 18px 0' }}>
        <ScreenHeader
          title="Study"
          langName={lang.name}
          langDialect={dialectLabel}
          settingsTab="study"
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
        <Link href="/video" style={{
          position: 'relative', paddingBottom: 11, textDecoration: 'none',
          fontSize: 15, fontWeight: 500,
          color: T.inkMute, letterSpacing: '-0.01em',
        }}>Videos</Link>
      </div>

      {/* ── ePARK ── */}
      {activeTab === 'epark' && (
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {curriculumDue !== null && (
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
              <DeckRow
                icon="bookmark"
                iconColor={T.crimson}
                iconBg="#F9E8E6"
                name="Saved"
                due={curriculumDue}
                href="/review?noteSource=curriculum&dueOnly=false&includeUnseen=true&custom=1"
                last
              />
            </div>
          )}
          <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
            {CURRICULUM.map((deck, i) => (
              <CurriculumSection
                key={deck.id}
                icon={deck.icon}
                name={deck.name}
                href={deck.href}
                meta={curriculumMeta?.[deck.id as keyof typeof curriculumMeta] ?? null}
                last={i === CURRICULUM.length - 1}
                open={openDecks[deck.id] ?? false}
                onToggle={() => setOpenDecks((prev: Record<string, boolean>) => ({ ...prev, [deck.id]: !prev[deck.id] }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Decks (collections) ── */}
      {activeTab === 'collections' && (
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link href="/study/new" aria-label="Import collection" style={{
              width: 28, height: 28, borderRadius: 999,
              border: `1.5px solid ${T.lineSoft}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkMute, textDecoration: 'none', flexShrink: 0,
            }}>
              <Icon name="plus" size={13} strokeWidth={2.2} />
            </Link>
          </div>
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
                  href={`/study/collection/${col.id}`}
                  pinned={col.pinned}
                  onPin={() => handlePinInline(col.id, !col.pinned)}
                  kebab
                  onKebab={() => setActionDeck(col)}
                  last={i === collections.length - 1}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Captures ── */}
      {activeTab === 'captures' && (
        <div style={{ padding: '0 18px' }}>
          <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden' }}>
            <CaptureSection
              counts={captureSourceCounts}
              open={openDecks['captures'] ?? false}
              onToggle={() => setOpenDecks(prev => ({ ...prev, captures: !prev['captures'] }))}
              onKebab={() => setActionDeck({
                id: CAPTURES_DECK_ID, name: 'Captured',
                language: '', created_at: '', card_count: 0, pinned: false,
                include_in_review: capturesIncluded,
              })}
            />
          </div>
        </div>
      )}

      {/* ── Browser ── */}
      {activeTab === 'browser' && <BrowserView />}

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
