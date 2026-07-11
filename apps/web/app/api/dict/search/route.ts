import { NextRequest, NextResponse } from 'next/server'
import { searchWords, searchSentences, isWordBoundaryMatch, type SentenceRow, type WordRow } from '@/lib/corpus/dict'

export const runtime = 'nodejs'

// Kilang/MoE shadow API — external, undocumented upstream. See docs/kilang-moe-api.md
// for the param contract, response quirks, and a pointer to Grimoire's background.js
// (族語魔書/Ext_族語魔書_PopupDict), which already solved fuzzy/recovery matching against
// this same endpoint — read that before adding new fuzzy logic here.
const CITADEL_MOE = 'https://ycm-citadel.vercel.app/api/moe_shadow'
const AMIS_GLID   = '01'

type MoeRow = {
  word_ab: string
  definition: string
  dialect_name: string
  dict_code: string
  examples_json?: string
}

type MoeExample = { ab?: string; zh?: string }

// Module-level helpers keep fetchMoeWords simple enough to pass complexity checks
const normMoeAb  = (s: string) => s.replace(/\|+$/, '').trim()
const normMoeKey = (s: string) =>
  normMoeAb(s).toLowerCase().normalize('NFC').replace(/[\u2018\u2019\u02BC\uA78C]/g, "'")
// MoE raw definitions use misc symbol chars as internal field separators; strip everything
// outside printable ASCII + General Punctuation + CJK ranges.
const cleanMoeDef = (s: string) =>
  s.replace(/[^ -~\u00A0-\u024F\u1E00-\u1EFF\u2000-\u206F\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/g, ' ')
   .replace(/\s+/g, ' ').trim()
const stripAuthor = (s: string) =>
  (s ?? '阿美語').replace(/\s*\([^)]*\)\s*$/, '').trim() || '阿美語'

type MoeMatchKind = 'contains' | 'similar' | 'altSpelling'
type MoeMerged = { word_ab: string; defs: string[]; dialect_name: string; exact: boolean; matchKind?: MoeMatchKind }

function mergeMoeRow(merged: Map<string, MoeMerged>, row: MoeRow, qKey: string) {
  const ab = normMoeAb(row.word_ab)
  if (!ab) return
  const key     = normMoeKey(ab)
  const isExact = key === qKey
  const entry   = merged.get(key)
  if (entry) {
    const def = row.definition ? cleanMoeDef(row.definition) : ''
    if (def && !entry.defs.includes(def)) entry.defs.push(def)
    if (isExact) entry.exact = true
  } else {
    merged.set(key, {
      word_ab: ab,
      defs: row.definition ? [cleanMoeDef(row.definition)] : [],
      dialect_name: stripAuthor(row.dialect_name),
      exact: isExact,
    })
  }
}

// ─── AB-direction fuzzy fallback for Kilang ──────────────────────────────
// Ported from the Grimoire browser extension (族語魔書/Ext_族語魔書_PopupDict/
// background.js), the other production consumer of this same undocumented-
// upstream API — see docs/kilang-moe-api.md. Kilang's own `exact=false` also
// matches gloss text (not just word_ab), so AB-direction queries filter that
// broad pool locally instead of trusting the param directly.
const MOE_COMMON_PREFIXES = ['sapi', 'paka', 'pina', 'maka', 'mala', 'mipa', 'misa', 'ma', 'mi', 'pa', 'pi', 'ka', 'sa', 'si', 'ni']
const MOE_COMMON_SUFFIXES = ['ayay', 'anay', 'enay', 'ay', 'en', 'an', 'aw', 'to']
// b/f/v form a 3-way interchangeable group (Amis orthographic variation); u/o and l/r stay 2-way.
const MOE_SWAP_GROUPS: string[][] = [['u', 'o'], ['l', 'r'], ['b', 'f', 'v']]
const MAX_MOE_ALT_POSITIONS = 4
const MAX_MOE_FALLBACK_CANDIDATES = 30
const MAX_MOE_PREFIX_STRIPS = 2
const MAX_MOE_SUFFIX_STRIPS = 1
const MIN_MOE_RECOVERY_BASE_LEN = 4

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function moeSwapAlts(c: string): string[] {
  const group = MOE_SWAP_GROUPS.find(g => g.includes(c))
  return group ? group.filter(x => x !== c) : []
}

