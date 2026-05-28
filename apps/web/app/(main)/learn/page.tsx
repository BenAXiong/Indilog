'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import ScreenHeader from '@/components/nav/ScreenHeader'
import Icon, { type IconName } from '@/components/ui/Icon'
import { useActiveLang } from '@/lib/hooks/useActiveLang'
import { getGlid } from '@/lib/lang/lang-bridge'
import { GRMPTS_LEVEL_NAMES, stageName, lessonDifficultyOf } from '@/lib/lang/dialects'
import { fetchCompletions } from '@/lib/db/completions'
import HubSearch from '@/components/learn/HubSearch'

type Source = 'twelve' | 'grmpts' | 'essay' | 'dialogue'

type SourceCardProps = {
  href: string
  icon: IconName
  title: string
  completed: number
  total: number
  nextLabel?: string
  hasDue?: boolean
}

function SourceCard({ href, icon, title, completed, total, nextLabel, hasDue }: Readonly<SourceCardProps>) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 16, textDecoration: 'none',
      background: T.paperHi,
      border: `1px solid ${T.lineSoft}`,
      borderLeft: hasDue ? `3px solid ${T.crimson}` : `1px solid ${T.lineSoft}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 3px rgba(80,40,20,0.05)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: T.crimsonBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={22} color={T.crimson} strokeWidth={1.6} />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 17, fontWeight: 500, color: T.ink,
          }}>{title}</span>
          {nextLabel && (
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10.5, color: T.inkMute, flexShrink: 0,
            }}>Next: {nextLabel}</span>
          )}
        </div>

        <div style={{ height: 3, borderRadius: 999, background: T.lineSoft, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999,
            width: `${pct}%`, background: T.crimson,
            transition: 'width .4s ease',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: T.inkFaint }}>
            {completed > 0 ? `${completed} / ${total}` : `0 / ${total}`}
          </span>
          {pct > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: T.crimson,
              fontFamily: '"JetBrains Mono", monospace',
            }}>{pct}%</span>
          )}
        </div>
      </div>

      <Icon name="chevron" size={15} color={T.inkFaint} strokeWidth={2} />
    </Link>
  )
}

const headerBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 999,
  background: T.paperHi, border: `1px solid ${T.line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: T.inkSoft, flexShrink: 0, cursor: 'pointer', textDecoration: 'none',
}

