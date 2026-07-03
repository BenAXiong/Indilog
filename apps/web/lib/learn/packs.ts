'use client'

// Per-dialect study-content packs (perf S8). Built by scripts/build-content-packs.mjs
// into public/packs/*.json; cached in IndexedDB and served with zero network on
// repeat visits. Any miss (unknown dialect, missing key, storage failure) returns
// null and the caller falls back to /api/learn/curriculum.

import manifestRaw from './pack-manifest.json'
import type { CurriculumRow } from '@/lib/corpus/curriculum'

type ManifestEntry = { url: string; version: string; sentences: number }
const manifest = manifestRaw as Record<string, ManifestEntry>

type Pack = {
  version: string
  dialect: string
  sources: Record<string, Record<string, CurriculumRow[]>>
}

const DB_NAME = 'iv-packs'
const STORE   = 'packs'

const memCache = new Map<string, Pack>()

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<Pack | undefined> {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as Pack | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}

async function idbPut(key: string, pack: Pack): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(pack, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}

async function loadPack(dialect: string): Promise<Pack | null> {
  const entry = manifest[dialect]
  if (!entry) return null
  const cached = memCache.get(dialect)
  if (cached) return cached
  let pack: Pack | undefined
  try { pack = await idbGet(dialect) } catch { /* storage unavailable → network */ }
  if (!pack || pack.version !== entry.version) {
    const res = await fetch(`${entry.url}?v=${entry.version}`)
    if (!res.ok) return null
    pack = await res.json() as Pack
    idbPut(dialect, pack).catch(() => {})
  }
  memCache.set(dialect, pack)
  return pack
}

// key: twelve → "Level X Lesson Y"; grmpts → "level::pattern"; indexed → title_zh
export async function getPackRows(
  dialect: string,
  source: string,
  key: string,
): Promise<CurriculumRow[] | null> {
  try {
    const pack = await loadPack(dialect)
    return pack?.sources[source]?.[key] ?? null
  } catch {
    return null
  }
}
