import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // ycm_master.db is Git LFS — must be explicitly traced so Vercel
  // includes the actual file in serverless function bundles.
  // Also requires "Download Git LFS files" enabled in Vercel project settings.
  outputFileTracingIncludes: {
    '/api/dict/**':      ['../../packages/dictionary/ycm_master.db'],
    '/api/learn/**':     ['../../packages/dictionary/ycm_master.db'],
    '/api/translate/**': ['../../packages/dictionary/ycm_master.db'],
  },
}

export default nextConfig
