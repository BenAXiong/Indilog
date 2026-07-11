// Amis-specific curated fuzzy-matching data and candidate generation.
// Ported from the Grimoire browser extension (族語魔書/Ext_族語魔書_PopupDict/
// background.js) — see docs/kilang-moe-api.md. Used against both Kilang
// (apps/web/app/api/dict/search/route.ts) and ePark (apps/web/lib/corpus/dict.ts)
// word search, gated behind the dict tab's "swaps" toggle (Amis only — these
// tables don't generalize to the other 15 languages without per-language
// curation).

export const MOE_COMMON_PREFIXES = ['sapi', 'paka', 'pina', 'maka', 'mala', 'mipa', 'misa', 'ma', 'mi', 'pa', 'pi', 'ka', 'sa', 'si', 'ni']
export const MOE_COMMON_SUFFIXES = ['ayay', 'anay', 'enay', 'ay', 'en', 'an', 'aw', 'to']
// b/f/v form a 3-way interchangeable group (Amis orthographic variation); u/o and l/r stay 2-way.
export const MOE_SWAP_GROUPS: string[][] = [['u', 'o'], ['l', 'r'], ['b', 'f', 'v']]
export const MAX_MOE_ALT_POSITIONS = 4
export const MAX_MOE_FALLBACK_CANDIDATES = 30
export const MAX_MOE_PREFIX_STRIPS = 2
export const MAX_MOE_SUFFIX_STRIPS = 1
export const MIN_MOE_RECOVERY_BASE_LEN = 4

export function moeSwapAlts(c: string): string[] {
  const group = MOE_SWAP_GROUPS.find(g => g.includes(c))
  return group ? group.filter(x => x !== c) : []
}

// Generalized version of Grimoire's makeMoeAltSpellings — handles both 2-way
// swap pairs (u/o, l/r) and the 3-way b/f/v group (each active position gets
// "keep original" + one choice per alternate, not just a binary toggle).
export function makeMoeAltSpellings(word: string): string[] {
  const positions = [...word].map((c, i) => ({ i, alts: moeSwapAlts(c) })).filter(p => p.alts.length > 0)
  if (positions.length === 0) return []

  const active  = positions.slice(0, MAX_MOE_ALT_POSITIONS)
  const radices = active.map(p => p.alts.length + 1) // +1 for "keep original"
  const total   = radices.reduce((a, b) => a * b, 1)
  const results = new Set<string>()
  for (let combo = 1; combo < total; combo++) {
    const chars = word.split('')
    let rem = combo
    for (let k = 0; k < active.length; k++) {
      const choice = rem % radices[k]
      rem = Math.floor(rem / radices[k])
      if (choice > 0) chars[active[k].i] = active[k].alts[choice - 1]
    }
    const alt = chars.join('')
    if (alt !== word) results.add(alt)
  }
  return [...results]
}

export function getMoeRecoveryLength(word: string): number {
  return word.replace(/'/g, '').length
}

export function uniqueMoeWords(words: string[]): string[] {
  const seen = new Set<string>()
  return words.filter(word => {
    const key = word.toLowerCase()
    if (!word || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function makeMoeGlottalRepairs(word: string): string[] {
  if (!word || word.includes("'")) return []
  const repairs: string[] = []
  if (/^[aeiou]/.test(word)) repairs.push(`'${word}`)
  if (/[aeiou]$/.test(word)) repairs.push(`${word}'`)
  for (const prefix of MOE_COMMON_PREFIXES) {
    if (!word.startsWith(prefix)) continue
    const rest = word.slice(prefix.length)
    if (rest.length >= MIN_MOE_RECOVERY_BASE_LEN && /^[aeiou]/.test(rest)) {
      repairs.push(`${prefix}'${rest}`)
    }
  }
  return uniqueMoeWords(repairs)
}

type MoeStrippedState = { word: string; prefixStrips: number; suffixStrips: number }

export function makeMoeStrippedStates(word: string): MoeStrippedState[] {
  const initial: MoeStrippedState = { word, prefixStrips: 0, suffixStrips: 0 }
  const queue: MoeStrippedState[] = [initial]
  const states: MoeStrippedState[] = []
  const seen = new Set([`${word}:0:0`])

  for (let index = 0; index < queue.length; index++) {
    const state = queue[index]
    if (state.prefixStrips < MAX_MOE_PREFIX_STRIPS) {
      for (const prefix of MOE_COMMON_PREFIXES) {
        if (!state.word.startsWith(prefix)) continue
        const stripped = state.word.slice(prefix.length)
        if (getMoeRecoveryLength(stripped) < MIN_MOE_RECOVERY_BASE_LEN) continue
        const next = { word: stripped, prefixStrips: state.prefixStrips + 1, suffixStrips: state.suffixStrips }
        const key = `${next.word}:${next.prefixStrips}:${next.suffixStrips}`
        if (seen.has(key)) continue
        seen.add(key); states.push(next); queue.push(next)
      }
    }
    if (state.suffixStrips < MAX_MOE_SUFFIX_STRIPS) {
      for (const suffix of MOE_COMMON_SUFFIXES) {
        if (!state.word.endsWith(suffix)) continue
        const stripped = state.word.slice(0, -suffix.length)
        if (getMoeRecoveryLength(stripped) < MIN_MOE_RECOVERY_BASE_LEN) continue
        const next = { word: stripped, prefixStrips: state.prefixStrips, suffixStrips: state.suffixStrips + 1 }
        const key = `${next.word}:${next.prefixStrips}:${next.suffixStrips}`
        if (seen.has(key)) continue
        seen.add(key); states.push(next); queue.push(next)
      }
    }
  }
  return states
}

export type MoeCandidate = { word: string; score: number }

export function makeMoeFallbackCandidates(word: string): MoeCandidate[] {
  const normalized = word.trim().toLowerCase()
  const candidates: MoeCandidate[] = []
  const seen = new Set([normalized])

  function add(wordValue: string, score: number) {
    if (!wordValue || getMoeRecoveryLength(wordValue) < MIN_MOE_RECOVERY_BASE_LEN) return
    const key = wordValue.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ word: wordValue, score })
  }

  function addForms(baseWord: string, baseScore: number) {
    add(baseWord, baseScore)
    const alts = makeMoeAltSpellings(baseWord)
    for (const alt of alts) add(alt, baseScore + 1)
    for (const repaired of makeMoeGlottalRepairs(baseWord)) add(repaired, baseScore + 2)
    for (const alt of alts) {
      for (const repaired of makeMoeGlottalRepairs(alt)) add(repaired, baseScore + 3)
    }
  }

  addForms(normalized, 0)
  for (const state of makeMoeStrippedStates(normalized)) {
    const depth = state.prefixStrips + state.suffixStrips
    addForms(state.word, 4 + (depth - 1) * 4)
  }

  return candidates.sort((a, b) => a.score - b.score).slice(0, MAX_MOE_FALLBACK_CANDIDATES)
}
