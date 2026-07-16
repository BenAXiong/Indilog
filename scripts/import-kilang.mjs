// One-off import: YCM_Citadel's amis_moe_test.db (SQLite) -> Indivore's
// Supabase kilang_entries / kilang_hierarchy tables. Run after
// supabase/migrations/20260716010000_kilang_tables.sql has been applied.
//
// better-sqlite3 is intentionally NOT a persisted dependency (DEC-M3-03) —
// install it transiently first:  pnpm add -w -D better-sqlite3
// then after this script finishes:  pnpm remove -w better-sqlite3
//
// Talks to Supabase via raw REST (PostgREST), not @supabase/supabase-js, so
// this script has no dependency on the apps/web workspace.
//
// Usage: node scripts/import-kilang.mjs [path/to/amis_moe_test.db]

import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR  = path.dirname(fileURLToPath(import.meta.url))
const KEYS = path.join(DIR, 'perf', '.api-keys.json')
const dbPath = process.argv[2] ?? 'C:\\Users\\Ben\\Documents\\LL\\6_ycm\\YCM_Citadel\\portal\\amis_moe_test.db'

if (!fs.existsSync(dbPath)) { console.error(`SQLite file not found: ${dbPath}`); process.exit(1) }
if (!fs.existsSync(KEYS))   { console.error(`Missing ${KEYS} — see scripts/perf/mint-session.mjs header for how to fetch it`); process.exit(1) }

const keys = JSON.parse(fs.readFileSync(KEYS, 'utf8'))
const serviceKey = keys.find(k => k.name === 'service_role')?.api_key
if (!serviceKey) { console.error('service_role key not found in .api-keys.json'); process.exit(1) }

const SUPABASE_URL = 'https://gnmcttlpkiexxoilwhfa.supabase.co'

async function upsert(table, conflictCol, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCol}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`${table} upsert failed: ${res.status} ${await res.text()}`)
}

async function upsertBatches(table, rows, conflictCol, batchSize = 500) {
  let done = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    await upsert(table, conflictCol, rows.slice(i, i + batchSize))
    done += Math.min(batchSize, rows.length - i)
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}`)
  }
  console.log()
}

const db = new Database(dbPath, { readonly: true })

console.log('Reading moe_entries...')
const entries = db.prepare(`
  SELECT id, dict_code, word_ab, definition, examples_json, dialect_name, glid, stem
  FROM moe_entries
`).all().map(r => ({
  source_id:     r.id,
  dict_code:     r.dict_code,
  word_ab:       r.word_ab,
  definition:    r.definition,
  examples_json: r.examples_json,
  dialect_name:  r.dialect_name,
  glid:          r.glid,
  stem:          r.stem,
}))
console.log(`  ${entries.length} rows`)
await upsertBatches('kilang_entries', entries, 'source_id')

console.log('Reading moe_hierarchy_moe...')
const hierarchy = db.prepare(`
  SELECT word_ab, parent_word, ultimate_root, depth, sort_path, sources
  FROM moe_hierarchy_moe
`).all()
console.log(`  ${hierarchy.length} rows`)
await upsertBatches('kilang_hierarchy', hierarchy, 'word_ab')

db.close()
console.log('Done.')
