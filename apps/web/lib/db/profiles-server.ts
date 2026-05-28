import { createClient } from '@/lib/supabase/server'
import { LANGUAGES, getLanguage } from '@/lib/languages'
import { getGlid } from '@/lib/lang/lang-bridge'
import { shortDialectLabel } from '@/lib/lang/dialects'

export async function getActiveLangServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { lang: LANGUAGES[0], dialect: null as string | null, dialectLabel: null as string | null }

  const { data } = await supabase
    .from('ind_profiles')
    .select('active_study_language, default_dialect')
    .eq('user_id', user.id)
    .maybeSingle()

  const lang = getLanguage(data?.active_study_language ?? '') ?? LANGUAGES[0]
  const dialect = data?.default_dialect ?? null
  const dialectLabel = dialect ? shortDialectLabel(dialect, getGlid(lang.code) ?? '01') : null

  return { lang, dialect, dialectLabel }
}
