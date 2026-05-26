'use client'

import { useState, useEffect } from 'react'
import { LANGUAGES, getLanguage } from '@/lib/languages'
import { getProfile } from '@/lib/db/profiles'
import { getGlid } from '@/lib/learn/lang-bridge'
import { shortDialectLabel } from '@/lib/learn/dialects'
import type { Language } from '@/lib/languages'

const DEFAULT: Language = LANGUAGES[0] // Amis

/**
 * Returns the current user's active study language and dialect from their profile.
 * Falls back to Amis with no dialect until profile loads.
 */
export function useActiveLang() {
  const [lang,         setLang]         = useState<Language>(DEFAULT)
  const [dialect,      setDialect]      = useState<string | null>(null)   // Chinese DB name
  const [dialectLabel, setDialectLabel] = useState<string | null>(null)   // Short English label

  useEffect(() => {
    getProfile()
      .then(profile => {
        const l = getLanguage(profile?.active_study_language ?? '') ?? DEFAULT
        setLang(l)
        const d = profile?.default_dialect ?? null
        setDialect(d)
        if (d) setDialectLabel(shortDialectLabel(d, getGlid(l.code) ?? '01'))
      })
      .catch(() => {})
  }, [])

  return { lang, dialect, dialectLabel }
}
