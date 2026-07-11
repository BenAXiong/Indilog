import { NextRequest, NextResponse } from 'next/server'
import { searchWords, searchSentences, searchWordsByCandidates, isWordBoundaryMatch, type SentenceRow, type WordRow } from '@/lib/corpus/dict'
import { kilangFetch, parseMoeExamples, stripAuthor, type MoeRow } from '@/lib/corpus/kilang'
import { makeMoeFallbackCandidates } from '@/lib/lang/amis-fuzzy'

export const runtime = 'nodejs'

// Kilang/MoE shadow API — external, undocumented upstream. See docs/kilang-moe-api.md
// for the param contract, response quirks, and a pointer to Grimoire's background.js
// (族語魔書/Ext_族語魔書_PopupDict), which already solved fuzzy/recovery matching against
// this same endpoint — read that before adding new fuzzy logic here.
const AMIS_GLID   = '01'

// Module-level helpers keep fetchMoeWords simple enough to pass complexity checks
const normMoeAb  = (s: string) => s.replace(/\|+$/, '').trim()
const normMoeKey = (s: string) =>
  normMoeAb(s).toLowerCase().normalize('NFC').replace(/[\u2018\u2019\u02BC\uA78C]/g, "'")
// MoE raw definitions use misc symbol chars as internal field separators; strip everything
// outside printable ASCII + General Punctuation + CJK ranges.
const cleanMoeDef = (s: string) =>
  s.replace(/[^ -~\u00A0-\u024F\u1E00-\u1EFF\u2000-\u206F\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/g, ' ')
   .replace(/\s+/g, ' ').trim()

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
// See docs/kilang-moe-api.md — Kilang's own `exact=false` also matches gloss
// text (not just word_ab), so AB-direction queries filter that broad pool
// locally instead of trusting the param directly. Amis-specific curated
// candidate generation (swap tables, glottal repair, affix-strip) lives in
// lib/lang/amis-fuzzy.ts, shared with ePark's searchWordsByCandidates.

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

async function fetchMoeWords(q: string, hasCJK: boolean, fuzzy: boolean, altSpelling: boolean): Promise<{ words: WordRow[]; sentences: SentenceRow[] }> {
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

    // "Swaps" toggle (Amis only, explicit user control — see dict/page.tsx):
    // retry curated alt-spelling/glottal/affix-strip candidates against
    // Kilang's exact=true, merged in alongside whatever exact/contains/similar
    // already found (not gated to only-when-empty anymore — the toggle itself
    // is the gate now).
    if (altSpelling) {
      const existingKeys  = new Set(entries.map(([key]) => key))
      const candidates    = makeMoeFallbackCandidates(qKey)
      const candidateRows = await Promise.all(candidates.map(c => kilangFetch(c.word, true)))
      const altMerged = new Map<string, MoeMerged>()
      for (const rows of candidateRows) {
        for (const row of rows) mergeMoeRow(altMerged, row, qKey)
      }
      for (const [key, e] of altMerged.entries()) {
        if (existingKeys.has(key)) continue
        e.matchKind = 'altSpelling'
        entries.push([key, e])
      }
    }

    return { words: toWordRows(entries), sentences }
  } catch {
    return { words: [], sentences: [] }
  }
}

// Dedup ePark words — corpus has "mafana'to" and "mafana' to" as separate entries;
// keep the longest among duplicates (spaced form is the correct romanisation).
function normWordKey(ab: string): string {
  return ab.toLowerCase().normalize('NFC')
    .replace(/[\u2018\u2019\u02BC\uA78C]/g, "'").replace(/\s+/g, '')
}

function mergeEparkWords(rawWords: WordRow[], altWords: WordRow[]): WordRow[] {
  const wordMap = new Map<string, WordRow>()
  for (const w of [...rawWords, ...altWords]) {
    const key      = `${normWordKey(w.word_ab)}|${w.dialect_name}`
    const existing = wordMap.get(key)
    if (!existing) { wordMap.set(key, w); continue }
    const existingIsAlt = existing.moeMatch === 'altSpelling'
    const currentIsAlt  = w.moeMatch === 'altSpelling'
    if (existingIsAlt && !currentIsAlt) { wordMap.set(key, w); continue }
    if (!existingIsAlt && currentIsAlt) continue
    if (w.word_ab.length > existing.word_ab.length) wordMap.set(key, w)
  }
  return Array.from(wordMap.values())
}

