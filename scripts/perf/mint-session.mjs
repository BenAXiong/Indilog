// Mints a Supabase session for the perf harness without interactive login
// (Google blocks OAuth in automation-controlled browsers).
//
// Flow: admin generate_link (magiclink) → verify token_hash → session JSON →
// encode as the @supabase/ssr cookie (base64- prefix, 3180-char chunks) →
// write scripts/perf/.auth.json for Playwright.
//
// Needs scripts/perf/.api-keys.json (gitignored):
//   npx supabase projects api-keys --project-ref gnmcttlpkiexxoilwhfa -o json > scripts/perf/.api-keys.json
//
// Usage: node scripts/perf/mint-session.mjs [--email you@example.com]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR    = path.dirname(fileURLToPath(import.meta.url))
const AUTH   = path.join(DIR, '.auth.json')
const KEYS   = path.join(DIR, '.api-keys.json')

const SUPABASE_URL = 'https://gnmcttlpkiexxoilwhfa.supabase.co'
const COOKIE_NAME  = 'sb-gnmcttlpkiexxoilwhfa-auth-token'
const APP_DOMAIN   = 'indilog.vercel.app'
const MAX_CHUNK    = 3180   // @supabase/ssr chunker.js

const args  = process.argv.slice(2)
const opt   = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : dflt }
const EMAIL = opt('email', 'bmav.martinez@gmail.com')

if (!fs.existsSync(KEYS)) {
  console.error(`Missing ${KEYS} — fetch it with:\n  npx supabase projects api-keys --project-ref gnmcttlpkiexxoilwhfa -o json > scripts/perf/.api-keys.json`)
  process.exit(1)
}
const keys        = JSON.parse(fs.readFileSync(KEYS, 'utf8'))
const serviceKey  = keys.find(k => k.name === 'service_role')?.api_key
const anonKey     = keys.find(k => k.name === 'anon')?.api_key
if (!serviceKey || !anonKey) { console.error('service_role/anon key not found in .api-keys.json'); process.exit(1) }

async function gotrue(pathname, { key, body }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${pathname}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${JSON.stringify(json)}`)
  return json
}

// 1. Admin: generate a magiclink token (does not send an email)
const link = await gotrue('/admin/generate_link', {
  key: serviceKey,
  body: { type: 'magiclink', email: EMAIL },
})
const tokenHash = link.hashed_token ?? link.properties?.hashed_token
if (!tokenHash) throw new Error(`no hashed_token in generate_link response: ${JSON.stringify(link).slice(0, 200)}`)

// 2. Verify it → full session (access_token, refresh_token, user, …)
const session = await gotrue('/verify', {
  key: anonKey,
  body: { type: 'magiclink', token_hash: tokenHash },
})
if (!session.access_token) throw new Error(`verify returned no session: ${JSON.stringify(session).slice(0, 200)}`)

// GoTrue /verify returns the session fields at top level; normalize to the
// shape supabase-js stores ({access_token, …, user}).
const stored = {
  access_token:  session.access_token,
  token_type:    session.token_type ?? 'bearer',
  expires_in:    session.expires_in,
  expires_at:    session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  refresh_token: session.refresh_token,
  user:          session.user,
}

// 3. Encode as @supabase/ssr cookie: 'base64-' + base64url(JSON), chunked
const b64 = 'base64-' + Buffer.from(JSON.stringify(stored)).toString('base64url')
const chunks = []
for (let i = 0; i < b64.length; i += MAX_CHUNK) chunks.push(b64.slice(i, i + MAX_CHUNK))

const mkCookie = (name, value) => ({
  name, value, domain: APP_DOMAIN, path: '/',
  expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  httpOnly: false, secure: true, sameSite: 'Lax',
})
const cookies = chunks.length === 1
  ? [mkCookie(COOKIE_NAME, chunks[0])]
  : chunks.map((c, i) => mkCookie(`${COOKIE_NAME}.${i}`, c))

fs.writeFileSync(AUTH, JSON.stringify({ cookies, origins: [] }, null, 1))
console.log(`Minted session for ${EMAIL} (${chunks.length} cookie chunk${chunks.length > 1 ? 's' : ''}) → ${AUTH}`)
