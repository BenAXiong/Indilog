'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Button, SectionHead, Icon, Toast } from '@/components/ui'
import ScreenHeader from '@/components/nav/ScreenHeader'
import { ACTIVE_LANG } from '@/lib/mock-data'
import { createItem, updateItem, listItems, type Item, type ItemType } from '@/lib/db/items'
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

function typeColor(t: string) {
  if (t === 'word')     return { color: T.crimson, bg: T.crimsonBg, border: '#EFCAB8' }
  if (t === 'sentence') return { color: T.sage,    bg: T.sageBg,    border: '#D2D8AE' }
  return                       { color: T.amber,   bg: T.amberBg,   border: '#EBD49A' }
}

export default function CapturePage() {
  const lang = ACTIVE_LANG
  const [activeLanguage, setActiveLanguage] = useState(lang.code)
  const [activeLangName, setActiveLangName] = useState(lang.name)
  const [activeLangDialect, setActiveLangDialect] = useState(lang.dialect)
  const [userId, setUserId] = useState<string | null>(null)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [type, setType] = useState<ItemType>('sentence')
  const [dialect, setDialect] = useState('')
  const [place, setPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [lookedUp, setLookedUp] = useState(false)
  const [showAllTokens, setShowAllTokens] = useState(false)

  // Selectors
  const [sources, setSources] = useState<Source[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)

  // Feedback
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState(false)

  // Recent captures
  const [recentItems, setRecentItems] = useState<Item[]>([])

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
    listItems({ limit: 5 }).then(setRecentItems)
  }, [])

  const visibleTokens = showAllTokens ? MOCK_TOKENS : MOCK_TOKENS.slice(0, 4)

  function loadItem(item: Item) {
    setEditingId(item.id)
    setText(item.text)
    setType(item.type as ItemType)
    setDialect(item.dialect ?? '')
    setPlace(item.place_heard ?? '')
    setNotes(item.notes ?? '')
    setLookedUp(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleClear() {
    setEditingId(null)
    setText('')
    setDialect('')
    setPlace('')
    setNotes('')
    setSelectedSource(null)
    setSelectedSpeaker(null)
    setLookedUp(false)
  }

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)

    const payload = {
      text: text.trim(),
      type,
      language: activeLanguage,
      dialect: dialect.trim() || undefined,
      place_heard: place.trim() || undefined,
      notes: notes.trim() || undefined,
      source_id: selectedSource?.id,
      speaker_id: selectedSpeaker?.id,
    }

    let ok = false
    if (editingId) {
      ok = await updateItem(editingId, payload)
    } else {
      const item = await createItem(payload)
      ok = !!item
      if (item && userId) await incrementCapturedToday(userId)
    }

    setSaving(false)
    if (!ok) {
      setError(true)
      setTimeout(() => setError(false), 2500)
      return
    }

    setSavedMsg(editingId ? 'Updated' : 'Saved to your notebook')
    setSaved(true)
    listItems({ limit: 5 }).then(setRecentItems)
    setTimeout(() => {
      setSaved(false)
      handleClear()
    }, 1800)
  }

  async function handleSetDefault() {
    if (!userId) return
    const supabase = createClient()
    await supabase
      .from('ind_profiles')
      .update({ active_study_language: activeLanguage })
      .eq('user_id', userId)
    setSavedMsg('Set as default language')
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div style={{ padding: '4px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        title="Capture"
        langName={activeLangName}
        langDialect={activeLangDialect}
      />

      {/* Editing banner */}
      {editingId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: T.amberBg, border: `1px solid ${T.amber}`,
          fontSize: 12.5, color: T.inkSoft,
        }}>
          <Icon name="pen" size={14} color={T.amber} strokeWidth={2} />
          <span style={{ flex: 1 }}>Editing saved item</span>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkFaint, padding: 0 }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Big input */}
      <div style={{
        background: T.paperHi, border: `1.5px solid ${editingId ? T.amber : T.line}`,
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
                <Icon name="chev-d" size={14} strokeWidth={2.2}
                  style={{ transform: showAllTokens ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
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
                  <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 15, fontWeight: 500, color: T.ink }}>{tk.word}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontStyle: 'italic' }}>{tk.gloss}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="md" icon="search" style={{ flex: 1 }} onClick={() => setLookedUp(true)}>
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
              icon="bookmark" label="Source"
              options={sources} selected={selectedSource}
              onSelect={opt => setSelectedSource(opt as Source | null)}
              onCreate={async name => { const s = await createSource(name, activeLanguage); if (s) setSources(p => [...p, s]); return s }}
            />
          </div>
          {/* Speaker */}
          <div style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <InlineSelector
              icon="user" label="Speaker"
              options={speakers} selected={selectedSpeaker}
              onSelect={opt => setSelectedSpeaker(opt as Speaker | null)}
              onCreate={async name => { const s = await createSpeaker(name); if (s) setSpeakers(p => [...p, s]); return s }}
            />
          </div>
          {/* Dialect */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
          }}>
            <Icon name="wave" size={16} color={T.inkSoft} strokeWidth={1.8} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60 }}>Dialect</span>
            <input
              value={dialect} onChange={e => setDialect(e.target.value)}
              placeholder="(optional)"
              style={{ flex: 1, border: 0, background: 'transparent', fontSize: 14, fontWeight: 500, color: T.ink, padding: 0, outline: 'none' }}
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
              style={{ flex: 1, border: 0, background: 'transparent', fontSize: 14, fontWeight: 500, color: T.ink, padding: 0, outline: 'none' }}
            />
          </div>
          {/* Notes */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
            <Icon name="pen" size={16} color={T.inkSoft} strokeWidth={1.8} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: T.inkMute, fontWeight: 500, width: 60, paddingTop: 2 }}>Notes</span>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Anything to remember…"
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
          {editingId ? 'Cancel' : 'Clear'}
        </Button>
        <Button
          variant="primary" size="lg" icon="check"
          style={{ flex: 2 }}
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
        </Button>
      </div>

      {/* Recent captures */}
      {recentItems.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHead title="Recent" />
            <button
              onClick={handleSetDefault}
              style={{
                fontSize: 11.5, color: T.inkSoft, background: 'none', border: 'none',
                cursor: 'pointer', padding: '0 0 12px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Icon name="check" size={12} color={T.inkSoft} strokeWidth={2} />
              Set {activeLangName} as default
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentItems.map(item => {
              const tc = typeColor(item.type)
              const isEditing = editingId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => loadItem(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: isEditing ? T.amberBg : T.paperHi,
                    border: `1px solid ${isEditing ? T.amber : T.lineSoft}`, borderRadius: 12,
                    textAlign: 'left', cursor: 'pointer', width: '100%',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: 'Newsreader, Georgia, serif',
                      fontSize: 14, fontWeight: 500, color: T.ink,
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.text}
                    </span>
                  </div>
                  <span style={{
                    padding: '2px 7px', borderRadius: 999,
                    background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                    fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                  }}>
                    {item.type}
                  </span>
                  <Icon name="pen" size={13} color={T.inkFaint} strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {saved && <Toast tone="sage">{savedMsg}</Toast>}
      {error && <Toast tone="amber">Failed to save — try again</Toast>}
    </div>
  )
}
