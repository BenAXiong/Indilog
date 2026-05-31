'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { useLang } from '@/lib/context/LangDialectProvider'
import {
  getGlid, getDefaultDialect, getGrmptsDialect
} from '@/lib/lang/lang-bridge'
import { GRMPTS_LEVEL_NAMES } from '@/lib/lang/dialects'
import rawPatternLabels from '@/lib/learn/grmpts_type_labels.json'

const PATTERN_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(rawPatternLabels as Record<string, string>).map(([k, v]) => [k, v.replace(/^\d+\s*-\s*/, '')])
)
import { createItem } from '@/lib/db/notebook/items'
import { fetchCompletions, markComplete, unmarkComplete } from '@/lib/db/progress/completions'
import type { CurriculumRow } from '@/lib/corpus/curriculum'
import Icon from '@/components/ui/Icon'
import StudyCard from './StudyCard'
import ActionBar from './ActionBar'
import ContentSheet from './ContentSheet'
import LookupInline from '@/components/lookup/LookupInline'
import SettingsPanel, { type ZhMode } from './SettingsPanel'

type Source = 'twelve' | 'grmpts' | 'essay' | 'dialogue'

const SOURCE_NAMES: Record<Source, string> = {
  twelve: 'Lessons', grmpts: 'Patterns', essay: 'Essays', dialogue: 'Dialogs',
}

type Props = { source: Source }

