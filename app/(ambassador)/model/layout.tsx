import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export default async function ModelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || ''

  // Auth and setup pages are public — don't require session
  const publicPaths = ['/model/auth', '/model/setup']
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to auth (except public paths)
  if (!user && !isPublicPath) {
    redirect('/model/auth')
  }

  // Logged in — check profile
  if (user) {
    const { data: profile } = await supabase
      .from('model_profiles')
      .select('id, is_suspended')
      .eq('user_id', user.id)
      .maybeSingle()

    // No profile → redirect to onboarding (except auth/setup pages)
    if (!profile && !isPublicPath) {
      redirect('/model/setup')
    }

    // Suspended → show suspended screen (blocks all mutations)
    if (profile?.is_suspended && !pathname.startsWith('/model/auth')) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
            Account suspended
          </h1>
          <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.65, maxWidth: '300px' }}>
            Your account has been suspended. Please contact support at{' '}
            <span style={{ color: '#e91e8c' }}>hello@welovedecode.com</span>{' '}
            for assistance.
          </p>
        </div>
      )
    }

    // Already has profile + on setup page → redirect to dashboard
    if (profile && pathname.startsWith('/model/setup')) {
      redirect('/model')
    }

    // Already logged in + on auth page → redirect to dashboard
    if (profile && pathname.startsWith('/model/auth')) {
      redirect('/model')
    }
  }

  return <>{children}</>
}
