import { createClient } from '@/lib/supabase/client'

export type UserPreferences = {
  review_cap:        number
  learn_cap:         number
  review_more_size:  number | null
  review_mode:       string
  reset_hour:        number
  show_hard_easy:    boolean
  show_buttons:      boolean
  shuffle_new:       boolean
  learning_steps:    number
  show_all_langs:    boolean
  excluded_langs:    string[]
  auto_lookup:       boolean
  dict_sources:      string[]
  translate_dialect: string
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  review_cap:        100,
  learn_cap:         10,
  review_more_size:  null,
  review_mode:      'forward',
  reset_hour:       4,
  show_hard_easy:   true,
  show_buttons:     true,
  shuffle_new:      false,
  learning_steps:   3,
  show_all_langs:   true,
  excluded_langs:   [],
  auto_lookup:      true,
  dict_sources:     ['moe'],
  translate_dialect: 'ami_Coas',
}

export async function patchPreferences(patch: Partial<UserPreferences>): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data } = await supabase.from('ind_profiles').select('preferences').eq('user_id', user.id).single()
  const current = { ...DEFAULT_PREFERENCES, ...(data?.preferences as Partial<UserPreferences>) }
  await savePreferences(user.id, { ...current, ...patch })
}

export async function savePreferences(userId: string, prefs: UserPreferences): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('ind_profiles')
    .update({ preferences: prefs as unknown as Record<string, unknown> })
    .eq('user_id', userId)
}