function NewCard() {
  return (
    <Link href="/learn/new" style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 16, textDecoration: 'none',
      background: T.paperHi, border: `1.5px dashed ${T.lineSoft}`,
      color: T.inkFaint,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: T.paper, border: `1px dashed ${T.lineSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="plus" size={22} strokeWidth={1.8} color={T.inkFaint} />
      </div>
      <span style={{ fontSize: 17, fontWeight: 500, fontFamily: 'Newsreader, Georgia, serif' }}>
        New collection
      </span>
    </Link>
  )
}

type GrmptsGeo = { levels: string[]; counts: Record<string, Record<string, number>>; labels: Record<string, string> }
type EssayGeo  = { items: Array<{ index: number; title_zh: string; available: boolean }> }
type TwelveGeo = { levels: string[]; classes: number[]; titles?: Record<string, Record<string, string>> }

export default function LearnPage() {
  const { lang, dialect, dialectLabel } = useActiveLang()
  const langCode = lang.code

  const [counts,     setCounts]     = useState<Record<Source, number>>({ twelve: 0, grmpts: 0, essay: 0, dialogue: 0 })
  const [totals,     setTotals]     = useState<Record<Source, number>>({ twelve: 120, grmpts: 41, essay: 60, dialogue: 60 })
  const [nextLabels, setNextLabels] = useState<Partial<Record<Source, string>>>({})
  const [searchOpen, setSearchOpen] = useState(false)
  const [geoLoaded,  setGeoLoaded]  = useState<{
    tgeo?: TwelveGeo; ggeo?: GrmptsGeo; egeo?: EssayGeo; dgeo?: EssayGeo
  }>({})

  useEffect(() => {
    if (!langCode) return
    const glid = getGlid(langCode) ?? '01'
    const enc  = encodeURIComponent(dialect ?? '')

    Promise.all([
      fetchCompletions(langCode, 'twelve'),
      fetchCompletions(langCode, 'grmpts'),
      fetchCompletions(langCode, 'essay'),
      fetchCompletions(langCode, 'dialogue'),
      fetch('/api/geometry?source=twelve').then(r => r.json()) as Promise<TwelveGeo>,
      fetch(`/api/geometry?source=grmpts&glid=${glid}`).then(r => r.json()) as Promise<GrmptsGeo>,
      fetch(`/api/geometry?source=essay&dialect=${enc}`).then(r => r.json()) as Promise<EssayGeo>,
      fetch(`/api/geometry?source=dialogue&dialect=${enc}`).then(r => r.json()) as Promise<EssayGeo>,
    ]).then(([tc, gc, ec, dc, tgeo, ggeo, egeo, dgeo]) => {
      const gTotal = ggeo.levels.reduce((sum, lv) => sum + Object.keys(ggeo.counts[lv] ?? {}).length, 0)
      const eTotal = egeo.items.filter(i => i.available).length
      const dTotal = dgeo.items.filter(i => i.available).length

      setCounts({ twelve: tc.size, grmpts: gc.size, essay: ec.size, dialogue: dc.size })
      setTotals({ twelve: 120, grmpts: gTotal, essay: eTotal, dialogue: dTotal })
      setGeoLoaded({ tgeo, ggeo, egeo, dgeo })

      const twelveNext = (() => {
        for (const lv of tgeo.levels) {
          for (const cl of tgeo.classes) {
            if (!tc.has(`Level ${lv} Lesson ${cl}`)) {
              return `${lessonDifficultyOf(lv)} · ${stageName(lv)} · ${cl}`
            }
          }
        }
        return ''
      })()

      const numSort = (a: string, b: string) => Number.parseInt(a.slice(1)) - Number.parseInt(b.slice(1))

      const grmptsNext = (() => {
        for (const lv of ggeo.levels) {
          for (const pt of Object.keys(ggeo.counts[lv] ?? {}).sort(numSort)) {
            if (!gc.has(`${lv}::${pt}`)) {
              const label   = ggeo.labels[pt] ?? pt
              const typeNum = Number.parseInt(pt.slice(1))
              return `${GRMPTS_LEVEL_NAMES[lv] ?? lv} · ${typeNum} ${label}`
            }
          }
        }
        return ''
      })()

      const essayDiff = (idx: number) => {
        if (idx < 20) { return '初級' }
        if (idx < 40) { return '中級' }
        return '高級'
      }
      const findNext = (items: EssayGeo['items'], done: Set<string>) => {
        const item = items.find(i => i.available && !done.has(i.title_zh))
        if (!item) return ''
        const title = item.title_zh.length > 6 ? item.title_zh.slice(0, 5) + '…' : item.title_zh
        return `${essayDiff(item.index)} · ${item.index + 1} · ${title}`
      }

      setNextLabels({
        twelve:   twelveNext,
        grmpts:   grmptsNext,
        essay:    findNext(egeo.items, ec),
        dialogue: findNext(dgeo.items, dc),
      })
    }).catch(() => {})
  }, [langCode, dialect])

  const glid = getGlid(langCode) ?? '01'
  const numSortStr = (a: string, b: string) => Number.parseInt(a.slice(1)) - Number.parseInt(b.slice(1))

  const hubNavItems = useMemo(() => {
    const { tgeo, ggeo, egeo, dgeo } = geoLoaded
    type NavItem = { label: string; sublabel: string; href: string; storage: { key: string; value: string }[] }
    const items: NavItem[] = []
    if (tgeo) {
      for (const lv of tgeo.levels) {
        for (const cl of tgeo.classes) {
          items.push({
            label:    tgeo.titles?.[lv]?.[String(cl)] ?? `Lesson ${cl}`,
            sublabel: `${lessonDifficultyOf(lv)} · ${stageName(lv)} · ${cl}`,
            href: '/learn/lessons',
            storage: [{ key: `iv_learn_sel_lessons_${glid}`, value: `Level ${lv} Lesson ${cl}` }],
          })
        }
      }
    }
    if (ggeo) {
      for (const lv of ggeo.levels) {
        for (const pt of Object.keys(ggeo.counts[lv] ?? {}).sort(numSortStr)) {
          items.push({
            label:    ggeo.labels[pt] ?? pt,
            sublabel: GRMPTS_LEVEL_NAMES[lv] ?? lv,
            href: '/learn/patterns',
            storage: [
              { key: `iv_learn_sel_patterns_${glid}`, value: pt },
              { key: `iv_learn_level_${glid}`, value: lv },
            ],
          })
        }
      }
    }
    if (egeo) {
      for (const item of egeo.items.filter(i => i.available)) {
        items.push({
          label: item.title_zh, sublabel: `Essay · ${item.index + 1}`,
          href: '/learn/essays',
          storage: [{ key: `iv_learn_sel_essays_${glid}`, value: item.title_zh }],
        })
      }
    }
    if (dgeo) {
      for (const item of dgeo.items.filter(i => i.available)) {
        items.push({
          label: item.title_zh, sublabel: `Dialog · ${item.index + 1}`,
          href: '/learn/dialogues',
          storage: [{ key: `iv_learn_sel_dialogues_${glid}`, value: item.title_zh }],
        })
      }
    }
    return items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoLoaded, glid])

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        title="Learn"
        langName={lang.name}
        langDialect={dialectLabel}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              style={headerBtnStyle}
            >
              <Icon name="search" size={17} strokeWidth={1.6} />
            </button>
            <Link href="/settings" aria-label="Settings" style={headerBtnStyle}>
              <Icon name="settings" size={17} strokeWidth={1.6} />
            </Link>
          </div>
        }
      />
      {searchOpen && (
        <HubSearch
          glid={glid}
          navItems={hubNavItems}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SourceCard
          href="/learn/lessons"   icon="learn"  title="Lessons"
          completed={counts.twelve}   total={totals.twelve}
          nextLabel={nextLabels.twelve}
          hasDue={counts.twelve < totals.twelve}
        />
        <SourceCard
          href="/learn/patterns"  icon="layers" title="Patterns"
          completed={counts.grmpts}   total={totals.grmpts}
          nextLabel={nextLabels.grmpts}
        />
        <SourceCard
          href="/learn/essays"    icon="pen"    title="Essays"
          completed={counts.essay}    total={totals.essay}
          nextLabel={nextLabels.essay}
        />
        <SourceCard
          href="/learn/dialogues" icon="wave"   title="Dialogs"
          completed={counts.dialogue} total={totals.dialogue}
          nextLabel={nextLabels.dialogue}
        />
        <NewCard />
      </div>
    </div>
  )
}
