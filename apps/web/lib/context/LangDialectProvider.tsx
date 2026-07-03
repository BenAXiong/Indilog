'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { LANGUAGES, getLanguage } from '@/lib/languages'
import { createClient } from '@/lib/supabase/client'
import { getGlid } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'
import type { Language } from '@/lib/languages'
import { getSessionUser } from '@/lib/supabase/session'

const DEFAULT_LANG: Language = LANGUAGES[0] // Amis

type LangDialectContextType = {
  lang: Language
  dialect: string | null       // Chinese DB name e.g. "秀姑巒阿美語"
  dialectLabel: string | null  // Short English label e.g. "Xiuguluan"
  setLang: (code: string) => void
  setDialect: (name: string | null) => void
}

const LangDialectContext = createContext<LangDialectContextType>({
  lang: DEFAULT_LANG,
  dialect: null,
  dialectLabel: null,
  setLang: () => {},
  setDialect: () => {},
})

const CACHE_LANG    = 'profile_lang_code'
const CACHE_DIALECT = 'profile_dialect'

function cachedLang(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANG
  return getLanguage(localStorage.getItem(CACHE_LANG) ?? '') ?? DEFAULT_LANG
}
function cachedDialect(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CACHE_DIALECT) ?? null
}

export function LangDialectProvider({ children }: { children: ReactNode }) {
  // Always start with defaults so server and client render identically (no hydration mismatch).
  // Cache is applied in the first useEffect after hydration.
  const [lang,         setLangState]         = useState<Language>(DEFAULT_LANG)
  const [dialect,      setDialectState]      = useState<string | null>(null)
  const [dialectLabel, setDialectLabelState] = useState<string | null>(null)
  const [userId,       setUserId]            = useState<string | null>(null)

  // Single profile fetch on mount — apply localStorage cache first, then refresh from DB
  useEffect(() => {
    const cachedL = cachedLang()
    const cachedD = cachedDialect()
    setLangState(cachedL)
    setDialectState(cachedD)
    setDialectLabelState(cachedD ? shortDialectLabel(cachedD, getGlid(cachedL.code) ?? '01') : null)

    const supabase = createClient()
    getSessionUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('ind_profiles')
        .select('active_study_language, default_dialect')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return
          const l = getLanguage(data.active_study_language) ?? DEFAULT_LANG
          const d = data.default_dialect ?? null
          localStorage.setItem(CACHE_LANG, l.code)
          if (d) localStorage.setItem(CACHE_DIALECT, d)
          else   localStorage.removeItem(CACHE_DIALECT)
          setLangState(l)
          setDialectState(d)
          setDialectLabelState(d ? shortDialectLabel(d, getGlid(l.code) ?? '01') : null)
        })
    })
  }, [])

  const setLang = useCallback((code: string) => {
    const l = getLanguage(code) ?? DEFAULT_LANG
    localStorage.setItem(CACHE_LANG, l.code)
    localStorage.removeItem(CACHE_DIALECT)
    setLangState(l)
    setDialectState(null)
    setDialectLabelState(null)
    if (!userId) return
    createClient()
      .from('ind_profiles')
      .upsert({ user_id: userId, active_study_language: code, default_dialect: null })
      .then()
  }, [userId])

  const setDialect = useCallback((name: string | null) => {
    if (name) localStorage.setItem(CACHE_DIALECT, name)
    else      localStorage.removeItem(CACHE_DIALECT)
    setDialectState(name)
    setDialectLabelState(
      name ? shortDialectLabel(name, getGlid(lang.code) ?? '01') : null
    )
    if (!userId) return
    createClient()
      .from('ind_profiles')
      .upsert({ user_id: userId, default_dialect: name })
      .then()
  }, [userId, lang.code])

  return (
    <LangDialectContext.Provider value={{ lang, dialect, dialectLabel, setLang, setDialect }}>
      {children}
    </LangDialectContext.Provider>
  )
}

export function useLang(): LangDialectContextType {
  return useContext(LangDialectContext)
}
