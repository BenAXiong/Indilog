// TEMPORARY — remove after Vercel db issue is confirmed fixed
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

export async function GET() {
  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'packages/dictionary/ycm_master.db'),
    path.join(cwd, '../../packages/dictionary/ycm_master.db'),
  ]

  const fileChecks = candidates.map(p => {
    try {
      const stat = fs.statSync(p)
      const fd = fs.openSync(p, 'r')
      const buf = Buffer.alloc(16)
      fs.readSync(fd, buf, 0, 16, 0)
      fs.closeSync(fd)
      return {
        path: p,
        exists: true,
        sizeBytes: stat.size,
        isSQLite: buf.subarray(0, 15).toString('ascii') === 'SQLite format 3',
      }
    } catch (e) {
      return { path: p, exists: false, error: String(e) }
    }
  })

  // Test better-sqlite3 can actually open and query the db
  let sqliteTest: Record<string, unknown> = { skipped: true }
  const dbPath = fileChecks.find(c => c.exists && c.isSQLite)?.path
  if (dbPath) {
    try {
      const Database = (await import('better-sqlite3')).default
      const db = new Database(dbPath, { readonly: true })
      const row = db.prepare('SELECT count(*) as n FROM ilrdf_vocabulary').get() as { n: number }
      db.close()
      sqliteTest = { ok: true, rowCount: row.n }
    } catch (e) {
      sqliteTest = { ok: false, error: String(e) }
    }
  }

  return Response.json({ cwd, fileChecks, sqliteTest })
}
