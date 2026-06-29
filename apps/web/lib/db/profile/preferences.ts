import { createClient } from '@/lib/supabase/client'

export type UserPreferences = {
  review_target:     number
  learn_target:      number
  review_more_size:  number | null
  review_mode:       string
  reset_hour:        number
  show_hard_easy:    boolean
  show_buttons:      boolean
  shuffle_new:       boolean
  show_all_langs:    boolean
  excluded_langs:    string[]
  auto_lookup:       boolean
  dict_sources:      string[]
  translate_dialect: string
  shuffle_tests:     boolean
  shuffle_exposure:  boolean
  // Two-slot goal system: learn_target/review_target = manual (never overwritten by simulation Apply).
  // Optional so existing buildPrefs/spread code without the field still type-checks.
  goal_mode?:        'manual' | 'calculated'
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  review_target:     100,
  learn_target:      10,
  review_more_size:  null,
  review_mode:      'forward',
  reset_hour:       4,
  show_hard_easy:   true,
  show_buttons:     true,
  shuffle_new:      false,
  show_all_langs:   true,
  excluded_langs:   [],
  auto_lookup:      true,
  dict_sources:     ['moe'],
  translate_dialect: 'ami_Coas',
  shuffle_tests:    true,
  shuffle_exposure: true,
  goal_mode:        'manual',
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
