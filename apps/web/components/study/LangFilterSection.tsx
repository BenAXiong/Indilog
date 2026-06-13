'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { listUserLanguages } from '@/lib/db/srs/flashcards'
import { patchPreferences } from '@/lib/db/profile/preferences'
import { getLangName } from '@/lib/lang/lang-bridge'

// ─── SessionToggle ────────────────────────────────────────────────────────────

export function SessionToggle({ label, sub, on, onToggle }: {
  label:    string
  sub:      string
  on:       boolean
  onToggle: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 1 }}>{sub}</div>
      </div>
      <button onClick={onToggle} aria-label={`Toggle ${label}`} style={{
        width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? T.sage : T.line, border: 'none', cursor: 'pointer', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20,
          borderRadius: 999, background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
        }} />
      </button>
    </div>
  )
}

// ─── LangFilterSection ────────────────────────────────────────────────────────

export function LangFilterSection({
  showAllLangs,
  setShowAllLangs,
  excludedLangs,
  setExcludedLangs,
  onReloadNeeded,
  showAccumulateNote = false,
}: {
  showAllLangs:      boolean
  setShowAllLangs:   (v: boolean) => void
  excludedLangs:     string[]
  setExcludedLangs:  (v: string[]) => void
  onReloadNeeded:    () => void
  showAccumulateNote?: boolean
}) {
  const [availLangs, setAvailLangs] = useState<string[] | null>(null)

  useEffect(() => {
    if (!showAllLangs && availLangs === null) listUserLanguages().then(setAvailLangs)
  }, [showAllLangs, availLangs])

  function handleToggleShowAll(v: boolean) {
    setShowAllLangs(v)
    localStorage.setItem('srs_show_all_langs', String(v))
    if (v) {
      setExcludedLangs([])
      localStorage.setItem('srs_excluded_langs', '[]')
      patchPreferences({ show_all_langs: v, excluded_langs: [] })
    } else {
      patchPreferences({ show_all_langs: v })
    }
    onReloadNeeded()
  }

  function handleToggleLang(code: string) {
    const next = excludedLangs.includes(code)
      ? excludedLangs.filter(l => l !== code)
      : [...excludedLangs, code]
    setExcludedLangs(next)
    localStorage.setItem('srs_excluded_langs', JSON.stringify(next))
    patchPreferences({ excluded_langs: next })
    onReloadNeeded()
  }

  return (
    <>
      <SessionToggle
        label="Show all languages"
        sub="Include all languages in this session"
        on={showAllLangs}
        onToggle={() => handleToggleShowAll(!showAllLangs)}
      />
      {!showAllLangs && (
        <div style={{ padding: '4px 16px 14px', borderTop: `1px solid ${T.lineSoft}` }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 0 8px' }}>
            Languages
          </div>
          {availLangs === null ? (
            <div style={{ fontSize: 13, color: T.inkMute, padding: '4px 0' }}>Loading…</div>
          ) : availLangs.map(code => {
            const included = !excludedLangs.includes(code)
            return (
              <button key={code} onClick={() => handleToggleLang(code)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 0', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  background: included ? T.crimson : 'transparent',
                  border: `1.5px solid ${included ? T.crimson : T.line}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {included && <Icon name="check" size={11} color="#fff" strokeWidth={2.5} />}
                </div>
                <span style={{ fontSize: 14, color: T.ink }}>{getLangName(code)}</span>
              </button>
            )
          })}
          {showAccumulateNote && (
            <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
              Excluded languages still accumulate due cards.
            </div>
          )}
        </div>
      )}
    </>
  )
}
