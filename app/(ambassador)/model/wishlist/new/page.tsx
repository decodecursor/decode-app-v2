import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import AddWishClient from './AddWishClient'

type Category = { id: string; label: string; slug: string }

/**
 * /model/wishlist/new server component. Mirrors /model/listings/new
 * (Slice 3B Phase 5 pattern): auth gate → profile fetch (id + currency
 * + gifts_enabled + suspended) → categories list → delegate to client.
 *
 * Slice 5A locked decision: redirect to /model/wishlist if the
 * ambassador hasn't enabled gifts in Settings. Adding a wish while
 * gifts_enabled=false would let her create rows that never appear on
 * her public page (RLS hides them) — confusing UX. Force the toggle
 * first.
 */
export default async function AddWishPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/model/auth')

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, currency, gifts_enabled, is_suspended')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; currency: string; gifts_enabled: boolean; is_suspended: boolean }>()

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

  if (!profile.gifts_enabled) {
    redirect('/model/wishlist')
  }

  const { data: categoriesData } = await admin
    .from('model_categories')
    .select('id, label, slug')
    .eq('is_active', true)
    .order('label', { ascending: true })
    .returns<Category[]>()

  const categories = categoriesData ?? []

  return <AddWishClient categories={categories} currency={profile.currency} />
}
