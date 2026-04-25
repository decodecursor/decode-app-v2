import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import AnalyticsClient from './AnalyticsClient'

/**
 * /model/analytics server component. Mirrors `wishlist/page.tsx`
 * pattern: auth gate → profile lookup → suspended gate → delegate
 * render to AnalyticsClient. The client fetches the aggregated
 * dataset on mount per spec §2.2 (single GET, all 4 ranges in one
 * response, tab swap = JS dataset switch).
 */
export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/model/auth')

  const admin = createServiceRoleClient()
  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, is_suspended')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) redirect('/model/setup')

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

  return <AnalyticsClient />
}
