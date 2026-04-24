import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import SendPaymentLinkClient from '@/components/ambassador/SendPaymentLinkClient'

type EffectiveStatus = 'free_trial' | 'pending_payment' | 'active' | 'expired'

type LiveRow = {
  id: string
  status: EffectiveStatus
  effective_status: EffectiveStatus
  payment_link_token: string
  price_30: number | null
  price_60: number | null
  price_90: number | null
  currency: string
  free_trial_ends_at: string | null
  paid_until: string | null
  category_id: string | null
  category_custom: string | null
  media_type: 'video' | 'photos' | null
  photo_url_1: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  video_url: string | null
  model_professionals: { name: string } | null
  model_categories: { label: string } | null
}

export default async function SendPaymentLinkPage({
  params,
}: {
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
    .maybeSingle<{ id: string; is_suspended: boolean }>()

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

  // Owner-scoped fetch from the live view. effective_status filters out
  // date-expired rows; raw status alone would miss rows whose
  // free_trial_ends_at / paid_until already rolled past now. Identity
  // immutability (Principle A) means we never expose another ambassador's
  // listing — the model_id eq acts as the RLS-style scope guard.
  const { data: row } = await admin
    .from('model_listings_live')
    .select(
      'id, status, effective_status, payment_link_token, price_30, price_60, price_90, currency, free_trial_ends_at, paid_until, category_id, category_custom, media_type, photo_url_1, photo_url_2, photo_url_3, video_url, model_professionals!model_listings_professional_id_fkey ( name ), model_categories!model_listings_category_id_fkey ( label )',
    )
    .eq('id', id)
    .eq('model_id', profile.id)
    .maybeSingle<LiveRow>()

  if (!row || !row.model_professionals) redirect('/model/listings')
  if (row.effective_status === 'expired') redirect('/model/listings')

  return (
    <SendPaymentLinkClient
      listing={{
        id: row.id,
        effective_status: row.effective_status,
        payment_link_token: row.payment_link_token,
        price_30: row.price_30,
        price_60: row.price_60,
        price_90: row.price_90,
        currency: row.currency,
        free_trial_ends_at: row.free_trial_ends_at,
        paid_until: row.paid_until,
        category_id: row.category_id,
        category_label: row.model_categories?.label ?? null,
        category_custom: row.category_custom,
        media_type: row.media_type,
        photo_url_1: row.photo_url_1,
        photo_url_2: row.photo_url_2,
        photo_url_3: row.photo_url_3,
        video_url: row.video_url,
      }}
      professional={{ name: row.model_professionals.name }}
    />
  )
}
