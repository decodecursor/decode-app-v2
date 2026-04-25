import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import PayoutsListClient from './PayoutsListClient'

/**
 * /model/payouts server component. Mirrors `analytics/page.tsx`
 * pattern: auth gate → profile lookup → suspended gate → delegate
 * render to PayoutsListClient. The client fetches the dataset on
 * mount (single GET, list endpoint returns next_payout aggregate +
 * history array).
 */
export default async function PayoutsPage() {
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

  return <PayoutsListClient />
}
