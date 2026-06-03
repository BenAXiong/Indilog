'use client'

import { useState, useRef } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { useLang } from '@/lib/context/LangDialectProvider'
import { TRANSLATION_LANGUAGES, getValidTargets, isPairSupported } from '@/lib/translation-pairs'
import { createItem } from '@/lib/db/notebook/items'

const MAX_CHARS = 800

function langLabel(code: string): string {
  return TRANSLATION_LANGUAGES.find(l => l.code === code)?.label ?? code
}

// ILRDF dialect codes for Amis
const AMI_DIALECTS: { code: string; label: string; dialectName: string }[] = [
  { code: 'ami_Coas', label: 'Coastal',    dialectName: '海岸阿美語' },
  { code: 'ami_Heng', label: 'Hengchun',   dialectName: '恆春阿美語' },
  { code: 'ami_Mala', label: 'Malan',      dialectName: '馬蘭阿美語' },
  { code: 'ami_Sout', label: 'Southern',   dialectName: '南部阿美語' },
  { code: 'ami_Xiug', label: 'Xiuguluan',  dialectName: '秀姑巒阿美語' },
]

function dialectToIlrdf(dialectName: string | null): string {
  return AMI_DIALECTS.find(d => d.dialectName === dialectName)?.code ?? 'ami_Coas'
}