// Dedup by sentence id (preferring the entry with audio), then rank: AB
// direction groups exact matches (query as its own word) ahead of extended
// ones (query only inside a longer derived word, e.g. "misalamaay") so the
// UI can divide them — word-boundary detection doesn't map onto Chinese, so
// CJK direction is left untagged/ungrouped. Within each group, rank by where
// q appears (earlier = more central), then by sentence length.
function mergeAndRankSentences(rawSentences: SentenceRow[], moeSentences: SentenceRow[], q: string, hasCJK: boolean): SentenceRow[] {
  const sentenceMap = new Map<string, SentenceRow>()
  for (const s of [...rawSentences, ...moeSentences]) {
    if (!sentenceMap.has(s.id) || (!sentenceMap.get(s.id)!.audio_url && s.audio_url)) {
      sentenceMap.set(s.id, s)
    }
  }

  const qLower = q.toLowerCase()
  function matchPos(s: SentenceRow): number {
    const text = (hasCJK ? s.zh : s.ab).toLowerCase()
    const pos = text.indexOf(qLower)
    return pos === -1 ? Infinity : pos
  }

  const sentenceRows = Array.from(sentenceMap.values())
  if (!hasCJK) {
    for (const s of sentenceRows) s.sentMatch = isWordBoundaryMatch(s.ab, q) ? 'exact' : 'extended'
  }
  const rank = (s: SentenceRow) => (s.sentMatch === 'extended' ? 1 : 0)
  return sentenceRows.sort((a, b) => rank(a) - rank(b) || matchPos(a) - matchPos(b) || a.ab.length - b.ab.length)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q             = searchParams.get('q')?.trim() ?? ''
  const glid          = searchParams.get('glid')    ?? undefined
  const dialect       = searchParams.get('dialect') ?? undefined
  const fuzzy         = searchParams.get('fuzzy')   === '1'
  const includeMoe    = searchParams.get('moe')     === '1'
  const includeKlokah = searchParams.get('klokah')  === '1'
  const altSpelling   = searchParams.get('altspelling') === '1'

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
    // "Swaps" toggle only ever applies to Amis (curated tables don't cover the
    // other 15 languages) — skip entirely if the user has filtered to a
    // different language, or the query is CJK-direction (candidate generation
    // is an AB-direction spelling-recovery mechanism).
    const altSpellingActive = altSpelling && includeKlokah && !hasCJK && (!glid || glid === AMIS_GLID)
    const altCandidates = altSpellingActive ? makeMoeFallbackCandidates(q).map(c => c.word) : []
    const [rawWords, rawSentences, moeResult, altEparkWords] = await Promise.all([
      includeKlokah     ? searchWords(q, glid, dialect, fuzzy)                       : Promise.resolve([]),
      includeKlokah     ? searchSentences(q, glid, dialect, fuzzy)                    : Promise.resolve([]),
      moeActive         ? fetchMoeWords(q, hasCJK, fuzzy, altSpellingActive)          : Promise.resolve({ words: [] as WordRow[], sentences: [] as SentenceRow[] }),
      altSpellingActive ? searchWordsByCandidates(altCandidates, AMIS_GLID, dialect)  : Promise.resolve([] as WordRow[]),
    ])
    const { words: moeWords, sentences: moeSentences } = moeResult

    const eparkWords = mergeEparkWords(rawWords, altEparkWords)
    const words = [...eparkWords, ...moeWords]
      .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.word_ab.length - b.word_ab.length)

    const sentences = mergeAndRankSentences(rawSentences, moeSentences, q, hasCJK)

    return NextResponse.json({ words, sentences })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'dict error'
    return NextResponse.json({ error: msg, words: [], sentences: [] }, { status: 500 })
  }
}
