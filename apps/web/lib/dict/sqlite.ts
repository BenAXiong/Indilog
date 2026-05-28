import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

let _db: Database.Database | null = null

function resolveDbPath(): string {
  const fromRoot = path.join(process.cwd(), 'packages/dictionary/ycm_master.db')
  const fromWeb  = path.join(process.cwd(), '../../packages/dictionary/ycm_master.db')
  if (fs.existsSync(fromRoot)) return fromRoot
  if (fs.existsSync(fromWeb))  return fromWeb
  throw new Error('ycm_master.db not found — place it at packages/dictionary/ycm_master.db')
}

export function getDb(): Database.Database {
  if (!_db) _db = new Database(resolveDbPath(), { readonly: true })
  return _db
}
