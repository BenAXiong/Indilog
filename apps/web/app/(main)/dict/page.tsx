'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { Card, SectionHead, Chip, Button, Icon } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { ACTIVE_LANG, MOCK_DICT_EXACT, MOCK_DICT_PARTIALS } from '@/lib/mock-data'

export default function DictionaryPage() {
  const lang = ACTIVE_LANG
  const [q, setQ] = useState('cidal')

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScreenHeader title="Dictionary" langName={lang.name} langDialect={lang.dialect} />

      {/* Search row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.paperHi, border: `1.5px solid ${T.line}`, borderRadius: 14,
          padding: '0 14px', height: 52,
        }}>
          <Icon name="search" size={18} color={T.inkMute} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Type a word…"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 18, fontWeight: 400, color: T.ink,
            }}
          />
          <Icon name="mic" size={18} color={T.inkMute} />
        </div>
        <button style={{
          width: 52, height: 52, borderRadius: 14,
          background: T.paperHi, border: `1px solid ${T.line}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: T.inkSoft, flexShrink: 0, cursor: 'pointer',
        }}>
          <Icon name="library" size={17} strokeWidth={1.8} />
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5, color: T.inkMute,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            Sources
          </span>
        </button>
      </div>

      {/* Exact match card */}
      <Card raised pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 30, fontWeight: 500, color: T.ink, letterSpacing: '-0.025em' }}>
                {MOCK_DICT_EXACT.word}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.crimson,
                  textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
                }}>
                  {MOCK_DICT_EXACT.pos}
                </span>
                <span style={{ fontSize: 11, color: T.inkFaint }}>·</span>
                <span style={{ fontSize: 11, color: T.inkMute }}>{MOCK_DICT_EXACT.dialect}</span>
              </div>
            </div>
            <Chip tone="sage" size="sm" icon="check">exact</Chip>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {MOCK_DICT_EXACT.defs.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: T.inkFaint, fontWeight: 600, paddingTop: 2 }}>
                  {d.id}.
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{d.pri}</div>
                  <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 1, lineHeight: 1.35 }}>{d.sec}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Examples */}
        <div style={{ padding: '12px 16px 16px', background: T.paper }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600,
          }}>
            Examples
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_DICT_EXACT.examples.map((ex) => (
              <div key={ex.src} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 14.5, color: T.ink, fontStyle: 'italic' }}>
                  {ex.src}
                </div>
                <div style={{ fontSize: 12.5, color: T.inkSoft }}>{ex.en}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: 12, borderTop: `1px solid ${T.lineSoft}`, background: T.paper,
          display: 'flex', gap: 8,
        }}>
          <Button variant="primary" size="md" icon="bookmark" style={{ flex: 1 }}>Save word</Button>
          <Button variant="secondary" size="md" icon="capture" iconR="arrow-r" style={{ flex: 1 }}>Add context</Button>
        </div>
      </Card>

      {/* Partial matches */}
      <div>
        <SectionHead title="Also matches" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MOCK_DICT_PARTIALS.map((p) => (
            <div key={p.word} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', background: T.paperHi,
              border: `1px solid ${T.lineSoft}`, borderRadius: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 16, fontWeight: 500, color: T.ink }}>
                    {p.word}
                  </span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p.pos}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>{p.gloss}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <Icon name="dict" size={15} strokeWidth={1.8} />
                </button>
                <button style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: T.paper, border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <Icon name="bookmark" size={15} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