export default function StudyView({ source }: Props) {
  const { lang, dialect: profileDialect } = useLang()
  const langCode = lang.code
  const glid     = getGlid(langCode) ?? '01'

  // ── Persistent settings ─────────────────────────────────────────────────────
  const [zhMode,   setZhModeState]   = useState<ZhMode>('blurred')
  const [lookupOn, setLookupOnState] = useState(false)

  // ── Selection state ─────────────────────────────────────────────────────────
  const [level,   setLevel]   = useState('1')
  const [lesson,  setLesson]  = useState('1')
  const [pattern, setPattern] = useState('t1')
  const [titleZh, setTitleZh] = useState('')
  const [dialect, setDialect] = useState('')  // Chinese dialect name for DB queries

  // ── UI state ────────────────────────────────────────────────────────────────
  const [results,      setResults]      = useState<CurriculumRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [completions,  setCompletions]  = useState<Set<string>>(new Set())
  const [lookup,       setLookup]       = useState<{ word: string; rect: DOMRect } | null>(null)

  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  // ── Init from localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    // Settings
    const savedZhMode = (localStorage.getItem('iv_learn_zh_mode') ?? 'blurred') as ZhMode
    const savedLookup = localStorage.getItem('iv_learn_lookup') === 'true'
    setZhModeState(savedZhMode)
    setLookupOnState(savedLookup)

    // Dialect — grmpts uses language-level dialect; others use profile (set in Settings)

    // Selection
    if (source === 'twelve') {
      const saved = localStorage.getItem(`iv_learn_sel_lessons_${glid}`)
      if (saved) {
        // Format: "Level 3 Lesson 4"
        const m = saved.match(/Level (\d+) Lesson (\d+)/)
        if (m) { setLevel(m[1]); setLesson(m[2]) }
      }
    } else if (source === 'grmpts') {
      const savedPat = localStorage.getItem(`iv_learn_sel_patterns_${glid}`)
      if (savedPat) setPattern(savedPat)
      const savedLv = localStorage.getItem(`iv_learn_level_${glid}`)
      if (savedLv) setLevel(savedLv)
    } else {
      const key = source === 'essay' ? `iv_learn_sel_essays_${glid}` : `iv_learn_sel_dialogues_${glid}`
      const saved = localStorage.getItem(key)
      if (saved) setTitleZh(saved)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Dialect from profile ────────────────────────────────────────────────────
  useEffect(() => {
    if (source === 'grmpts') {
      setDialect(getGrmptsDialect(langCode) ?? '')
    } else {
      setDialect(profileDialect || getDefaultDialect(langCode) || '')
    }
  }, [source, langCode, profileDialect])

  // ── Load completions ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCompletions(langCode, source).then(setCompletions)
  }, [langCode, source])

  // ── Fetch first title_zh for essay/dialogue when titleZh is empty ───────────
  useEffect(() => {
    if ((source === 'essay' || source === 'dialogue') && !titleZh && dialect) {
      fetch(`/api/learn/geometry?source=${source}&dialect=${encodeURIComponent(dialect)}`)
        .then(r => r.json())
        .then((d: { items: Array<{ index: number; title_zh: string; available: boolean }> }) => {
          const first = d.items.find(i => i.available)
          if (first) setTitleZh(first.title_zh)
        })
        .catch(() => {})
    }
  }, [source, dialect, titleZh])

  // ── Fetch curriculum data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!dialect) return

    let params: URLSearchParams

    if (source === 'twelve') {
      params = new URLSearchParams({ source, dialect, level, title_zh: `Level ${level} Lesson ${lesson}` })
    } else if (source === 'grmpts') {
      params = new URLSearchParams({ source, dialect, level, title_zh: pattern })
    } else {
      // essay / dialogue — route looks up by index; navItems must be loaded
      if (!titleZh || !navItems.length) return
      const item = navItems.find(i => i.title_zh === titleZh)
      if (!item) return
      params = new URLSearchParams({ source, dialect, index: String(item.index) })
    }

    setLoading(true)
    fetch(`/api/learn/curriculum?${params}`)
      .then(r => r.json())
      .then((d: { results: CurriculumRow[] }) => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [source, dialect, level, lesson, titleZh, pattern, navItems])

  // ── Item key for completions ────────────────────────────────────────────────
  const itemKey = source === 'twelve'
    ? `Level ${level} Lesson ${lesson}`
    : source === 'grmpts'
      ? `${level}::${pattern}`
      : titleZh

  const completed = completions.has(itemKey)

  // ── Save settings to localStorage ──────────────────────────────────────────
  const setZhMode = (m: ZhMode) => {
    setZhModeState(m)
    localStorage.setItem('iv_learn_zh_mode', m)
  }
  const setLookup_ = (on: boolean) => {
    setLookupOnState(on)
    localStorage.setItem('iv_learn_lookup', String(on))
  }

  // ── Toggle completion ───────────────────────────────────────────────────────
  const handleToggleComplete = async () => {
    const next = !completed
    if (next) {
      await markComplete(langCode, source, itemKey)
      setCompletions(prev => new Set([...prev, itemKey]))
    } else {
      await unmarkComplete(langCode, source, itemKey)
      setCompletions(prev => { const s = new Set(prev); s.delete(itemKey); return s })
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  // For now: prev/next within lessons/patterns will be handled when geometry is loaded
  // We track navigation via a simple approach: fetch the ordered list lazily
  const [navOrder,   setNavOrder]   = useState<string[]>([])
  const [navItems,   setNavItems]   = useState<Array<{ index: number; title_zh: string }>>([])

  useEffect(() => {
    if (source === 'twelve') {
      const levels = ['1','2','3','4','5','6','7','8','9','10','11','12']
      const classes = ['1','2','3','4','5','6','7','8','9','10']
      setNavOrder(levels.flatMap(lv => classes.map(cl => `${lv}::${cl}`)))
    } else if (source === 'grmpts') {
      fetch(`/api/learn/geometry?source=grmpts&glid=${glid}`)
        .then(r => r.json())
        .then((d: { levels: string[]; counts: Record<string, Record<string, number>> }) => {
          setNavOrder(d.levels.flatMap(lv =>
            Object.keys(d.counts[lv] ?? {})
              .sort((a, b) => Number.parseInt(a.slice(1)) - Number.parseInt(b.slice(1)))
              .map(pt => `${lv}::${pt}`),
          ))
        })
        .catch(() => {})
    } else {
      fetch(`/api/learn/geometry?source=${source}&dialect=${encodeURIComponent(dialect || ' ')}`)
        .then(r => r.json())
        .then((d: { items: Array<{ index: number; title_zh: string; available: boolean }> }) => {
          const available = d.items.filter(i => i.available)
          setNavItems(available.map(i => ({ index: i.index, title_zh: i.title_zh })))
          setNavOrder(available.map(i => i.title_zh))
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, glid, dialect])

  const currentNavKey = source === 'twelve'
    ? `${level}::${lesson}`
    : source === 'grmpts'
      ? `${level}::${pattern}`
      : titleZh

  const navIdx     = navOrder.indexOf(currentNavKey)
  const prevDisabled = navIdx <= 0
  const nextDisabled = navIdx < 0 || navIdx >= navOrder.length - 1

  const goToKey = useCallback((key: string) => {
    if (source === 'twelve') {
      const [lv, ls] = key.split('::')
      setLevel(lv); setLesson(ls)
      localStorage.setItem(`iv_learn_sel_lessons_${glid}`, `Level ${lv} Lesson ${ls}`)
    } else if (source === 'grmpts') {
      const [lv, pt] = key.split('::')
      setLevel(lv); setPattern(pt)
      localStorage.setItem(`iv_learn_sel_patterns_${glid}`, pt)
      localStorage.setItem(`iv_learn_level_${glid}`, lv)
    } else {
      setTitleZh(key)
      const storageKey = source === 'essay' ? `iv_learn_sel_essays_${glid}` : `iv_learn_sel_dialogues_${glid}`
      localStorage.setItem(storageKey, key)
    }
  }, [source, glid])

  const goPrev = () => { if (!prevDisabled) goToKey(navOrder[navIdx - 1]) }
  const goNext = () => { if (!nextDisabled) goToKey(navOrder[navIdx + 1]) }

  // ── Selection from sheet ────────────────────────────────────────────────────
  const handleTwelveSelect = (lv: string, ls: string) => {
    setLevel(lv); setLesson(ls)
    localStorage.setItem(`iv_learn_sel_lessons_${glid}`, `Level ${lv} Lesson ${ls}`)
  }

  const handleGrmptsSelect = (lv: string, pt: string) => {
    setLevel(lv); setPattern(pt)
    localStorage.setItem(`iv_learn_sel_patterns_${glid}`, pt)
    localStorage.setItem(`iv_learn_level_${glid}`, lv)
  }

  const handleEssaySelect = (tz: string) => {
    setTitleZh(tz)
    const key = source === 'essay' ? `iv_learn_sel_essays_${glid}` : `iv_learn_sel_dialogues_${glid}`
    localStorage.setItem(key, tz)
  }

  // ── Audio ───────────────────────────────────────────────────────────────────
  const handlePlay = (url: string) => {
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.src = url
    audio.play().catch(() => {})
  }

  // ── Save to ind_items ───────────────────────────────────────────────────────
  const handleSave = async (ab: string, zh: string, audioUrl?: string | null) => {
    await createItem({
      ab, zh: zh || undefined, type: 'sentence', language: langCode,
      dialect, note_source: 'curriculum',
      audio: audioUrl || undefined,
    })
  }

  // ── Current item pill label ─────────────────────────────────────────────────
  const pillLabel = source === 'twelve'
    ? `L${level} · ${lesson}`
    : source === 'grmpts'
      ? `${GRMPTS_LEVEL_NAMES[level] ?? `L${level}`} · ${PATTERN_LABELS[pattern] ?? pattern}`
      : titleZh
        ? (titleZh.length > 14 ? titleZh.slice(0, 13) + '…' : titleZh)
        : '—'

  return (
    <div style={{ position: 'relative' }}>
      {/* Custom header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 10px',
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'rgba(251,245,231,0.85)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        zIndex: 20,
      }}>
        <Link href="/learn" style={{
          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.inkSoft, textDecoration: 'none',
        }}>
          <Icon name="arrow-l" size={16} strokeWidth={2} />
        </Link>

        <span style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 22, fontWeight: 500, color: T.ink, flex: 1,
          letterSpacing: '-0.02em',
        }}>
          {SOURCE_NAMES[source]}
        </span>

        {/* Current item pill */}
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 32, padding: '0 10px', borderRadius: 999,
            background: T.paperHi, border: `1px solid ${T.line}`,
            fontSize: 12, fontWeight: 600, color: T.inkSoft,
            fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer',
            whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {pillLabel}
          <Icon name="chev-d" size={12} strokeWidth={2} />
        </button>

        {/* Settings gear */}
        <div ref={settingsRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setSettingsOpen(v => !v)}
            style={{
              width: 34, height: 34, borderRadius: 999,
              background: T.paperHi, border: `1px solid ${T.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.inkMute, cursor: 'pointer',
            }}
          >
            <Icon name="settings" size={16} strokeWidth={1.6} />
          </button>
          {settingsOpen && (
            <SettingsPanel
              zhMode={zhMode}
              lookupOn={lookupOn}
              onZhMode={setZhMode}
              onLookup={setLookup_}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Card scroll area — top padding compensates for fixed header (~52px) */}
      <div style={{
        padding: '66px 18px 180px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ fontSize: 13, color: T.inkFaint }}>Loading…</div>
          </div>
        ) : results.length === 0 ? (
          <div style={{
            padding: '36px 24px', textAlign: 'center',
            background: T.paperHi, border: `1px solid ${T.lineSoft}`,
            borderRadius: 18, marginTop: 8,
          }}>
            <div style={{ fontSize: 14, color: T.inkSoft }}>No content available for this selection.</div>
            <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>
              Try a different dialect or lesson.
            </div>
          </div>
        ) : (
          results.map((row, i) => (
            <StudyCard
              key={i}
              row={row}
              index={i + 1}
              zhMode={zhMode}
              lookupOn={lookupOn}
              onLookup={(word, rect) => setLookup({ word, rect })}
              onPlay={handlePlay}
              onSave={handleSave}
            />
          ))
        )}
      </div>

      {/* Action bar */}
      {results.length > 0 && (
        <ActionBar
          onPrev={goPrev}
          onNext={goNext}
          onToggleComplete={handleToggleComplete}
          completed={completed}
          prevDisabled={prevDisabled}
          nextDisabled={nextDisabled}
        />
      )}

      {/* Content sheet */}
      {sheetOpen && (
        <>
          {source === 'twelve' && (
            <ContentSheet
              source="twelve"
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              sourceName="Lessons"
              glid={glid}
              currentLevel={level}
              currentLesson={lesson}
              completions={completions}
              onSelect={handleTwelveSelect}
            />
          )}
          {source === 'grmpts' && (
            <ContentSheet
              source="grmpts"
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              sourceName="Patterns"
              glid={glid}
              currentLevel={level}
              currentPattern={pattern}
              completions={completions}
              onSelect={handleGrmptsSelect}
            />
          )}
          {(source === 'essay' || source === 'dialogue') && (
            <ContentSheet
              source={source}
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              sourceName={SOURCE_NAMES[source]}
              dialect={dialect}
              currentTitleZh={titleZh}
              completions={completions}
              onSelect={handleEssaySelect}
            />
          )}
        </>
      )}

      {/* Inline lookup */}
      {lookup && (
        <LookupInline
          word={lookup.word}
          anchorRect={lookup.rect}
          onClose={() => setLookup(null)}
        />
      )}
    </div>
  )
}
