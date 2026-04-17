import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/model/auth')

  const adminClient = createServiceRoleClient()

  const { data: profile } = await adminClient
    .from('model_profiles')
    .select('id, slug, first_name, last_name, cover_photo_url, cover_photo_position_y, is_published, gifts_enabled, is_suspended, dashboard_first_seen_at')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/model/setup')

  // Suspended ambassador — block access
  if (profile.is_suspended) {
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

  // Set dashboard_first_seen_at on first visit
  const isFirstVisit = !profile.dashboard_first_seen_at
  if (isFirstVisit) {
    await adminClient
      .from('model_profiles')
      .update({ dashboard_first_seen_at: new Date().toISOString() })
      .eq('id', profile.id)
  }

  return (
    <DashboardClient
      profile={profile}
      isFirstVisit={isFirstVisit}
    />
  )
}
