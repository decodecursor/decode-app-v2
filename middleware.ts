import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  runtime: 'nodejs', // Use Node.js runtime for full Supabase SSR support
  matcher: [
    /*
     * Run middleware on API routes, auth pages, and protected routes
     * This ensures session cookies are properly refreshed on mobile devices
     * Skip all static files, images, and client navigation
     */
    '/api/:path*',
    '/auth/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/auctions/:path*',
    '/my-links/:path*',
    '/payment/:path*',
    '/pending-approval/:path*',
  ],
}