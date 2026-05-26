'use client'

import { useState } from 'react'
import Link from 'next/link'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Chip, LangAvatar, Icon } from '@/components/ui'
import { SETTINGS_LANGS } from '@/lib/mock-data'

const ACCOUNT_ROWS = [
  { label: 'Export notebook', icon: 'bookmark' as const },
  { label: 'About Indivore',  icon: 'leaf'     as const },
  { label: 'Sign out',        icon: 'logout'   as const, danger: true },
]

export default function SettingsPage() {
  const [activeLang, setActiveLang] = useState('ami')
  const [goal, setGoal] = useState(20)
  const [locale, setLocale] = useState('en')

  return (
    <div style={{ padding: '4px 0 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <Link href="/" aria-label="Back to dashboard" style={{
            width: 36, height: 36, borderRadius: 999, background: T.paperHi,
            border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.inkSoft, flexShrink: 0,
          }}>
            <Icon name="arrow-l" size={17} strokeWidth={1.8} />
          </Link>
          <h1 style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 26, fontWeight: 500, color: T.ink,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            Settings
          </h1>
        </div>
      </div>

      {/* Profile card */}
      <div style={{ padding: '0 18px' }}>
        <Card raised pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999, background: T.amberBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C6515',
            border: `1px solid ${T.amber}`,
          }}>
            <Icon name="user" size={22} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Panay Kusui</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>panay@indivore.app</div>
          </div>
          <Chip size="sm" tone="sage">synced</Chip>
        </Card>
      </div>

      {/* Active study language */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Active study language" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16,
          overflow: 'hidden',
        }}>
          {SETTINGS_LANGS.map((l, i, arr) => {
            const active = l.code === activeLang
            return (
              <button
                key={l.code}
                onClick={() => setActiveLang(l.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '12px 14px', textAlign: 'left',
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                  background: active ? T.crimsonBg : 'transparent',
                  transition: 'background .15s', cursor: 'pointer', border: 'none',
                }}
              >
                <LangAvatar letter={l.letter} color={l.color} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 14, fontWeight: 600, color: T.ink }}>
                    {l.name}
                  </div>
                  {l.dialect && (
                    <div style={{ fontSize: 11.5, color: T.inkSoft }}>default · {l.dialect}</div>
                  )}
                </div>
                {active ? (
                  <div style={{
                    width: 22, height: 22, borderRadius: 999, background: T.crimson,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="check" size={13} color="#fff" strokeWidth={2.6} />
                  </div>
                ) : (
                  <Icon name="chevron" size={14} color={T.inkFaint} />
                )}
              </button>
            )
          })}
          <button style={{
            padding: '11px 14px', textAlign: 'center', width: '100%',
            fontSize: 12.5, color: T.crimson, fontWeight: 600,
            borderTop: `1px solid ${T.lineSoft}`, background: 'none', cursor: 'pointer',
            border: 'none',
          }}>
            See all 16 Formosan languages
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Preferences" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
        }}>
          {/* Interface language */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 8 }}>Interface language</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'en', label: 'English', soon: false },
                { id: 'zh', label: '繁體中文', soon: true },
              ].map(o => {
                const isActive = locale === o.id
                let labelColor: string = T.ink
                if (isActive) labelColor = T.cream
                else if (o.soon) labelColor = T.inkFaint
                return (
                <button
                  key={o.id}
                  disabled={o.soon}
                  onClick={() => !o.soon && setLocale(o.id)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 10,
                    background: isActive ? T.ink : T.paper,
                    color: labelColor,
                    border: `1px solid ${isActive ? T.ink : T.lineSoft}`,
                    fontSize: 13, fontWeight: 500,
                    cursor: o.soon ? 'not-allowed' : 'pointer',
                  }}
                >
                  {o.label}{o.soon ? ' · soon' : ''}
                </button>
                )
              })}
            </div>
          </div>

          {/* Daily review goal */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Daily review goal</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 22, fontWeight: 600, color: T.crimson }}>
                  {goal}
                </span>
                <span style={{ fontSize: 11, color: T.inkMute }}>cards</span>
              </div>
            </div>
            <input
              type="range" min="5" max="50" step="5" value={goal}
              onChange={e => setGoal(Number(e.target.value))}
              style={{ width: '100%', accentColor: T.crimson }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: T.inkFaint, marginTop: 2,
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              <span>5</span><span>25</span><span>50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div style={{ padding: '0 18px' }}>
        <SectionHead title="Account" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 16, overflow: 'hidden',
        }}>
          {ACCOUNT_ROWS.map((row, i, arr) => (
            <button
              key={row.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 14px', textAlign: 'left',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.lineSoft}` : 'none',
                color: row.danger ? T.crimson : T.ink,
                background: 'none', cursor: 'pointer', border: 'none',
              }}
            >
              <Icon name={row.icon} size={17} color={row.danger ? T.crimson : T.inkSoft} strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{row.label}</span>
              {!row.danger && <Icon name="chevron" size={14} color={T.inkFaint} />}
            </button>
          ))}
        </div>
        <div style={{
          textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
          color: T.inkFaint, marginTop: 14, letterSpacing: '0.05em',
        }}>
          Indivore v0.1 · 行動族語筆記本
        </div>
      </div>
    </div>
  )
}