// Generalized version of Grimoire's makeMoeAltSpellings — handles both 2-way
// swap pairs (u/o, l/r) and the 3-way b/f/v group (each active position gets
// "keep original" + one choice per alternate, not just a binary toggle).
function makeMoeAltSpellings(word: string): string[] {
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

function getMoeRecoveryLength(word: string): number {
  return word.replace(/'/g, '').length
}

function uniqueMoeWords(words: string[]): string[] {
  const seen = new Set<string>()
  return words.filter(word => {
    const key = word.toLowerCase()
    if (!word || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function makeMoeGlottalRepairs(word: string): string[] {
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

function makeMoeStrippedStates(word: string): MoeStrippedState[] {
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

type MoeCandidate = { word: string; score: number }

function makeMoeFallbackCandidates(word: string): MoeCandidate[] {
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

// MoE's own rows carry example sentences inline (examples_json) — id is the sentence
// text itself so the route's existing sentenceMap dedup (keyed by id) naturally
// collapses the same example when it's attached to several related word entries
// (e.g. a root and its derived forms).
function parseMoeExamples(row: MoeRow, dialectName: string): SentenceRow[] {
  if (!row.examples_json) return []
  let examples: MoeExample[]
  try {
    examples = JSON.parse(row.examples_json)
  } catch {
    return []
  }
  if (!Array.isArray(examples)) return []
  // MoE's example ab text carries its own stress/boundary markup (backtick, tilde)
  // around words — not part of the orthography, unlike the apostrophe or "^" marker.
  const cleanMoeAb = (s: string) => s.replace(/[`~]/g, '').replace(/\s+/g, ' ').trim()
  return examples
    .map(ex => ({ ab: cleanMoeAb(ex.ab ?? ''), zh: (ex.zh ?? '').trim() }))
    .filter(ex => ex.ab)
    .map(ex => ({
      id:           ex.ab,
      ab:           ex.ab,
      zh:           ex.zh,
      dialect_name: dialectName,
      source:       'moe',
      audio_url:    null,
    }))
}

async function kilangFetch(keyword: string, exact: boolean): Promise<MoeRow[]> {
  const url = `${CITADEL_MOE}?keyword=${encodeURIComponent(keyword)}&exact=${exact}&mode=moe`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return []
  const data: { rows?: MoeRow[] } = await res.json()
  return data.rows ?? []
}

function toWordRows(entries: [string, MoeMerged][]): WordRow[] {
  return entries.map(([, e], i) => ({
    id:           `moe-${i}`,
    word_ab:      e.word_ab,
    word_ch:      e.defs.join(' · '),
    dialect_name: e.dialect_name,
    glid:         AMIS_GLID,
    exact:        e.exact,
    source:       'moe' as const,
    moeMatch:     e.matchKind,
  }))
}

async function fetchMoeWords(q: string, hasCJK: boolean, fuzzy: boolean): Promise<{ words: WordRow[]; sentences: SentenceRow[] }> {
  try {
    const rawRows = await kilangFetch(q, false)
    const qKey    = normMoeKey(q)
    const merged  = new Map<string, MoeMerged>()
    const sentences: SentenceRow[] = []
    for (const row of rawRows) {
      mergeMoeRow(merged, row, qKey)
      sentences.push(...parseMoeExamples(row, stripAuthor(row.dialect_name)))
    }

    // ZH/EN direction: Kilang's exact=false is already the intended broad
    // word match (Chinese/English glosses genuinely can match unrelated
    // words) — no local filtering there, matching Grimoire's
    // fetchMoeZhInsights split. But example sentences are attached per-word,
    // so a broadly-matched word's examples can leak in even when the
    // example's own zh text has nothing to do with the query — filter those
    // down to sentences that actually contain the query themselves.
    if (hasCJK) {
      const qLower = q.toLowerCase()
      const matchingSentences = sentences.filter(s => s.zh.toLowerCase().includes(qLower))
      return { words: toWordRows(Array.from(merged.entries())), sentences: matchingSentences }
    }

    // AB direction: exact=false also matches gloss text, so classify + filter
    // the broad pool locally instead of trusting the param.
    const maxDist = q.length <= 5 ? 1 : 2
    let entries = Array.from(merged.entries()).filter(([, e]) => {
      if (e.exact) return true
      const ab = normMoeKey(e.word_ab)
      if (ab.includes(qKey)) { e.matchKind = 'contains'; return true }
      if (fuzzy && levenshtein(ab, qKey) <= maxDist) { e.matchKind = 'similar'; return true }
      return false
    })

    // Nothing at all + fuzzy on: retry curated alt-spelling/glottal/affix-strip
    // candidates against Kilang's exact=true (bounded — only on the true-empty
    // path, mirroring Grimoire's fallback trigger, to keep upstream request
    // volume low against an undocumented external API).
    if (fuzzy && entries.length === 0) {
      const candidates    = makeMoeFallbackCandidates(qKey)
      const candidateRows = await Promise.all(candidates.map(c => kilangFetch(c.word, true)))
      const altMerged = new Map<string, MoeMerged>()
      for (const rows of candidateRows) {
        for (const row of rows) mergeMoeRow(altMerged, row, qKey)
      }
      for (const e of altMerged.values()) e.matchKind = 'altSpelling'
      entries = Array.from(altMerged.entries())
    }

    return { words: toWordRows(entries), sentences }
  } catch {
    return { words: [], sentences: [] }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q             = searchParams.get('q')?.trim() ?? ''
  const glid          = searchParams.get('glid')    ?? undefined
  const dialect       = searchParams.get('dialect') ?? undefined
  const fuzzy         = searchParams.get('fuzzy')   === '1'
  const includeMoe    = searchParams.get('moe')     === '1'
  const includeKlokah = searchParams.get('klokah')  === '1'

  const hasCJK = /[㐀-鿿]/.test(q)
  // Word + sentence search can go to 2 chars — see searchWords/searchSentences for how
  // short queries switch to exact/word-boundary matching instead of noisy prefix scans.
  // MoE goes through an external proxy API, so it keeps the original 3-char floor.
  const minLen    = hasCJK ? 1 : 2
  const minLenMoe = hasCJK ? 1 : 3
  if (!q || q.length < minLen) {
    return NextResponse.json({ words: [], sentences: [] })
  }

  try {
    const moeActive = includeMoe && q.length >= minLenMoe && (!glid || glid === AMIS_GLID)
    const [rawWords, rawSentences, moeResult] = await Promise.all([
      includeKlokah ? searchWords(q, glid, dialect, fuzzy)     : Promise.resolve([]),
      includeKlokah ? searchSentences(q, glid, dialect, fuzzy) : Promise.resolve([]),
      moeActive     ? fetchMoeWords(q, hasCJK, fuzzy)          : Promise.resolve({ words: [] as WordRow[], sentences: [] as SentenceRow[] }),
    ])
    const { words: moeWords, sentences: moeSentences } = moeResult

    // Dedup ePark words — corpus has "mafana'to" and "mafana' to" as separate entries;
    // keep the longest among duplicates (spaced form is the correct romanisation).
    function normWordKey(ab: string): string {
      return ab.toLowerCase().normalize('NFC')
        .replace(/[\u2018\u2019\u02BC\uA78C]/g, "'").replace(/\s+/g, '')
    }
    const wordMap = new Map<string, WordRow>()
    for (const w of rawWords) {
      const key      = `${normWordKey(w.word_ab)}|${w.dialect_name}`
      const existing = wordMap.get(key)
      if (!existing || w.word_ab.length > existing.word_ab.length) wordMap.set(key, w)
    }
    const eparkWords = Array.from(wordMap.values())

    const words = [...eparkWords, ...moeWords]
      .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.word_ab.length - b.word_ab.length)

    const sentenceMap = new Map<string, SentenceRow>()
    for (const s of [...rawSentences, ...moeSentences]) {
      if (!sentenceMap.has(s.id) || (!sentenceMap.get(s.id)!.audio_url && s.audio_url)) {
        sentenceMap.set(s.id, s)
      }
    }

    // Rank by where q appears (earlier = more central to the sentence, matches
    // the word-boundary/substring match itself), then by sentence length —
    // same "most relevant, then shortest" shape as the words sort above.
    const qLower = q.toLowerCase()
    function matchPos(s: SentenceRow): number {
      const text = (hasCJK ? s.zh : s.ab).toLowerCase()
      const pos = text.indexOf(qLower)
      return pos === -1 ? Infinity : pos
    }
    const sentenceRows = Array.from(sentenceMap.values())

    // AB direction: tag exact (query appears as its own word, e.g. "misalama")
    // vs extended (query only appears inside a longer derived word, e.g.
    // "misalamaay") so the UI can group exact matches first with a divider —
    // word-boundary detection doesn't map onto Chinese, so CJK direction is
    // left untagged/ungrouped.
    if (!hasCJK) {
      for (const s of sentenceRows) s.sentMatch = isWordBoundaryMatch(s.ab, q) ? 'exact' : 'extended'
    }
    const rank = (s: SentenceRow) => (s.sentMatch === 'extended' ? 1 : 0)
    const sentences = sentenceRows
      .sort((a, b) => rank(a) - rank(b) || matchPos(a) - matchPos(b) || a.ab.length - b.ab.length)

    return NextResponse.json({ words, sentences })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'dict error'
    return NextResponse.json({ error: msg, words: [], sentences: [] }, { status: 500 })
  }
}
