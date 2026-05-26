'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import ScreenHeader from '@/components/nav/ScreenHeader'
import Icon, { type IconName } from '@/components/ui/Icon'
import { ACTIVE_LANG } from '@/lib/mock-data'
import { getGlid, getDialectsForLang, getDefaultDialect } from '@/lib/learn/lang-bridge'
import { shortDialectLabel } from '@/lib/learn/dialects'
import { getProfile, updateDefaultDialect } from '@/lib/db/profiles'
import { fetchCompletions } from '@/lib/db/completions'

// Completable item counts per source (used for progress denominator)
const TOTALS = { twelve: 120, grmpts: 11, essay: 60, dialogue: 60 }

type Source = keyof typeof TOTALS

type SourceCardProps = {
  href: string
  icon: IconName
  title: string
  completed: number
  total: number
  cursor?: string
  hasDue?: boolean
  dialect: string
  glid: string
}

function SourceCard({ href, icon, title, completed, total, cursor, hasDue, dialect, glid }: Readonly<SourceCardProps>) {
  const pct   = total > 0 ? Math.round((completed / total) * 100) : 0
  const label = shortDialectLabel(dialect, glid)

  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 16, textDecoration: 'none',
      background: T.paperHi,
      border: `1px solid ${T.lineSoft}`,
      borderLeft: hasDue ? `3px solid ${T.crimson}` : `1px solid ${T.lineSoft}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 3px rgba(80,40,20,0.05)',
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: T.crimsonBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={22} color={T.crimson} strokeWidth={1.6} />
      </div>

      {/* Middle */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 17, fontWeight: 500, color: T.ink,
          }}>{title}</span>
          {label && (
            <span style={{
              fontSize: 10.5, color: T.inkMute,
              fontFamily: '"JetBrains Mono", monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120,
            }}>{label}</span>
          )}
        </div>

        {/* Progress bar */}
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

      {/* Right */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        {cursor && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, color: T.inkMute,
          }}>{cursor} ▸</span>
        )}
        <Icon name="chevron" size={15} color={T.inkFaint} strokeWidth={2} />
      </div>
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

export default function LearnPage() {
  const lang     = ACTIVE_LANG
  const langCode = lang.code
  const glid     = getGlid(langCode) ?? '01'
  const dialects = getDialectsForLang(langCode)

  const [dialect,   setDialect] = useState('')
  const [counts,    setCounts]       = useState<Record<Source, number>>({
    twelve: 0, grmpts: 0, essay: 0, dialogue: 0,
  })

  // Init dialect
  useEffect(() => {
    const saved = localStorage.getItem(`iv_learn_dialect_${glid}`)
    if (saved) {
      setDialect(saved)
    } else {
      getProfile()
        .then(p => {
          const d = p?.default_dialect || getDefaultDialect(langCode) || dialects[0] || ''
          setDialect(d)
          if (d) localStorage.setItem(`iv_learn_dialect_${glid}`, d)
        })
        .catch(() => {
          const d = getDefaultDialect(langCode) || dialects[0] || ''
          setDialect(d)
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch completion counts
  useEffect(() => {
    Promise.all([
      fetchCompletions(langCode, 'twelve'),
      fetchCompletions(langCode, 'grmpts'),
      fetchCompletions(langCode, 'essay'),
      fetchCompletions(langCode, 'dialogue'),
    ]).then(([t, g, e, d]) => {
      setCounts({ twelve: t.size, grmpts: g.size, essay: e.size, dialogue: d.size })
    }).catch(() => {})
  }, [langCode])

  const changeDialect = (d: string) => {
    setDialect(d)
    localStorage.setItem(`iv_learn_dialect_${glid}`, d)
    updateDefaultDialect(d).catch(() => {})
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Learn" langName={lang.name} langDialect={lang.dialect} />

      {/* Dialect selector */}
      {dialects.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
            color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Dialect</span>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {dialects.map(d => {
              const label = shortDialectLabel(d, glid)
              const active = dialect === d
              return (
                <button
                  key={d}
                  onClick={() => changeDialect(d)}
                  style={{
                    height: 28, padding: '0 10px', borderRadius: 999, flexShrink: 0,
                    background: active ? T.ink : T.paperHi,
                    border: `1px solid ${active ? T.ink : T.line}`,
                    color: active ? T.cream : T.inkSoft,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    fontFamily: 'inherit', cursor: 'pointer',
                    transition: 'all .12s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Collection cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SourceCard
          href="/learn/lessons"   icon="learn"  title="Lessons"
          completed={counts.twelve}   total={TOTALS.twelve}
          dialect={dialect} glid={glid} hasDue={counts.twelve < TOTALS.twelve}
        />
        <SourceCard
          href="/learn/patterns"  icon="layers" title="Patterns"
          completed={counts.grmpts}   total={TOTALS.grmpts}
          dialect={dialect} glid={glid}
        />
        <SourceCard
          href="/learn/essays"    icon="pen"    title="Essays"
          completed={counts.essay}    total={TOTALS.essay}
          dialect={dialect} glid={glid}
        />
        <SourceCard
          href="/learn/dialogues" icon="wave"   title="Dialogs"
          completed={counts.dialogue} total={TOTALS.dialogue}
          dialect={dialect} glid={glid}
        />
        <NewCard />
      </div>
    </div>
  )
}
