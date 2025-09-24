import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  runtime: 'nodejs', // Use Node.js runtime for full Supabase SSR support
  matcher: [
    /*
     * Only run middleware on API routes and auth pages
     * Skip all static files, images, and client navigation
     */
    '/api/:path*',
    '/auth/:path*',
  ],
}