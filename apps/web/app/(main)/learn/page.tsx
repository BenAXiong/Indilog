'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import ScreenHeader from '@/components/nav/ScreenHeader'
import Icon, { type IconName } from '@/components/ui/Icon'
import { useActiveLang } from '@/lib/hooks/useActiveLang'
import { getGlid } from '@/lib/learn/lang-bridge'
import { GRMPTS_LEVEL_NAMES } from '@/lib/learn/dialects'
import { fetchCompletions } from '@/lib/db/completions'

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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
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
type EssayGeo  = { items: Array<{ title_zh: string; available: boolean }> }
type TwelveGeo = { levels: string[]; classes: number[] }

export default function LearnPage() {
  const { lang, dialect, dialectLabel } = useActiveLang()
  const langCode = lang.code

  const [counts,     setCounts]     = useState<Record<Source, number>>({ twelve: 0, grmpts: 0, essay: 0, dialogue: 0 })
  const [totals,     setTotals]     = useState<Record<Source, number>>({ twelve: 120, grmpts: 41, essay: 60, dialogue: 60 })
  const [nextLabels, setNextLabels] = useState<Partial<Record<Source, string>>>({})

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

      const twelveNext = (() => {
        for (const lv of tgeo.levels) {
          for (const cl of tgeo.classes) {
            if (!tc.has(`Level ${lv} Lesson ${cl}`)) return `L${lv} · ${cl}`
          }
        }
        return ''
      })()

      const grmptsNext = (() => {
        for (const lv of ggeo.levels) {
          for (const pt of Object.keys(ggeo.counts[lv] ?? {}).sort()) {
            if (!gc.has(`${lv}::${pt}`)) {
              const label = ggeo.labels[pt] ?? pt
              return `${GRMPTS_LEVEL_NAMES[lv] ?? lv} · ${label}`
            }
          }
        }
        return ''
      })()

      const findNext = (items: EssayGeo['items'], done: Set<string>) => {
        const item = items.find(i => i.available && !done.has(i.title_zh))
        if (!item) return ''
        return item.title_zh.length > 12 ? item.title_zh.slice(0, 11) + '…' : item.title_zh
      }

      setNextLabels({
        twelve:   twelveNext,
        grmpts:   grmptsNext,
        essay:    findNext(egeo.items, ec),
        dialogue: findNext(dgeo.items, dc),
      })
    }).catch(() => {})
  }, [langCode, dialect])

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Learn" langName={lang.name} langDialect={dialectLabel} />

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
