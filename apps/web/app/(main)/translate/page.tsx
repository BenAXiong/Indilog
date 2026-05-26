'use client'

import { useState } from 'react'
import { T } from '@/lib/tokens'
import { Chip, Icon } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { ACTIVE_LANG, TRANSLATE_LANGS } from '@/lib/mock-data'

export default function TranslatePage() {
  const lang = ACTIVE_LANG
  const [src, setSrc] = useState('en')
  const [tgt, setTgt] = useState('ami')
  const [text, setText] = useState('I want to learn your language.')
  const [out] = useState('Maolah kako misanga to sowal no niyaroʼ iso.')

  const srcLang = TRANSLATE_LANGS.find(o => o.code === src)
  const tgtLang = TRANSLATE_LANGS.find(o => o.code === tgt)

  const handleSwap = () => {
    const prevSrc = src
    const prevTgt = tgt
    setSrc(prevTgt)
    setTgt(prevSrc)
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Translate" langName={lang.name} langDialect={lang.dialect} />

      <div style={{ fontSize: 12, color: T.inkMute, lineHeight: 1.4, padding: '0 4px', marginTop: -6 }}>
        Independent of your study language · supported pairs only
      </div>

      {/* Pair selector */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        background: T.paperHi, borderRadius: 16, border: `1px solid ${T.lineSoft}`,
        overflow: 'hidden',
      }}>
        <button style={{
          padding: '12px 14px', textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 1,
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            From
          </span>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 17, fontWeight: 500, color: T.ink }}>
            {srcLang?.name}
          </span>
        </button>
        <button
          onClick={handleSwap}
          style={{
            padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.crimson,
            borderLeft: `1px solid ${T.lineSoft}`, borderRight: `1px solid ${T.lineSoft}`,
            background: T.paper, cursor: 'pointer', border: `1px solid ${T.lineSoft}`,
          }}
        >
          <Icon name="swap" size={18} strokeWidth={2} />
        </button>
        <button style={{
          padding: '12px 14px', textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 1,
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            To
          </span>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 17, fontWeight: 500, color: T.ink }}>
            {tgtLang?.name}
          </span>
        </button>
      </div>

      {/* Source panel */}
      <div style={{
        background: T.paperHi, border: `1.5px solid ${T.line}`,
        borderRadius: 18, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            {srcLang?.name}
          </span>
          <button
            onClick={() => setText('')}
            style={{ color: T.inkMute, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Clear
          </button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          placeholder="Type or paste…"
          style={{
            width: '100%', border: 0, background: 'transparent', resize: 'none', outline: 'none',
            fontFamily: 'inherit', fontSize: 16, fontWeight: 400, color: T.ink, lineHeight: 1.4,
          }}
        />
      </div>

      {/* Output panel */}
      <div style={{
        background: `linear-gradient(180deg, ${T.cream}, ${T.paper})`,
        border: `1.5px solid ${T.crimsonBg}`,
        borderRadius: 18, padding: '14px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* top accent bar */}
        <div style={{
          position: 'absolute', top: -1, left: 16, height: 3, width: 36,
          background: T.crimson, borderRadius: '0 0 4px 4px',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.crimson,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            {tgtLang?.name}
          </span>
          <Chip size="sm" tone="ghost" icon="sparkle">AI</Chip>
        </div>
        <div style={{
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 19, color: T.ink, lineHeight: 1.35,
          fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.015em',
        }}>
          {out}
        </div>

        <div style={{
          display: 'flex', gap: 8, marginTop: 14,
          paddingTop: 12, borderTop: `1px solid ${T.crimsonBg}`,
        }}>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8, background: T.paperHi,
            border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            <Icon name="copy" size={13} strokeWidth={1.8} /> Copy
          </button>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8, background: T.paperHi,
            border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            <Icon name="speaker" size={13} strokeWidth={1.8} /> Listen
          </button>
          <div style={{ flex: 1 }} />
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8,
            background: T.crimson, color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
          }}>
            <Icon name="bookmark" size={13} strokeWidth={1.8} color="#fff" /> Save
          </button>
        </div>
      </div>

      <div style={{
        fontSize: 11.5, color: T.inkMute, lineHeight: 1.5,
        padding: '0 4px', display: 'flex', gap: 6, alignItems: 'flex-start',
      }}>
        <Icon name="sparkle" size={12} color={T.inkMute} strokeWidth={1.8} style={{ marginTop: 2, flexShrink: 0 }} />
        AI translations approximate. Verify with a fluent speaker before relying on them.
      </div>
    </div>
  )
}
