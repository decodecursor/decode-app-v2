import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { toWishCardRow, WISH_LIVE_SELECT, type WishLiveRow } from '@/lib/ambassador/wish-shape'
import WishlistClient from './WishlistClient'

/**
 * /model/wishlist server component. Mirrors /model/listings/page.tsx
 * (Slice 3A pattern): auth gate → profile lookup → suspended gate →
 * fetch wishes via service-role into the canonical card shape →
 * delegate render to WishlistClient.
 */
export default async function WishlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/model/auth')

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, is_suspended, gifts_enabled')
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

  const { data } = await admin
    .from('model_wishes_live')
    .select(WISH_LIVE_SELECT)
    .eq('model_id', profile.id)
    .order('created_at', { ascending: false })
    .returns<WishLiveRow[]>()

  const wishes = (data ?? []).map(toWishCardRow)

  return <WishlistClient wishes={wishes} giftsEnabled={profile.gifts_enabled} />
}
