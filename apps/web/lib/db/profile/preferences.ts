import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/supabase/session'

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

export type ReviewPrefsSnapshot = {
  prefs:           UserPreferences
  includeInReview: boolean
}

// Single authoritative read of ind_profiles (preferences + include_in_review), used wherever a
// page needs to build a query from the user's real settings instead of the localStorage cache.
// Keeps localStorage in sync as a side effect so components that read it synchronously (toggle
// UI initial state) see the DB value on next read, not just query-building code.
export async function fetchReviewPrefsSnapshot(userId: string): Promise<ReviewPrefsSnapshot> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ind_profiles')
    .select('preferences, include_in_review')
    .eq('user_id', userId)
    .maybeSingle()
  const prefs = { ...DEFAULT_PREFERENCES, ...(data?.preferences as Partial<UserPreferences> | undefined) }
  if (globalThis.window !== undefined) {
    localStorage.setItem('srs_show_all_langs', String(prefs.show_all_langs))
    localStorage.setItem('srs_excluded_langs', JSON.stringify(prefs.excluded_langs))
  }
  return { prefs, includeInReview: (data?.include_in_review as boolean | null) ?? true }
}

export async function patchPreferences(patch: Partial<UserPreferences>): Promise<void> {
  const supabase = createClient()
  const user = await getSessionUser()
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
