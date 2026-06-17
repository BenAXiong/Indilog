import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Corpus data now served from Supabase — no local SQLite bundle needed
  env: {
    NEXT_PUBLIC_BUILD_TIME: (() => {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      return `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())} - ${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
    })(),
  },
}

export default nextConfig
