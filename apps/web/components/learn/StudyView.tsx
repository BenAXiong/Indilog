'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { ACTIVE_LANG } from '@/lib/mock-data'
import {
  getGlid, getDefaultDialect, getDialectsForLang, getGrmptsDialect
} from '@/lib/learn/lang-bridge'
import { createItem } from '@/lib/db/items'
import { fetchCompletions, markComplete, unmarkComplete } from '@/lib/db/completions'
import { getProfile, updateDefaultDialect } from '@/lib/db/profiles'
import type { CurriculumRow } from '@/lib/learn/db'
import Icon from '@/components/ui/Icon'
import StudyCard from './StudyCard'
import ActionBar from './ActionBar'
import ContentSheet from './ContentSheet'
import LookupInline from './LookupInline'
import SettingsPanel, { type ZhMode } from './SettingsPanel'

type Source = 'twelve' | 'grmpts' | 'essay' | 'dialogue'

const SOURCE_NAMES: Record<Source, string> = {
  twelve: 'Lessons', grmpts: 'Patterns', essay: 'Essays', dialogue: 'Dialogs',
}

type Props = { source: Source }

export default function StudyView({ source }: Props) {
  const lang     = ACTIVE_LANG
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

    // Dialect — localStorage first, then ind_profiles, then code default
    const savedDialect = localStorage.getItem(`iv_learn_dialect_${glid}`)
    const hardDefault = source === 'grmpts'
      ? (getGrmptsDialect(langCode) ?? '')
      : (getDefaultDialect(langCode) ?? '')
    if (savedDialect) {
      setDialect(savedDialect)
    } else {
      getProfile().then(profile => {
        const resolved = profile?.default_dialect || hardDefault
        setDialect(resolved)
        localStorage.setItem(`iv_learn_dialect_${glid}`, resolved)
      }).catch(() => setDialect(hardDefault))
    }

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

  // ── Load completions ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCompletions(langCode, source).then(setCompletions)
  }, [langCode, source])

  // ── Fetch first title_zh for essay/dialogue when titleZh is empty ───────────
  useEffect(() => {
    if ((source === 'essay' || source === 'dialogue') && !titleZh && dialect) {
      fetch(`/api/geometry?source=${source}&dialect=${encodeURIComponent(dialect)}`)
        .then(r => r.json())
        .then((d: { items: Array<{ index: number; title_zh: string; available: boolean }> }) => {
          const first = d.items.find(i => i.available)
          if (first) setTitleZh(first.title_zh)
        })
        .catch(() => {})
    }
  }, [source, dialect, titleZh])

  // ── Fetch first title_zh for twelve (Level 1 Lesson 1) ─────────────────────
  useEffect(() => {
    if (source === 'twelve' && !titleZh && dialect) {
      fetch('/api/geometry?source=twelve')
        .then(r => r.json())
        .then((d: { titles: Record<string, Record<string, string>> }) => {
          const t = d.titles[level]?.[lesson]
          if (t) setTitleZh(t)
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, dialect])

  // ── Fetch curriculum data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!dialect) return
    let apiTitleZh = ''
    let apiLevel = level
    if (source === 'twelve') {
      if (!titleZh) return
      apiTitleZh = titleZh
    } else if (source === 'grmpts') {
      apiTitleZh = pattern
      apiLevel = level
    } else {
      if (!titleZh) return
      apiTitleZh = titleZh
    }

    setLoading(true)
    const params = new URLSearchParams({
      source, dialect, title_zh: apiTitleZh, level: apiLevel,
    })
    fetch(`/api/curriculum?${params}`)
      .then(r => r.json())
      .then((d: { results: CurriculumRow[] }) => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [source, dialect, titleZh, pattern, level])

  // ── Item key for completions ────────────────────────────────────────────────
  const itemKey = source === 'twelve'
    ? `Level ${level} Lesson ${lesson}`
    : source === 'grmpts'
      ? pattern
      : titleZh

  const completed = completions.has(itemKey)

  // ── Dialect change (persists to localStorage + ind_profiles) ───────────────
  const changeDialect = (d: string) => {
    setDialect(d)
    localStorage.setItem(`iv_learn_dialect_${glid}`, d)
    updateDefaultDialect(d).catch(() => {})
  }
  void changeDialect // referenced below when dialect picker is wired up

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
  const [navOrder, setNavOrder] = useState<string[]>([])

  useEffect(() => {
    if (source === 'twelve') {
      // Build ordered item keys
      const levels = ['1','2','3','4','5','6','7','8','9','10','11','12']
      const classes = ['1','2','3','4','5','6','7','8','9','10']
      const keys = levels.flatMap(lv => classes.map(cl => `${lv}::${cl}`))
      setNavOrder(keys)
    } else if (source === 'grmpts') {
      fetch(`/api/geometry?source=grmpts&glid=${glid}`)
        .then(r => r.json())
        .then((d: { levels: string[]; counts: Record<string, Record<string, number>> }) => {
          const keys = d.levels.flatMap(lv =>
            Object.keys(d.counts[lv] ?? {}).sort().map(pt => `${lv}::${pt}`),
          )
          setNavOrder(keys)
        })
        .catch(() => {})
    } else {
      fetch(`/api/geometry?source=${source}&dialect=${encodeURIComponent(dialect || ' ')}`)
        .then(r => r.json())
        .then((d: { items: Array<{ index: number; title_zh: string; available: boolean }> }) => {
          setNavOrder(d.items.filter(i => i.available).map(i => i.title_zh))
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
      // Resolve title_zh
      fetch('/api/geometry?source=twelve')
        .then(r => r.json())
        .then((d: { titles: Record<string, Record<string, string>> }) => {
          const t = d.titles[lv]?.[ls]
          if (t) setTitleZh(t)
        })
        .catch(() => {})
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
    fetch('/api/geometry?source=twelve')
      .then(r => r.json())
      .then((d: { titles: Record<string, Record<string, string>> }) => {
        const t = d.titles[lv]?.[ls]
        if (t) setTitleZh(t)
      })
      .catch(() => {})
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
  const handleSave = async (ab: string, zh: string) => {
    await createItem({
      text: ab, type: 'sentence', language: langCode,
      dialect, notes: zh || undefined,
    })
  }

  // ── Current item pill label ─────────────────────────────────────────────────
  const pillLabel = source === 'twelve'
    ? `L${level} · ${lesson}`
    : source === 'grmpts'
      ? `L${level} · ${pattern}`
      : titleZh
        ? (titleZh.length > 14 ? titleZh.slice(0, 13) + '…' : titleZh)
        : '—'

  return (
    <div style={{ position: 'relative' }}>
      {/* Custom header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 0',
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

      {/* Card scroll area */}
      <div style={{
        padding: '14px 18px 180px',
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
