import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// trustedby.net hosts ONLY professional (salon) pages. Everything else on
// that host is sent to the main site. welovedecode.com (and any other host)
// is untouched — same session-cookie refresh as before, pass-through rest.
const TRUSTEDBY_HOSTS = new Set(['trustedby.net', 'www.trustedby.net'])
const MAIN_SITE = 'https://welovedecode.com'

// welovedecode paths that must keep running Supabase session-cookie refresh.
// This mirrors the original matcher (mobile session fix) so behavior on the
// main app is unchanged now that the matcher is broad.
const SESSION_BASES = [
  '/api',
  '/auth',
  '/dashboard',
  '/profile',
  '/auctions',
  '/my-links',
  '/offers',
  '/payment',
  '/pending-approval',
  '/model',
]

function hostOf(request: NextRequest): string {
  return (request.headers.get('host') || '').toLowerCase().split(':')[0]
}

function isSessionPath(pathname: string): boolean {
  return SESSION_BASES.some((b) => pathname === b || pathname.startsWith(`${b}/`))
}

export async function middleware(request: NextRequest) {
  const host = hostOf(request)
  const { pathname, search } = request.nextUrl

  // --- trustedby.net: SALON pages only ---
  if (TRUSTEDBY_HOSTS.has(host)) {
    // Let API calls (e.g. the salon page's own analytics) run same-origin.
    if (pathname.startsWith('/api/')) return NextResponse.next()

    // Bare root → main site.
    if (pathname === '/') {
      return NextResponse.redirect(MAIN_SITE, 302)
    }

    // Single-segment path = candidate salon slug. Rewrite (not pass-through)
    // to the salon-only route so top-level static routes (/ambassador, /auth,
    // …) can't render on this host. That route renders the salon or 302s to
    // the main site when the slug isn't a professional.
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 1) {
      const url = request.nextUrl.clone()
      url.pathname = `/salon/${segments[0]}`
      return NextResponse.rewrite(url)
    }

    // Anything else (multi-segment, /case/*, etc.) → main site, path kept.
    return NextResponse.redirect(`${MAIN_SITE}${pathname}${search}`, 302)
  }

  // --- welovedecode.com / any other host: unchanged behavior ---
  // Session-cookie refresh on the original paths; pass everything else through
  // exactly as before (these page routes never ran middleware previously, and
  // NextResponse.next() is a transparent pass-through).
  if (isSessionPath(pathname)) {
    return await updateSession(request)
  }
  return NextResponse.next()
}

export const config = {
  runtime: 'nodejs', // Node.js runtime for full Supabase SSR support
  matcher: [
    /*
     * All routes except Next internals, favicon, and any path with a file
     * extension (static assets / images). This covers "/", "/{slug}", /api,
     * and the original session paths — so welovedecode session refresh is
     * unchanged while trustedby.net host routing can see page requests.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}
