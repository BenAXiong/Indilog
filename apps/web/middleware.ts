import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Local JWT verification (perf S9): with asymmetric ES256 keys, getClaims
  // verifies the signature against the cached JWKS — no auth-server round trip
  // per request (getUser was ~150–250ms HK→Sydney on every navigation).
  // Session refresh still happens under the hood when the token is expired.
  // Tradeoff: a revoked-but-unexpired token passes until expiry (≤1h) — same
  // window PostgREST/RLS already allows for data access.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims?.sub ? { id: data.claims.sub } : null

  const { pathname } = request.nextUrl
  // /import is public — hash fragment is client-side and must be read before any redirect
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/auth') || pathname.startsWith('/import') || pathname.startsWith('/demo')

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // api/learn/{curriculum,geometry} excluded: public corpus data, no auth inside,
    // and skipping middleware lets the CDN cache them (perf S2)
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/learn/(?:curriculum|geometry)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
