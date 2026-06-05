import { createClient } from '@/lib/supabase/client'

export type UserPreferences = {
  daily_cap:       number
  review_mode:     string
  reset_hour:      number
  show_hard_easy:  boolean
  show_buttons:    boolean
  shuffle_new:     boolean
  learning_steps:  number
  show_all_langs:  boolean
  excluded_langs:  string[]
  auto_lookup:     boolean
  dict_sources:    string[]
  translate_dialect: string
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  daily_cap:        100,
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

export async function savePreferences(userId: string, prefs: UserPreferences): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('ind_profiles')
    .update({ preferences: prefs as unknown as Record<string, unknown> })
    .eq('user_id', userId)
}