export default function TranslatePage() {
  const { lang, dialect, dialectLabel } = useLang()
  const [src, setSrc]               = useState('zho_Hant')
  const [tgt, setTgt]               = useState('ami_Latn')
  const [amiDialect, setAmiDialect] = useState(() => dialectToIlrdf(dialect))
  const [text, setText] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelId,   setModelId]   = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [listening, setListening] = useState(false)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const validTargets = getValidTargets(src)
  const pairOk = isPairSupported(src, tgt)
  const charsLeft = MAX_CHARS - text.length
  const canSwap = isPairSupported(tgt, src)

  function handleSrcChange(newSrc: string) {
    setSrc(newSrc)
    setOutput('')
    setError(null)
    const targets = getValidTargets(newSrc)
    if (!targets.includes(tgt)) setTgt(targets[0] ?? '')
  }

  function handleSwap() {
    if (!canSwap) return
    setSrc(tgt)
    setTgt(src)
    setText(output)
    setOutput(text)
    setError(null)
  }

  async function handleTranslate() {
    if (!text.trim() || !pairOk || loading) return
    setLoading(true)
    setError(null)
    setOutput('')
    setModelId(null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), sourceLang: src, targetLang: tgt, dialect: AMI_DIALECTS.find(d => d.code === amiDialect)?.dialectName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Translation failed.'); return }
      setOutput(data.translation)
      setModelId(data.modelId ?? null)
    } catch {
      setError('Could not reach the translation service.')
    } finally {
      setLoading(false)
    }
  }

  async function handleListen() {
    if (!output || listening) return
    setListening(true)
    try {
      const tgtLang = tgt === 'zho_Hant' ? 'zho_Hant' : tgt.replace('_Latn', '')
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: output, dialectCode: amiDialect }),
      })
      const data = await res.json()
      if (data.url) {
        ttsAudioRef.current?.pause()
        const a = new Audio(data.url)
        ttsAudioRef.current = a
        a.onended = () => setListening(false)
        await a.play()
      } else {
        setListening(false)
      }
    } catch {
      setListening(false)
    }
  }

  async function handleCopy() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleSave() {
    if (!output || !text.trim()) return
    // ab = Formosan text, zh = Chinese text, regardless of direction
    const isFormosanSrc = src !== 'zho_Hant'
    await createItem({
      ab:       isFormosanSrc ? text.trim() : output,
      zh:       isFormosanSrc ? output      : text.trim(),
      type:     'sentence',
      language: isFormosanSrc ? src.replace('_Latn', '') : tgt.replace('_Latn', ''),
      note_source: 'dict',
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div style={{ padding: '4px 18px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader title="Translate" langName={lang.name} langDialect={dialectLabel} />

      <div style={{ fontSize: 12, color: T.inkMute, lineHeight: 1.4, padding: '0 4px', marginTop: -6 }}>
        Be patient. AI services can take up to 2 min to &ldquo;wake up&rdquo; when previously inactive
      </div>

      {/* Pair selector */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        background: T.paperHi, borderRadius: 16, border: `1px solid ${T.lineSoft}`,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            From
          </span>
          <select
            value={src}
            onChange={e => handleSrcChange(e.target.value)}
            style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 17, fontWeight: 500, color: T.ink, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', padding: 0 }}
          >
            {TRANSLATION_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSwap}
          disabled={!canSwap}
          aria-label="Swap languages"
          style={{
            padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderLeft: `1px solid ${T.lineSoft}`, borderRight: `1px solid ${T.lineSoft}`,
            background: T.paper, cursor: canSwap ? 'pointer' : 'default',
            color: canSwap ? T.crimson : T.inkFaint, border: `1px solid ${T.lineSoft}`,
          }}
        >
          <Icon name="swap" size={18} strokeWidth={2} />
        </button>

        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            To
          </span>
          <select
            value={tgt}
            onChange={e => { setTgt(e.target.value); setOutput(''); setError(null) }}
            style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 17, fontWeight: 500, color: T.ink, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', padding: 0 }}
          >
            {TRANSLATION_LANGUAGES.map(l => (
              <option key={l.code} value={l.code} disabled={!validTargets.includes(l.code)}>
                {l.label}{!validTargets.includes(l.code) ? ' —' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amis dialect selector — below language pair, only when Amis is involved */}
      {(src === 'ami_Latn' || tgt === 'ami_Latn') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px', marginTop: -8 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Dialect
          </span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {AMI_DIALECTS.map(d => (
              <button key={d.code} onClick={() => setAmiDialect(d.code)} style={{
                padding: '3px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                cursor: 'pointer',
                background: amiDialect === d.code ? T.crimsonBg : T.paperHi,
                border: `1px solid ${amiDialect === d.code ? T.crimson : T.lineSoft}`,
                color: amiDialect === d.code ? T.crimson : T.inkMute,
              }}>{d.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Source panel */}
      <div style={{ background: T.paperHi, border: `1.5px solid ${T.line}`, borderRadius: 18, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {langLabel(src)}
          </span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: charsLeft < 100 ? T.crimson : T.inkFaint }}>
            {charsLeft}
          </span>
        </div>
        <textarea
          value={text}
          onChange={e => { if (e.target.value.length <= MAX_CHARS) { setText(e.target.value); setOutput(''); setError(null) } }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTranslate() }}
          rows={3}
          placeholder="Type or paste text…"
          style={{ width: '100%', border: 0, background: 'transparent', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 16, color: T.ink, lineHeight: 1.4 }}
        />
        <button
          onClick={handleTranslate}
          disabled={!text.trim() || loading || !pairOk}
          style={{
            marginTop: 8, width: '100%', padding: '11px 0', borderRadius: 12,
            background: text.trim() && pairOk && !loading ? T.ink : T.lineSoft,
            color: text.trim() && pairOk && !loading ? T.cream : T.inkFaint,
            fontSize: 14, fontWeight: 600, border: 'none',
            cursor: text.trim() && pairOk && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background .15s',
          }}
        >
          <Icon name="sparkle" size={14} color="currentColor" />
          {loading ? 'Translating…' : 'Translate'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: T.amberBg, border: `1px solid ${T.amber}`, fontSize: 13, color: T.terra }}>
          {error}
        </div>
      )}

      {/* Output panel */}
      {(output || loading) && (
        <div style={{
          background: `linear-gradient(180deg, ${T.cream}, ${T.paper})`,
          border: `1.5px solid ${T.crimsonBg}`, borderRadius: 18, padding: '14px 16px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -1, left: 16, height: 3, width: 36, background: T.crimson, borderRadius: '0 0 4px 4px' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: T.crimson, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              {langLabel(tgt)}
            </span>
            {modelId && (
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.cream }}>
                {modelId}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
              {[220, 160, 100].map(w => (
                <div key={w} className="animate-iv-shimmer" style={{ height: 14, width: w, borderRadius: 7, background: T.lineSoft }} />
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 19, color: T.ink, lineHeight: 1.4, fontStyle: 'italic', letterSpacing: '-0.015em' }}>
              {output ? output.charAt(0).toUpperCase() + output.slice(1) : ''}
            </div>
          )}

          {output && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.crimsonBg}` }}>
              <button onClick={handleCopy} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 8, background: T.paperHi,
                border: `1px solid ${T.lineSoft}`, color: copied ? T.sage : T.inkSoft,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                <Icon name={copied ? 'check' : 'copy'} size={13} strokeWidth={1.8} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={handleListen} disabled={listening} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 8, background: listening ? T.amberBg : T.paperHi,
                border: `1px solid ${listening ? T.amber : T.lineSoft}`,
                color: listening ? T.amber : T.inkSoft,
                fontSize: 12, fontWeight: 500, cursor: listening ? 'default' : 'pointer',
              }}>
                <Icon name="speaker" size={13} strokeWidth={1.8} />
                {listening ? '…' : 'Listen'}
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={handleSave} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8,
                background: saved ? T.sage : T.crimson, color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                transition: 'background .15s',
              }}>
                <Icon name={saved ? 'check' : 'bookmark'} size={13} strokeWidth={1.8} color="#fff" />
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: T.inkMute, lineHeight: 1.5, padding: '0 4px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={12} color={T.inkMute} strokeWidth={1.8} style={{ marginTop: 2, flexShrink: 0 }} />
        Draft translation · Verify with a fluent speaker before relying on output.
      </div>
    </div>
  )
}
