// TEMPORARY — remove after Vercel LFS issue is confirmed fixed
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

export async function GET() {
  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'packages/dictionary/ycm_master.db'),
    path.join(cwd, '../../packages/dictionary/ycm_master.db'),
  ]

  const checks = candidates.map(p => {
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
        sizeMB: (stat.size / 1024 / 1024).toFixed(1),
        isSQLite: buf.slice(0, 15).toString('ascii') === 'SQLite format 3',
        header: buf.toString('hex'),
      }
    } catch (e) {
      return { path: p, exists: false, error: String(e) }
    }
  })

  return Response.json({ cwd, checks })
}
