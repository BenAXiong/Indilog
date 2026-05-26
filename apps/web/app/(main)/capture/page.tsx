'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Button, SectionHead, Chip, Icon, Toast } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { ACTIVE_LANG } from '@/lib/mock-data'
import { createItem, type ItemType } from '@/lib/db/items'
import { createClient } from '@/lib/supabase/client'
import { incrementCapturedToday } from '@/lib/db/stats'
import { listSources, createSource, type Source } from '@/lib/db/sources'
import { listSpeakers, createSpeaker, type Speaker } from '@/lib/db/speakers'
import InlineSelector from '@/components/capture/InlineSelector'

const MOCK_TOKENS = [
  { word: 'Maolah',   gloss: 'like / love' },
  { word: 'kako',     gloss: '1sg pronoun' },
  { word: 'tomireng', gloss: 'to stand' },
  { word: 'i',        gloss: 'locative marker' },
  { word: 'riyar',    gloss: 'ocean / sea' },
  { word: 'anini',    gloss: 'today' },
]

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'sentence', label: 'Sentence' },
  { value: 'word',     label: 'Word' },
  { value: 'note',     label: 'Note' },
]

export default function CapturePage() {
  const lang = ACTIVE_LANG
  const [activeLanguage, setActiveLanguage] = useState(lang.code)
  const [userId, setUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [type, setType] = useState<ItemType>('sentence')
  const [lookedUp, setLookedUp] = useState(false)
  const [showAllTokens, setShowAllTokens] = useState(false)
  const [place, setPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('ind_profiles')
        .select('active_study_language')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => { if (data) setActiveLanguage(data.active_study_language) })
    })
    listSources().then(setSources)
    listSpeakers().then(setSpeakers)
  }, [])

  const visibleTokens = showAllTokens ? MOCK_TOKENS : MOCK_TOKENS.slice(0, 4)

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    const item = await createItem({
      text: text.trim(),
      type,
      language: activeLanguage,
      place_heard: place.trim() || undefined,
      notes: notes.trim() || undefined,
      source_id: selectedSource?.id,
      speaker_id: selectedSpeaker?.id,
    })
    setSaving(false)

    if (!item) {
      setError(true)
      setTimeout(() => setError(false), 2500)
      return
    }

    if (userId) await incrementCapturedToday(userId)

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setText('')
      setPlace('')
      setNotes('')
      setSelectedSource(null)
      setSelectedSpeaker(null)
      setLookedUp(false)
    }, 1800)
  }

  const handleClear = () => {
    setText('')
    setPlace('')
    setNotes('')
    setLookedUp(false)
  }

  return (
    <div style={{ padding: '4px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        title="Capture"
        langName={lang.name}
        langDialect={lang.dialect}
      />

      {/* Big input */}
      <div style={{
        background: T.paperHi, border: `1.5px solid ${T.line}`,
        borderRadius: 18, padding: '16px 16px 12px',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.03)',
      }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="A word, sentence, or note you want to keep…"
          rows={3}
          style={{
            width: '100%', border: 0, background: 'transparent', resize: 'none',
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 20, fontWeight: 400, color: T.ink,
            letterSpacing: '-0.015em', lineHeight: 1.35,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 5 }}>
            {TYPE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setType(o.value)}
                style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: type === o.value ? T.ink : T.paper,
                  color: type === o.value ? T.cream : T.inkSoft,
                  border: `1px solid ${type === o.value ? T.ink : T.lineSoft}`,
                  cursor: 'pointer', transition: 'background .15s',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{
              width: 30, height: 30, borderRadius: 9, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Icon name="mic" size={15} strokeWidth={1.8} />
            </button>
            <button style={{
              width: 30, height: 30, borderRadius: 9, background: T.paper,
              border: `1px solid ${T.lineSoft}`, color: T.inkSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Icon name="sparkle" size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {/* Token chips */}
      {lookedUp && (
        <div className="animate-iv-rise">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 4px', marginBottom: 10, gap: 8,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                fontWeight: 500, color: T.inkMute,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                tap to add gloss
              </span>
              <button style={{
                width: 22, height: 22, borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: T.inkSoft, background: T.paper, border: `1px solid ${T.lineSoft}`,
                cursor: 'pointer',
              }}>
                <Icon name="review" size={12} strokeWidth={1.8} />
              </button>
            </div>
            {MOCK_TOKENS.length > 4 && (
              <button
                onClick={() => setShowAllTokens(!showAllTokens)}
                style={{
                  fontSize: 13, fontWeight: 500, color: T.crimson,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                {showAllTokens ? 'Show less' : `See all · ${MOCK_TOKENS.length}`}
                <Icon
                  name="chev-d" size={14} strokeWidth={2.2}
                  style={{ transform: showAllTokens ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleTokens.map((tk, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: T.paperHi,
                border: `1px solid ${T.lineSoft}`, borderRadius: 12,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 500, color: T.ink }}>
                    {tk.word}
                  </span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>{tk.gloss}</span>
                </div>
                <Chip size="sm" tone="sage" icon="check">match</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="secondary" size="md" icon="search"
          style={{ flex: 1 }}
          onClick={() => setLookedUp(true)}
        >
          Lookup
        </Button>
        <Button variant="secondary" size="md" icon="translate" style={{ flex: 1 }}>
          Translate
        </Button>
      </div>

      {/* Metadata */}
      <div>
        <SectionHead title="Context" />
        <div style={{
          background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Source */}
          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="bookmark"
              label="Source"
              options={sources}
              selected={selectedSource}
              onSelect={opt => { setSelectedSource(opt as Source | null) }}
              onCreate={async name => { const s = await createSource(name, activeLanguage); if (s) setSources(prev => [...prev, s]); return s }}
            />
          </div>
          {/* Speaker */}
          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="user"
              label="Speaker"
              options={speakers}
              selected={selectedSpeaker}
              onSelect={opt => { setSelectedSpeaker(opt as Speaker | null) }}
              onCreate={async name => { const s = await createSpeaker(name); if (s) setSpeakers(prev => [...prev, s]); return s }}
            />
          </div>
          {/* Place */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="pin" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Place</span>
            <input
              value={place} onChange={e => setPlace(e.target.value)}
              placeholder="Where heard / seen"
              style={{
                flex: 1, border: 0, background: 'transparent', fontSize: 14,
                fontWeight: 500, color: T.ink, padding: 0, outline: 'none',
              }}
            />
          </div>
          {/* Notes */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px',
          }}>
            <Icon name="pen" size={16} color={T.inkSoft} strokeWidth={1.8} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60, paddingTop: 2 }}>Notes</span>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything to remember…"
              style={{
                flex: 1, border: 0, background: 'transparent', fontSize: 14,
                color: T.ink, padding: 0, resize: 'none',
                fontFamily: 'inherit', lineHeight: 1.4, outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={handleClear}>
          Clear
        </Button>
        <Button
          variant="primary" size="lg" icon="check"
          style={{ flex: 2 }}
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {saved  && <Toast tone="sage">Saved to your notebook</Toast>}
      {error  && <Toast tone="amber">Failed to save — try again</Toast>}
    </div>
  )
}
