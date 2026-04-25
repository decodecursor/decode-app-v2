import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import StatementClient from './StatementClient'

/**
 * /model/payouts/[id] server component. Auth + suspended gate, then
 * delegate to StatementClient. Statement detail itself is fetched
 * client-side from /api/ambassador/model/payouts/[id] so the page
 * stays small and the back-arrow history.back() works smoothly
 * (no full re-server-render on each open).
 */
export default async function StatementPage({ params }: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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
          Your account has been suspended.
        </p>
      </div>
    )
  }

  return <StatementClient payoutId={id} />
}
