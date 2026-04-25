import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { isInternalEmail } from '@/lib/ambassador/auth'
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
    .maybeSingle()

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

  // ISO Mon-start in UTC (acceptable for v1 — see DECODE_PROJECT_STATE.md pre-launch checklist)
  const now = new Date()
  const day = now.getUTCDay() || 7
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1))

  const [
    viewsTotalRes,
    viewsThisWeekRes,
    topClicksRes,
    activeListingsRes,
    openWishesRes,
  ] = await Promise.all([
    adminClient
      .from('model_analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', profile.id)
      .eq('event_type', 'public_page_view'),
    adminClient
      .from('model_analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', profile.id)
      .eq('event_type', 'public_page_view')
      .gte('created_at', weekStart.toISOString()),
    adminClient.rpc('get_top_click_categories', { p_model_id: profile.id, p_limit: 3 }),
    adminClient
      .from('model_listings')
      .select('id, paid_until, free_trial_ends_at')
      .eq('model_id', profile.id)
      .in('status', ['active', 'free_trial']),
    // Slice 5A: count open wishes (status='available') for the
    // Wishlist nav-card alert. Mirrors the listings expiringCount
    // pattern but uses total-open as the actionable signal since
    // wishes have no expiry/renewal cycle.
    adminClient
      .from('model_wishes')
      .select('id', { count: 'exact', head: true })
      .eq('model_id', profile.id)
      .eq('status', 'available'),
  ])

  const sevenDaysFromNow = Date.now() + 7 * 24 * 3600 * 1000
  const expiringCount = (activeListingsRes.data ?? []).filter((l) => {
    const exp = l.paid_until ?? l.free_trial_ends_at
    return exp && new Date(exp).getTime() < sevenDaysFromNow
  }).length

  const openWishCount = openWishesRes.count ?? 0

  const showEmailHint = !user.email || isInternalEmail(user.email)

  return (
    <DashboardClient
      profile={profile}
      isFirstVisit={isFirstVisit}
      viewsTotal={viewsTotalRes.count ?? 0}
      viewsThisWeek={viewsThisWeekRes.count ?? 0}
      topClicks={(topClicksRes.data as Array<{ category: string; clicks: number }> | null) ?? []}
      expiringCount={expiringCount}
      openWishCount={openWishCount}
      showEmailHint={showEmailHint}
    />
  )
}
