// Builds per-dialect study-content packs (perf S8, docs/perf-plan.md).
// A pack bundles every curriculum sentence for one corpus dialect_name so the
// client (lib/learn/packs.ts) can serve ePark content from IndexedDB with zero
// network. Output: apps/web/public/packs/<slug>.json (CDN-served, version-busted)
// + apps/web/lib/learn/pack-manifest.json (dialect_name → url/version).
//
// Rebuild + commit whenever the corpus changes:
//   node scripts/build-content-packs.mjs
//
// Row shape matches CurriculumRow (lib/corpus/curriculum.ts); audio URLs are
// repaired at build time with the same rules as the API route.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB  = path.join(ROOT, 'apps', 'web')

// dialect_name → { slug, sources } — grmpts lives under the language-level
// dialect name (阿美語), everything else under the specific dialect.
const PACKS = [
  { dialect: '馬蘭阿美語', slug: 'amis-malan',   sources: ['twelve', 'essay', 'dialogue', 'con_practice'] },
  { dialect: '阿美語',     slug: 'amis-grammar', sources: ['grmpts'] },
]

const env = fs.readFileSync(path.join(WEB, '.env.local'), 'utf8')
const envVal = k => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()
const URL_ = envVal('NEXT_PUBLIC_SUPABASE_URL')
const KEY  = envVal('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if (!URL_ || !KEY) { console.error('Supabase env vars not found in apps/web/.env.local'); process.exit(1) }

const geometry = JSON.parse(fs.readFileSync(path.join(WEB, 'lib', 'learn', 'corpus_geometry.json'), 'utf8'))

// ── audio repair — mirror of lib/corpus/curriculum.ts repairAudioUrl ─────────
const TEXT_SOUND_SOURCES = new Set(['essay', 'dialogue', 'grmpts'])
function repairAudioUrl(url, source, uuid) {
  if (!url) return null
  let fixed = url.replace('http://', 'https://')
  if (!fixed.includes('klokah.tw')) return fixed
  fixed = fixed.replace('file.klokah.tw', 'web.klokah.tw')
  if (TEXT_SOUND_SOURCES.has(source) && !fixed.includes('/text/')) {
    // dialogue URLs already carry /sound/{tid}/{id}.mp3 — just insert /text/
    const twoSeg = /\/sound\/(\d+)\/(\d+)\.mp3/.exec(fixed)
    if (twoSeg) {
      return `https://web.klokah.tw/text/sound/${twoSeg[1]}/${twoSeg[2]}.mp3`
    }
    const parts = uuid.split('_')
    const contextId = parts.length >= 3 ? parts.at(-2) ?? null : null
    const soundMatch = /\/sound\/(\d+)\.mp3/.exec(fixed)
    if (contextId && /^\d+$/.test(contextId) && soundMatch?.[1]) {
      return `https://web.klokah.tw/text/sound/${contextId}/${soundMatch[1]}.mp3`
    }
  }
  return fixed
}

// ── paginated PostgREST fetch ────────────────────────────────────────────────
async function fetchAll(source, dialect) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const qs = new URLSearchParams({
      select: 'audio_url,original_uuid,category,position,level,corpus_sentences!inner(ab,zh)',
      source: `eq.${source}`,
      dialect_name: `eq.${dialect}`,
      order: 'category.asc,position.asc',
    })
    const res = await fetch(`${URL_}/rest/v1/corpus_occurrences?${qs}`, {
      headers: { apikey: KEY, Range: `${from}-${from + PAGE - 1}` },
    })
    if (!res.ok) throw new Error(`${source}/${dialect}: ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

// category → title_zh for indexed sources, per dialect (geometry alignment)
function titleByCategory(source, dialect) {
  const map = {}
  for (const item of geometry[source] ?? []) {
    const cat = item.alignment?.[dialect]
    if (cat) map[cat] = item.title_zh
  }
  return map
}

const manifest = {}
const packsDir = path.join(WEB, 'public', 'packs')
fs.mkdirSync(packsDir, { recursive: true })

for (const { dialect, slug, sources } of PACKS) {
  const pack = { dialect, builtAt: new Date().toISOString(), sources: {} }
  let total = 0
  for (const source of sources) {
    const rows = await fetchAll(source, dialect)
    const isIndexed = source === 'essay' || source === 'dialogue' || source === 'con_practice'
    const titleMap = isIndexed ? titleByCategory(source, dialect) : {}
    const bySrc = {}
    for (const r of rows) {
      // key: twelve → category; grmpts → level::category; indexed → title_zh
      const key = source === 'grmpts' ? `${r.level}::${r.category}`
        : isIndexed ? (titleMap[r.category] ?? r.category)
        : r.category
      ;(bySrc[key] ??= []).push({
        ab:            r.corpus_sentences.ab,
        zh:            r.corpus_sentences.zh ?? null,
        audio_url:     repairAudioUrl(r.audio_url, source, r.original_uuid),
        original_uuid: r.original_uuid,
        category:      r.category,
      })
    }
    pack.sources[source] = bySrc
    total += rows.length
    console.log(`  ${dialect} ${source}: ${rows.length} rows, ${Object.keys(bySrc).length} keys`)
  }
  const body = JSON.stringify(pack)
  const version = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12)
  const withVersion = JSON.stringify({ version, ...pack })
  fs.writeFileSync(path.join(packsDir, `${slug}.json`), withVersion)
  manifest[dialect] = { url: `/packs/${slug}.json`, version, sentences: total }
  console.log(`${slug}.json — ${total} rows, ${(withVersion.length / 1024).toFixed(0)}KB raw, v${version}`)
}

fs.writeFileSync(
  path.join(WEB, 'lib', 'learn', 'pack-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log('pack-manifest.json written')
